import cors from "cors";
import express from "express";

const allowedStatuses = new Set(["todo", "doing", "done"]);

export function createApp({ taskRepository, qualityRepository }) {
  if (!taskRepository) throw new Error("taskRepository zorunludur.");
  if (!qualityRepository) throw new Error("qualityRepository zorunludur.");

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok", service: "datapulse-guardian" });
  });

  app.get("/api/quality/overview", (_request, response) => {
    response.json({ data: qualityRepository.overview() });
  });

  app.get("/api/data-sources", (_request, response) => {
    response.json({ data: qualityRepository.listSources() });
  });

  app.get("/api/tasks", (_request, response) => {
    response.json({ data: taskRepository.list() });
  });

  app.post("/api/tasks", (request, response) => {
    const title = request.body?.title;
    if (typeof title !== "string" || title.trim().length < 3) {
      return response.status(400).json({ error: "Başlık en az 3 karakter olmalı." });
    }

    return response.status(201).json({ data: taskRepository.create({ title }) });
  });

  app.patch("/api/tasks/:id", (request, response) => {
    const id = Number(request.params.id);
    const { title, status } = request.body ?? {};

    if (status !== undefined && !allowedStatuses.has(status)) {
      return response.status(400).json({ error: "Geçersiz görev durumu." });
    }
    if (title !== undefined && (typeof title !== "string" || title.trim().length < 3)) {
      return response.status(400).json({ error: "Başlık en az 3 karakter olmalı." });
    }

    const task = taskRepository.update(id, { title, status });
    if (!task) return response.status(404).json({ error: "Görev bulunamadı." });
    return response.json({ data: task });
  });

  app.delete("/api/tasks/:id", (request, response) => {
    const removed = taskRepository.remove(Number(request.params.id));
    if (!removed) return response.status(404).json({ error: "Görev bulunamadı." });
    return response.status(204).end();
  });

  return app;
}
