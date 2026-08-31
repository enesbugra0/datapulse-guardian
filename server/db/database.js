import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(filename = process.env.DEVFLOW_DB_PATH ?? "data/devflow.db") {
  const target = filename === ":memory:" ? filename : resolve(filename);
  if (target !== ":memory:") mkdirSync(dirname(target), { recursive: true });

  const database = new DatabaseSync(target);
  database.exec("PRAGMA foreign_keys = ON;");
  if (target !== ":memory:") database.exec("PRAGMA journal_mode = WAL;");
  return database;
}
