import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../server/app.js";
import { openDatabase } from "../server/db/database.js";
import { migrate } from "../server/db/migrations.js";
import { seedDemoData } from "../server/db/demoSeed.js";
import { SqliteQualityRepository } from "../server/repositories/sqliteQualityRepository.js";
import { SqliteContractRepository } from "../server/repositories/sqliteContractRepository.js";
import { SqliteLineageRepository } from "../server/repositories/sqliteLineageRepository.js";
import { SqliteTaskRepository } from "../server/repositories/sqliteTaskRepository.js";
import { SqliteAnalysisRepository } from "../server/repositories/sqliteAnalysisRepository.js";

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
  const lineageRepository = new SqliteLineageRepository(database);
  const analysisRepository = new SqliteAnalysisRepository(database);
  server = createApp({ taskRepository, qualityRepository, contractRepository, lineageRepository, analysisRepository }).listen(0, "127.0.0.1");
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

test("lineage impact recursively finds downstream components and scores risk", async () => {
  const graph = await fetch(`${baseUrl}/api/lineage`);
  const source = (await graph.json()).data.nodes.find((node) => node.type === "source");
  const response = await fetch(`${baseUrl}/api/lineage/${source.id}/impact`);
  const impact = (await response.json()).data;
  assert.equal(response.status, 200);
  assert.equal(impact.blastRadius, 4);
  assert.equal(impact.riskScore, 100);
  assert.equal(impact.riskLevel, "critical");
  assert.deepEqual(impact.affected.map((node) => node.name), [
    "Sicil Normalizasyonu", "Şirket Risk Tablosu", "Vergi No Zorunluluğu", "Risk Operasyon Paneli",
  ]);
  assert.equal(impact.affected[2].depth, 3);
});

test("unknown lineage node returns the standard not-found error", async () => {
  const response = await fetch(`${baseUrl}/api/lineage/999/impact`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "LINEAGE_NODE_NOT_FOUND");
});

test("security response headers are present", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-powered-by"), null);
});

test("CSV input is parsed and profiled", async () => {
  const response = await fetch(`${baseUrl}/api/data-sources/2/analyze`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "csv", content: 'registry_number,company_name,revenue\nTSG-1,"Atlas, AŞ",120\nTSG-2,,180' }),
  });
  const result = (await response.json()).data;
  assert.equal(response.status, 201);
  assert.equal(result.profile.rowCount, 2);
  assert.equal(result.profile.fields.find((field) => field.name === "company_name").nullCount, 1);
  assert.equal(result.baselineCreated, true);
});

test("JSON analysis runs four quality rules and detects distribution drift", async () => {
  const sourceId = 3;
  const baseline = await fetch(`${baseUrl}/api/data-sources/${sourceId}/analyze`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "json", content: JSON.stringify([
      { event_id: 1, amount: 10, device: "mobile" },
      { event_id: 2, amount: 12, device: "web" },
    ]) }),
  });
  assert.equal(baseline.status, 201);
  const changed = await fetch(`${baseUrl}/api/data-sources/${sourceId}/analyze`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "json", content: JSON.stringify([
      { event_id: 1, amount: 50, device: null },
      { event_id: 1, amount: 60, device: null },
    ]) }),
  });
  const result = (await changed.json()).data;
  assert.equal(result.issues.some((issue) => issue.ruleCode === "UNIQUE_KEY"), true);
  assert.equal(result.issues.some((issue) => issue.ruleCode === "COMPLETENESS"), true);
  assert.equal(result.drift.some((item) => item.field === "amount" && item.metric === "mean"), true);
  assert.equal(result.status, "failed");
  assert.ok(result.score < 80);
});

test("XML input and append-only profile history work", async () => {
  const response = await fetch(`${baseUrl}/api/data-sources/1/analyze`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "xml", content: "<records><record><customer_id>1</customer_id><registered_at>2026-09-11</registered_at></record><record><customer_id>2</customer_id><registered_at>2026-09-12</registered_at></record></records>" }),
  });
  assert.equal(response.status, 201);
  const history = await fetch(`${baseUrl}/api/data-sources/1/history`);
  const events = (await history.json()).data;
  assert.ok(events.length >= 1);
  assert.equal(events[0].type, "profile_completed");
  assert.throws(() => database.prepare("UPDATE profile_events SET event_type = 'changed' WHERE id = ?").run(events[0].id), /append-only/);
});

test("invalid dataset returns the standard validation error", async () => {
  const response = await fetch(`${baseUrl}/api/data-sources/1/analyze`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "json", content: "not-json" }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "DATASET_VALIDATION_ERROR");
});

test("latest profile can be promoted as a new drift baseline", async () => {
  const response = await fetch(`${baseUrl}/api/data-sources/3/baseline`, { method: "POST" });
  const baseline = (await response.json()).data;
  assert.equal(response.status, 200);
  assert.equal(baseline.profile.rowCount, 2);
});
