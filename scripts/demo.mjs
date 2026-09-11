import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { openDatabase } from "../server/db/database.js";
import { migrate } from "../server/db/migrations.js";
import { seedDemoData } from "../server/db/demoSeed.js";
import { SqliteAnalysisRepository } from "../server/repositories/sqliteAnalysisRepository.js";
import { SqliteContractRepository } from "../server/repositories/sqliteContractRepository.js";
import { SqliteLineageRepository } from "../server/repositories/sqliteLineageRepository.js";
import { SqlitePreferenceRepository } from "../server/repositories/sqlitePreferenceRepository.js";
import { SqliteQualityRepository } from "../server/repositories/sqliteQualityRepository.js";
import { SqliteTaskRepository } from "../server/repositories/sqliteTaskRepository.js";

const database = openDatabase(":memory:");
migrate(database);
seedDemoData(database);
const repositories = {
  taskRepository: new SqliteTaskRepository(database),
  qualityRepository: new SqliteQualityRepository(database),
  contractRepository: new SqliteContractRepository(database),
  lineageRepository: new SqliteLineageRepository(database),
  preferenceRepository: new SqlitePreferenceRepository(database),
  analysisRepository: new SqliteAnalysisRepository(database),
};
const server = createApp(repositories).listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

try {
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);

  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /DataPulse Guardian/);

  const analyze = await fetch(`${baseUrl}/api/data-sources/2/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      format: "csv",
      content: "registry_number,company_name,revenue\nTSG-1,Atlas,100\nTSG-2,Marmara,120",
    }),
  });
  const result = (await analyze.json()).data;
  assert.equal(analyze.status, 201);
  assert.equal(result.profile.rowCount, 2);
  assert.equal(result.score, 100);

  const history = (await (await fetch(`${baseUrl}/api/data-sources/2/history`)).json()).data;
  assert.equal(history[0].runId, result.runId);
  assert.equal(history[0].type, "profile_completed");

  const impact = (await (await fetch(`${baseUrl}/api/lineage/1/impact`)).json()).data;
  assert.equal(impact.blastRadius, 4);
  console.log("Uçtan uca demo başarılı: arayüz, analiz, geçmiş ve etki API'leri doğrulandı.");
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  database.close();
}
