function parse(value) {
  return JSON.parse(value ?? "{}");
}

export class SqliteAnalysisRepository {
  constructor(database) {
    this.database = database;
    this.findSourceStatement = database.prepare("SELECT * FROM data_sources WHERE id = ?");
    this.findBaselineStatement = database.prepare("SELECT * FROM profile_baselines WHERE source_id = ?");
    this.latestRunStatement = database.prepare("SELECT * FROM quality_runs WHERE source_id = ? ORDER BY id DESC LIMIT 1");
    this.historyStatement = database.prepare(`
      SELECT event.id, event.source_id, event.run_id, event.event_type, event.payload_json, event.created_at,
             run.score, run.status, run.row_count, run.issue_count
      FROM profile_events event
      JOIN quality_runs run ON run.id = event.run_id
      WHERE event.source_id = ? ORDER BY event.id DESC LIMIT ?
    `);
  }

  sourceExists(sourceId) {
    return Boolean(this.findSourceStatement.get(sourceId));
  }

  baseline(sourceId) {
    const row = this.findBaselineStatement.get(sourceId);
    return row ? { runId: Number(row.run_id), profile: parse(row.profile_json), updatedAt: row.updated_at } : null;
  }

  save(sourceId, { format, profile, issues, drift, score }) {
    const now = new Date().toISOString();
    const status = score < 60 || issues.some((issue) => issue.severity === "critical") ? "failed" : score < 85 || issues.length || drift.length ? "warning" : "passed";
    this.database.exec("BEGIN IMMEDIATE;");
    try {
      const runId = Number(this.database.prepare(`
        INSERT INTO quality_runs (source_id, status, score, row_count, issue_count, started_at, completed_at, profile_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sourceId, status, score, profile.rowCount, issues.length + drift.length, now, now, JSON.stringify(profile)).lastInsertRowid);
      const insertIssue = this.database.prepare(`
        INSERT INTO quality_issues (run_id, rule_code, severity, field_name, message, sample_value)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const issue of issues) insertIssue.run(runId, issue.ruleCode, issue.severity, issue.fieldName, issue.message, issue.sampleValue);
      for (const item of drift) insertIssue.run(runId, "DISTRIBUTION_DRIFT", "warning", item.field, `${item.field} alanında ${item.metric} dağılım değişimi algılandı.`, JSON.stringify({ previous: item.previous, current: item.current }));
      this.database.prepare(`
        INSERT INTO profile_events (source_id, run_id, event_type, payload_json, created_at)
        VALUES (?, ?, 'profile_completed', ?, ?)
      `).run(sourceId, runId, JSON.stringify({ format, profile, issues, drift }), now);
      const baselineCreated = !this.findBaselineStatement.get(sourceId);
      if (baselineCreated) {
        this.database.prepare(`
          INSERT INTO profile_baselines (source_id, run_id, profile_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(sourceId, runId, JSON.stringify(profile), now, now);
      }
      const sourceStatus = status === "passed" ? "healthy" : status === "warning" ? "warning" : "critical";
      this.database.prepare("UPDATE data_sources SET status = ? WHERE id = ?").run(sourceStatus, sourceId);
      this.database.exec("COMMIT;");
      return { runId, status, baselineCreated, completedAt: now };
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }
  }

  history(sourceId, limit = 25) {
    return this.historyStatement.all(sourceId, limit).map((row) => ({
      id: Number(row.id), sourceId: Number(row.source_id), runId: Number(row.run_id), type: row.event_type,
      profile: parse(row.payload_json).profile, drift: parse(row.payload_json).drift ?? [], score: Number(row.score),
      status: row.status, rowCount: Number(row.row_count), issueCount: Number(row.issue_count), createdAt: row.created_at,
    }));
  }

  promoteLatest(sourceId) {
    const run = this.latestRunStatement.get(sourceId);
    if (!run) return null;
    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO profile_baselines (source_id, run_id, profile_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(source_id) DO UPDATE SET run_id = excluded.run_id, profile_json = excluded.profile_json, updated_at = excluded.updated_at
    `).run(sourceId, run.id, run.profile_json, now, now);
    return { runId: Number(run.id), profile: parse(run.profile_json), updatedAt: now };
  }
}
