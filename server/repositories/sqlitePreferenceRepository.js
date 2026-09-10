const allowedKeys = new Set(["notificationsEnabled", "refreshIntervalSeconds"]);

export class SqlitePreferenceRepository {
  constructor(database) {
    this.getStatement = database.prepare("SELECT preference_value FROM user_preferences WHERE preference_key = ?");
    this.upsertStatement = database.prepare(`
      INSERT INTO user_preferences (preference_key, preference_value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET preference_value = excluded.preference_value, updated_at = excluded.updated_at
    `);
  }

  getAll() {
    return {
      notificationsEnabled: this.get("notificationsEnabled", true),
      refreshIntervalSeconds: this.get("refreshIntervalSeconds", 60),
    };
  }

  get(key, fallback) {
    const row = this.getStatement.get(key);
    return row ? JSON.parse(row.preference_value) : fallback;
  }

  update(values) {
    for (const [key, value] of Object.entries(values)) {
      if (!allowedKeys.has(key) || value === undefined) continue;
      this.upsertStatement.run(key, JSON.stringify(value), new Date().toISOString());
    }
    return this.getAll();
  }
}
