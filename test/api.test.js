import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../server/app.js";
import { openDatabase } from "../server/db/database.js";
import { migrate } from "../server/db/migrations.js";
import { seedDemoData } from "../server/db/demoSeed.js";
import { SqliteQualityRepository } from "../server/repositories/sqliteQualityRepository.js";
import { SqliteContractRepository } from "../server/repositories/sqliteContractRepository.js";
import { SqliteTaskRepository } from "../server/repositories/sqliteTaskRepository.js";

let server;
let baseUrl;
let database;

before(async () => {
  database = openDatabase(":memory:");
  migrate(database);
  seedDemoData(database);
  const taskRepository = new SqliteTaskRepository(database);
  const qualityRepository = new SqliteQualityRepository(database);
  const contractRepository = new SqliteContractRepository(database);
  server = createApp({ taskRepository, qualityRepository, contractRepository }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  database.close();
});

test("health endpoint reports service status", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    service: "datapulse-guardian",
  });
});

test("task lifecycle works through REST endpoints", async () => {
  const createdResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "REST servisini test et" }),
  });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).data;

  const updatedResponse = await fetch(`${baseUrl}/api/tasks/${created.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "done" }),
  });
  assert.equal((await updatedResponse.json()).data.status, "done");

  const deletedResponse = await fetch(`${baseUrl}/api/tasks/${created.id}`, { method: "DELETE" });
  assert.equal(deletedResponse.status, 204);
});

test("invalid task input returns a useful validation error", async () => {
  const response = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "x" }),
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error.code, "TASK_VALIDATION_ERROR");
  assert.match(body.error.message, /3 karakter/);
});

test("SQLite repository keeps data between repository instances", () => {
  const first = new SqliteTaskRepository(database);
  const task = first.create({ title: "Kalıcı veri katmanını doğrula" });
  const second = new SqliteTaskRepository(database);
  assert.equal(second.find(task.id).title, "Kalıcı veri katmanını doğrula");
});

test("quality overview exposes score, source and issue metrics", async () => {
  const response = await fetch(`${baseUrl}/api/quality/overview`);
  assert.equal(response.status, 200);
  const overview = (await response.json()).data;
  assert.equal(overview.sourceCount, 3);
  assert.equal(overview.qualityScore, 91);
  assert.equal(overview.latestIssues[0].severity, "critical");
});

test("data source endpoint returns latest profiling result", async () => {
  const response = await fetch(`${baseUrl}/api/data-sources`);
  const sources = (await response.json()).data;
  assert.equal(sources.length, 3);
  assert.equal(sources[1].name, "Ticaret Sicil Akışı");
  assert.equal(sources[1].issueCount, 3);
});

test("data contract versions report added, removed and changed fields", async () => {
  const sourceId = 1;
  const first = await fetch(`${baseUrl}/api/data-sources/${sourceId}/contracts`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: "1.0.0", fields: [
      { name: "customer_id", type: "integer", required: true },
      { name: "email", type: "string", required: false },
    ] }),
  });
  assert.equal(first.status, 201);
  const second = await fetch(`${baseUrl}/api/data-sources/${sourceId}/contracts`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: "1.1.0", fields: [
      { name: "customer_id", type: "string", required: true },
      { name: "registered_at", type: "datetime", required: true },
    ] }),
  });
  const result = (await second.json()).data;
  assert.equal(second.status, 201);
  assert.deepEqual(result.changes.added.map((field) => field.name), ["registered_at"]);
  assert.deepEqual(result.changes.removed.map((field) => field.name), ["email"]);
  assert.equal(result.changes.changed[0].name, "customer_id");
  assert.equal(result.changes.hasChanges, true);
});

test("contract validation uses the standard REST error shape", async () => {
  const response = await fetch(`${baseUrl}/api/data-sources/1/contracts`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: "", fields: [] }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual((await response.json()).error.code, "CONTRACT_VALIDATION_ERROR");
});
