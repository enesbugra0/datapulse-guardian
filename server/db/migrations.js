const migrations = [
  {
    version: 1,
    name: "create_tasks",
    sql: `
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL CHECK (length(trim(title)) >= 3),
        status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
        created_at TEXT NOT NULL,
        updated_at TEXT
      );
      CREATE INDEX idx_tasks_status ON tasks(status);
    `,
  },
  {
    version: 2,
    name: "create_data_quality_core",
    sql: `
      CREATE TABLE data_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL,
        owner TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'warning', 'critical')),
        created_at TEXT NOT NULL
      );

      CREATE TABLE quality_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (status IN ('passed', 'warning', 'failed')),
        score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
        row_count INTEGER NOT NULL DEFAULT 0,
        issue_count INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        profile_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE quality_issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER NOT NULL REFERENCES quality_runs(id) ON DELETE CASCADE,
        rule_code TEXT NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
        field_name TEXT,
        message TEXT NOT NULL,
        sample_value TEXT
      );

      CREATE INDEX idx_quality_runs_source ON quality_runs(source_id, id DESC);
      CREATE INDEX idx_quality_issues_run ON quality_issues(run_id);
    `,
  },
];

export function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    database.prepare("SELECT version FROM schema_migrations").all().map((row) => row.version),
  );
  const recordMigration = database.prepare(
    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    database.exec("BEGIN IMMEDIATE;");
    try {
      database.exec(migration.sql);
      recordMigration.run(migration.version, migration.name, new Date().toISOString());
      database.exec("COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  }
}
