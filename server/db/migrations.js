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
  {
    version: 3,
    name: "create_data_contracts",
    sql: `
      CREATE TABLE data_contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
        version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(source_id, version)
      );

      CREATE TABLE contract_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_id INTEGER NOT NULL REFERENCES data_contracts(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        data_type TEXT NOT NULL,
        is_required INTEGER NOT NULL DEFAULT 0 CHECK (is_required IN (0, 1)),
        UNIQUE(contract_id, name)
      );

      CREATE INDEX idx_data_contracts_source ON data_contracts(source_id, id DESC);
      CREATE INDEX idx_contract_fields_contract ON contract_fields(contract_id);
    `,
  },
  {
    version: 4,
    name: "create_lineage_graph",
    sql: `
      CREATE TABLE lineage_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        node_type TEXT NOT NULL CHECK (node_type IN ('source', 'pipeline', 'table', 'rule', 'dashboard')),
        criticality TEXT NOT NULL DEFAULT 'medium' CHECK (criticality IN ('low', 'medium', 'high', 'critical')),
        created_at TEXT NOT NULL
      );

      CREATE TABLE lineage_edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_node_id INTEGER NOT NULL REFERENCES lineage_nodes(id) ON DELETE CASCADE,
        to_node_id INTEGER NOT NULL REFERENCES lineage_nodes(id) ON DELETE CASCADE,
        relation TEXT NOT NULL,
        UNIQUE(from_node_id, to_node_id, relation),
        CHECK(from_node_id <> to_node_id)
      );

      CREATE INDEX idx_lineage_edges_from ON lineage_edges(from_node_id);
      CREATE INDEX idx_lineage_edges_to ON lineage_edges(to_node_id);
    `,
  },
  {
    version: 6,
    name: "create_profile_history_and_rules",
    sql: `
      CREATE TABLE quality_rule_definitions (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
        description TEXT NOT NULL
      );

      INSERT INTO quality_rule_definitions (code, name, severity, description) VALUES
        ('REQUIRED_FIELD', 'Zorunlu alan', 'critical', 'Sözleşmede zorunlu tanımlanan alanların doluluğunu denetler.'),
        ('UNIQUE_KEY', 'Benzersiz anahtar', 'critical', 'Kimlik ve anahtar alanlarındaki tekrarları denetler.'),
        ('TYPE_CONSISTENCY', 'Tip tutarlılığı', 'warning', 'Gözlenen alan tipini veri sözleşmesiyle karşılaştırır.'),
        ('COMPLETENESS', 'Veri bütünlüğü', 'warning', 'Alanlardaki eksik değer oranını denetler.');

      CREATE TABLE profile_baselines (
        source_id INTEGER PRIMARY KEY REFERENCES data_sources(id) ON DELETE CASCADE,
        run_id INTEGER NOT NULL REFERENCES quality_runs(id) ON DELETE CASCADE,
        profile_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE profile_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
        run_id INTEGER NOT NULL REFERENCES quality_runs(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX idx_profile_events_source ON profile_events(source_id, id DESC);
      CREATE TRIGGER profile_events_no_update BEFORE UPDATE ON profile_events
      BEGIN SELECT RAISE(ABORT, 'profile events are append-only'); END;
      CREATE TRIGGER profile_events_no_delete BEFORE DELETE ON profile_events
      BEGIN SELECT RAISE(ABORT, 'profile events are append-only'); END;
    `,
  },
  {
    version: 7,
    name: "remove_legacy_preferences",
    sql: `
      DROP TABLE IF EXISTS user_preferences;
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
