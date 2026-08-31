function toTask(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteTaskRepository {
  constructor(database) {
    this.database = database;
    this.statements = {
      count: database.prepare("SELECT count(*) AS total FROM tasks"),
      list: database.prepare("SELECT * FROM tasks ORDER BY id DESC"),
      find: database.prepare("SELECT * FROM tasks WHERE id = ?"),
      create: database.prepare(
        "INSERT INTO tasks (title, status, created_at) VALUES (?, 'todo', ?)",
      ),
      update: database.prepare(
        "UPDATE tasks SET title = ?, status = ?, updated_at = ? WHERE id = ?",
      ),
      remove: database.prepare("DELETE FROM tasks WHERE id = ?"),
    };
  }

  count() {
    return Number(this.statements.count.get().total);
  }

  list() {
    return this.statements.list.all().map(toTask);
  }

  find(id) {
    return toTask(this.statements.find.get(id));
  }

  create({ title }) {
    const result = this.statements.create.run(title.trim(), new Date().toISOString());
    return this.find(Number(result.lastInsertRowid));
  }

  update(id, input) {
    const current = this.find(id);
    if (!current) return null;

    this.statements.update.run(
      input.title?.trim() ?? current.title,
      input.status ?? current.status,
      new Date().toISOString(),
      id,
    );
    return this.find(id);
  }

  remove(id) {
    return this.statements.remove.run(id).changes > 0;
  }
}
