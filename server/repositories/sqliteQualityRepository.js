function toSource(row) {
  return {
    id: Number(row.id),
    name: row.name,
    kind: row.kind,
    owner: row.owner,
    status: row.status,
    score: row.score === null ? null : Number(row.score),
    rowCount: row.row_count === null ? 0 : Number(row.row_count),
    issueCount: row.issue_count === null ? 0 : Number(row.issue_count),
    lastRunAt: row.completed_at,
  };
}

export class SqliteQualityRepository {
  constructor(database) {
    this.database = database;
    this.listSourcesStatement = database.prepare(`
      SELECT source.*, run.score, run.row_count, run.issue_count, run.completed_at
      FROM data_sources source
      LEFT JOIN quality_runs run ON run.id = (
        SELECT id FROM quality_runs WHERE source_id = source.id ORDER BY id DESC LIMIT 1
      )
      ORDER BY source.id
    `);
    this.latestIssuesStatement = database.prepare(`
      SELECT issue.id, issue.rule_code, issue.severity, issue.field_name, issue.message,
             source.name AS source_name
      FROM quality_issues issue
      JOIN quality_runs run ON run.id = issue.run_id
      JOIN data_sources source ON source.id = run.source_id
      ORDER BY CASE issue.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
               issue.id DESC
      LIMIT ?
    `);
  }

  listSources() {
    return this.listSourcesStatement.all().map(toSource);
  }

  overview() {
    const sources = this.listSources();
    const scored = sources.filter((source) => source.score !== null);
    const qualityScore = scored.length
      ? Math.round(scored.reduce((total, source) => total + source.score, 0) / scored.length)
      : 0;

    return {
      qualityScore,
      sourceCount: sources.length,
      healthySourceCount: sources.filter((source) => source.status === "healthy").length,
      openIssueCount: sources.reduce((total, source) => total + source.issueCount, 0),
      processedRowCount: sources.reduce((total, source) => total + source.rowCount, 0),
      latestIssues: this.latestIssuesStatement.all(5).map((row) => ({
        id: Number(row.id),
        code: row.rule_code,
        severity: row.severity,
        field: row.field_name,
        message: row.message,
        sourceName: row.source_name,
      })),
    };
  }
}
