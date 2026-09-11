import { createApp } from "./app.js";
import { openDatabase } from "./db/database.js";
import { migrate } from "./db/migrations.js";
import { seedDemoData } from "./db/demoSeed.js";
import { SqliteQualityRepository } from "./repositories/sqliteQualityRepository.js";
import { SqliteContractRepository } from "./repositories/sqliteContractRepository.js";
import { SqliteLineageRepository } from "./repositories/sqliteLineageRepository.js";
import { SqliteTaskRepository } from "./repositories/sqliteTaskRepository.js";
import { SqlitePreferenceRepository } from "./repositories/sqlitePreferenceRepository.js";
import { SqliteAnalysisRepository } from "./repositories/sqliteAnalysisRepository.js";

const port = Number(process.env.PORT ?? 3000);
const database = openDatabase();
migrate(database);
seedDemoData(database);

const taskRepository = new SqliteTaskRepository(database);
const qualityRepository = new SqliteQualityRepository(database);
const contractRepository = new SqliteContractRepository(database);
const lineageRepository = new SqliteLineageRepository(database);
const preferenceRepository = new SqlitePreferenceRepository(database);
const analysisRepository = new SqliteAnalysisRepository(database);
if (taskRepository.count() === 0) {
  const foundation = taskRepository.create({ title: "Node.js ve Express temelini tamamla" });
  taskRepository.update(foundation.id, { status: "done" });
  taskRepository.create({ title: "Veritabanı katmanını ekle" });
}

createApp({ taskRepository, qualityRepository, contractRepository, lineageRepository, preferenceRepository, analysisRepository }).listen(port, "0.0.0.0", () => {
  console.log(`API http://127.0.0.1:${port} adresinde çalışıyor.`);
});
