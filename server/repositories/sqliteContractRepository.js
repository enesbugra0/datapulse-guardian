function toContract(row, fields) {
  if (!row) return null;
  return {
    id: Number(row.id),
    sourceId: Number(row.source_id),
    version: row.version,
    createdAt: row.created_at,
    fields: fields.map((field) => ({
      name: field.name,
      type: field.data_type,
      required: Boolean(field.is_required),
    })),
  };
}

export class SqliteContractRepository {
  constructor(database) {
    this.database = database;
    this.findSource = database.prepare("SELECT id FROM data_sources WHERE id = ?");
    this.latestContract = database.prepare(
      "SELECT * FROM data_contracts WHERE source_id = ? ORDER BY id DESC LIMIT 1",
    );
    this.findContract = database.prepare("SELECT * FROM data_contracts WHERE source_id = ? AND version = ?");
    this.fieldsFor = database.prepare("SELECT * FROM contract_fields WHERE contract_id = ? ORDER BY name");
    this.insertContract = database.prepare(
      "INSERT INTO data_contracts (source_id, version, created_at) VALUES (?, ?, ?)",
    );
    this.insertField = database.prepare(
      "INSERT INTO contract_fields (contract_id, name, data_type, is_required) VALUES (?, ?, ?, ?)",
    );
  }

  sourceExists(sourceId) {
    return Boolean(this.findSource.get(sourceId));
  }

  getLatest(sourceId) {
    const contract = this.latestContract.get(sourceId);
    return toContract(contract, contract ? this.fieldsFor.all(contract.id) : []);
  }

  create(sourceId, { version, fields }) {
    const previous = this.getLatest(sourceId);
    const now = new Date().toISOString();
    this.database.exec("BEGIN IMMEDIATE;");
    try {
      const contractId = Number(this.insertContract.run(sourceId, version, now).lastInsertRowid);
      for (const field of fields) {
        this.insertField.run(contractId, field.name, field.type, field.required ? 1 : 0);
      }
      this.database.exec("COMMIT;");
      const current = toContract(this.findContract.get(sourceId, version), this.fieldsFor.all(contractId));
      return { contract: current, changes: compareFields(previous?.fields ?? [], current.fields) };
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }
  }
}

export function compareFields(previous, current) {
  const oldByName = new Map(previous.map((field) => [field.name, field]));
  const newByName = new Map(current.map((field) => [field.name, field]));
  const added = current.filter((field) => !oldByName.has(field.name));
  const removed = previous.filter((field) => !newByName.has(field.name));
  const changed = current.flatMap((field) => {
    const old = oldByName.get(field.name);
    if (!old || (old.type === field.type && old.required === field.required)) return [];
    return [{ name: field.name, previous: old, current: field }];
  });
  return { added, removed, changed, hasChanges: added.length + removed.length + changed.length > 0 };
}
