export function seedDemoData(database) {
  const total = Number(database.prepare("SELECT count(*) AS total FROM data_sources").get().total);
  if (total > 0) {
    seedLineage(database);
    return;
  }

  const now = new Date().toISOString();
  const insertSource = database.prepare(
    "INSERT INTO data_sources (name, kind, owner, status, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  const insertRun = database.prepare(`
    INSERT INTO quality_runs
      (source_id, status, score, row_count, issue_count, started_at, completed_at, profile_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertIssue = database.prepare(`
    INSERT INTO quality_issues
      (run_id, rule_code, severity, field_name, message, sample_value)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  database.exec("BEGIN IMMEDIATE;");
  try {
    const transactions = Number(
      insertSource.run("Müşteri İşlem API'si", "REST / JSON", "Risk Platform", "healthy", now).lastInsertRowid,
    );
    const registry = Number(
      insertSource.run("Ticaret Sicil Akışı", "XML", "Data Intelligence", "warning", now).lastInsertRowid,
    );
    const cards = Number(
      insertSource.run("Kart Olayları", "JSON Stream", "Fraud Team", "healthy", now).lastInsertRowid,
    );

    insertRun.run(transactions, "passed", 97, 1842050, 1, now, now, JSON.stringify({ fields: 24, nullRate: 0.002 }));
    const registryRun = Number(
      insertRun.run(registry, "warning", 82, 48120, 3, now, now, JSON.stringify({ fields: 31, nullRate: 0.074 })).lastInsertRowid,
    );
    insertRun.run(cards, "passed", 94, 3912200, 1, now, now, JSON.stringify({ fields: 18, nullRate: 0.006 }));

    insertIssue.run(
      registryRun,
      "NULL_RATE_SPIKE",
      "critical",
      "company_tax_id",
      "Eksik vergi numarası oranı beklenen eşiğin üzerine çıktı.",
      "null",
    );
    insertIssue.run(
      registryRun,
      "SCHEMA_DRIFT",
      "warning",
      "announcement_date",
      "Tarih alanının biçimi ISO-8601 sözleşmesinden farklı.",
      "01.09.2026",
    );
    insertIssue.run(
      registryRun,
      "DUPLICATE_KEY",
      "warning",
      "registry_number",
      "Aynı sicil numarası birden fazla kayıtta gözlendi.",
      "TSG-20481",
    );
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
  seedLineage(database);
}

function seedLineage(database) {
  const total = Number(database.prepare("SELECT count(*) AS total FROM lineage_nodes").get().total);
  if (total > 0) return;
  const now = new Date().toISOString();
  const insertNode = database.prepare("INSERT INTO lineage_nodes (name, node_type, criticality, created_at) VALUES (?, ?, ?, ?)");
  const insertEdge = database.prepare("INSERT INTO lineage_edges (from_node_id, to_node_id, relation) VALUES (?, ?, ?)");
  database.exec("BEGIN IMMEDIATE;");
  try {
    const source = Number(insertNode.run("Ticaret Sicil Akışı", "source", "high", now).lastInsertRowid);
    const pipeline = Number(insertNode.run("Sicil Normalizasyonu", "pipeline", "high", now).lastInsertRowid);
    const table = Number(insertNode.run("Şirket Risk Tablosu", "table", "critical", now).lastInsertRowid);
    const rule = Number(insertNode.run("Vergi No Zorunluluğu", "rule", "medium", now).lastInsertRowid);
    const dashboard = Number(insertNode.run("Risk Operasyon Paneli", "dashboard", "high", now).lastInsertRowid);
    insertEdge.run(source, pipeline, "besler");
    insertEdge.run(pipeline, table, "üretir");
    insertEdge.run(table, rule, "denetlenir");
    insertEdge.run(table, dashboard, "gösterir");
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
