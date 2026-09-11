import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createProfile, DatasetValidationError, detectDrift, evaluateQuality, parseDataset, scoreQuality } from "./services/dataProfiler.js";

const allowedStatuses = new Set(["todo", "doing", "done"]);

function error(response, status, code, message, details) {
  return response.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

function validContract(body) {
  if (typeof body?.version !== "string" || !body.version.trim()) return "Sözleşme sürümü zorunludur.";
  if (!Array.isArray(body.fields) || body.fields.length === 0) return "En az bir alan tanımlanmalıdır.";
  const names = new Set();
  for (const field of body.fields) {
    if (!field || typeof field.name !== "string" || !field.name.trim() || typeof field.type !== "string" || !field.type.trim()) {
      return "Her alan için ad ve tip zorunludur.";
    }
    if (names.has(field.name)) return "Alan adları sözleşme içinde benzersiz olmalıdır.";
    names.add(field.name);
  }
  return null;
}

export function createApp({ taskRepository, qualityRepository, contractRepository, lineageRepository, analysisRepository }) {
  if (!taskRepository) throw new Error("taskRepository zorunludur.");
  if (!qualityRepository) throw new Error("qualityRepository zorunludur.");
  if (!contractRepository) throw new Error("contractRepository zorunludur.");
  if (!lineageRepository) throw new Error("lineageRepository zorunludur.");
  if (!analysisRepository) throw new Error("analysisRepository zorunludur.");

  const app = express();
  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use((_request, response, next) => {
    response.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'",
    });
    next();
  });

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok", service: "datapulse-guardian" });
  });

  app.get("/api/quality/overview", (_request, response) => {
    response.json({ data: qualityRepository.overview() });
  });

  app.get("/api/data-sources", (_request, response) => {
    response.json({ data: qualityRepository.listSources() });
  });

  app.get("/api/lineage", (_request, response) => {
    response.json({ data: lineageRepository.graph() });
  });

  app.get("/api/lineage/:id/impact", (request, response) => {
    const nodeId = Number(request.params.id);
    if (!Number.isInteger(nodeId)) return error(response, 400, "LINEAGE_NODE_VALIDATION_ERROR", "Geçerli bir bileşen kimliği zorunludur.");
    const impact = lineageRepository.impact(nodeId);
    if (!impact) return error(response, 404, "LINEAGE_NODE_NOT_FOUND", "Veri soy ağacı bileşeni bulunamadı.");
    return response.json({ data: impact });
  });

  app.get("/api/data-sources/:id/contracts/latest", (request, response) => {
    const sourceId = Number(request.params.id);
    if (!Number.isInteger(sourceId) || !contractRepository.sourceExists(sourceId)) {
      return error(response, 404, "SOURCE_NOT_FOUND", "Veri kaynağı bulunamadı.");
    }
    const contract = contractRepository.getLatest(sourceId);
    if (!contract) return error(response, 404, "CONTRACT_NOT_FOUND", "Bu kaynak için sözleşme bulunamadı.");
    return response.json({ data: contract });
  });

  app.post("/api/data-sources/:id/contracts", (request, response) => {
    const sourceId = Number(request.params.id);
    if (!Number.isInteger(sourceId) || !contractRepository.sourceExists(sourceId)) {
      return error(response, 404, "SOURCE_NOT_FOUND", "Veri kaynağı bulunamadı.");
    }
    const validationMessage = validContract(request.body);
    if (validationMessage) return error(response, 400, "CONTRACT_VALIDATION_ERROR", validationMessage);
    try {
      const result = contractRepository.create(sourceId, {
        version: request.body.version.trim(),
        fields: request.body.fields.map((field) => ({
          name: field.name.trim(), type: field.type.trim(), required: field.required === true,
        })),
      });
      return response.status(201).json({ data: result });
    } catch (cause) {
      if (cause?.code === "ERR_SQLITE_CONSTRAINT_UNIQUE") {
        return error(response, 409, "CONTRACT_VERSION_EXISTS", "Bu sözleşme sürümü zaten kayıtlı.");
      }
      throw cause;
    }
  });

  app.post("/api/data-sources/:id/analyze", (request, response) => {
    const sourceId = Number(request.params.id);
    if (!Number.isInteger(sourceId) || !analysisRepository.sourceExists(sourceId)) {
      return error(response, 404, "SOURCE_NOT_FOUND", "Veri kaynağı bulunamadı.");
    }
    try {
      const format = String(request.body?.format ?? "").toLowerCase();
      const rows = parseDataset(format, request.body?.content);
      const profile = createProfile(rows);
      const contract = contractRepository.getLatest(sourceId);
      const issues = evaluateQuality(rows, profile, contract);
      const baseline = analysisRepository.baseline(sourceId);
      const drift = detectDrift(profile, baseline?.profile);
      const score = scoreQuality(issues, drift);
      const run = analysisRepository.save(sourceId, { format, profile, issues, drift, score });
      return response.status(201).json({
        data: { sourceId, format, score, profile, issues, drift, baseline: baseline ?? null, ...run },
      });
    } catch (cause) {
      if (cause instanceof DatasetValidationError) return error(response, 400, "DATASET_VALIDATION_ERROR", cause.message);
      throw cause;
    }
  });

  app.get("/api/data-sources/:id/history", (request, response) => {
    const sourceId = Number(request.params.id);
    if (!Number.isInteger(sourceId) || !analysisRepository.sourceExists(sourceId)) {
      return error(response, 404, "SOURCE_NOT_FOUND", "Veri kaynağı bulunamadı.");
    }
    return response.json({ data: analysisRepository.history(sourceId) });
  });

  app.post("/api/data-sources/:id/baseline", (request, response) => {
    const sourceId = Number(request.params.id);
    if (!Number.isInteger(sourceId) || !analysisRepository.sourceExists(sourceId)) {
      return error(response, 404, "SOURCE_NOT_FOUND", "Veri kaynağı bulunamadı.");
    }
    const baseline = analysisRepository.promoteLatest(sourceId);
    if (!baseline) return error(response, 409, "PROFILE_NOT_FOUND", "Referans yapılabilecek bir profil çalıştırması yok.");
    return response.json({ data: baseline });
  });

  app.get("/api/tasks", (_request, response) => {
    response.json({ data: taskRepository.list() });
  });

  app.post("/api/tasks", (request, response) => {
    const title = request.body?.title;
    if (typeof title !== "string" || title.trim().length < 3) {
      return error(response, 400, "TASK_VALIDATION_ERROR", "Başlık en az 3 karakter olmalı.");
    }

    return response.status(201).json({ data: taskRepository.create({ title }) });
  });

  app.patch("/api/tasks/:id", (request, response) => {
    const id = Number(request.params.id);
    const { title, status } = request.body ?? {};

    if (status !== undefined && !allowedStatuses.has(status)) {
      return error(response, 400, "TASK_VALIDATION_ERROR", "Geçersiz görev durumu.");
    }
    if (title !== undefined && (typeof title !== "string" || title.trim().length < 3)) {
      return error(response, 400, "TASK_VALIDATION_ERROR", "Başlık en az 3 karakter olmalı.");
    }

    const task = taskRepository.update(id, { title, status });
    if (!task) return error(response, 404, "TASK_NOT_FOUND", "Görev bulunamadı.");
    return response.json({ data: task });
  });

  app.delete("/api/tasks/:id", (request, response) => {
    const removed = taskRepository.remove(Number(request.params.id));
    if (!removed) return error(response, 404, "TASK_NOT_FOUND", "Görev bulunamadı.");
    return response.status(204).end();
  });

  const clientPath = resolve("dist");
  if (existsSync(clientPath)) {
    app.use(express.static(clientPath));
    app.get(/^(?!\/api\/).*/, (_request, response) => response.sendFile(resolve(clientPath, "index.html")));
  }

  app.use((cause, _request, response, _next) => {
    console.error(cause);
    return error(response, 500, "INTERNAL_ERROR", "Beklenmeyen bir sunucu hatası oluştu.");
  });

  return app;
}
