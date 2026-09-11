const missingValues = new Set(["", "null", "undefined", "n/a", "na"]);

export class DatasetValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "DatasetValidationError";
  }
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizeValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return missingValues.has(trimmed.toLowerCase()) ? null : trimmed;
}

function csvRows(content) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"') {
      if (quoted && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new DatasetValidationError("CSV içindeki tırnak işaretleri dengeli değil.");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) throw new DatasetValidationError("CSV başlık ve en az bir veri satırı içermelidir.");

  const headers = rows[0].map((header) => header.trim());
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) {
    throw new DatasetValidationError("CSV sütun başlıkları boş olamaz ve benzersiz olmalıdır.");
  }
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, normalizeValue(values[index])])));
}

function jsonRows(content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new DatasetValidationError("JSON içeriği geçerli değil.");
  }
  const rows = Array.isArray(parsed) ? parsed : parsed?.records;
  if (!Array.isArray(rows) || rows.length === 0 || rows.some((row) => !row || Array.isArray(row) || typeof row !== "object")) {
    throw new DatasetValidationError("JSON bir nesne dizisi veya records dizisi içermelidir.");
  }
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeValue(value)])));
}

function xmlRows(content) {
  const cleaned = content.replace(/<\?xml[\s\S]*?\?>/i, "").trim();
  const rowMatches = [...cleaned.matchAll(/<(record|row|item)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)];
  if (rowMatches.length === 0) {
    throw new DatasetValidationError("XML içeriği record, row veya item elemanları içermelidir.");
  }
  return rowMatches.map((match) => {
    const entries = [...match[2].matchAll(/<([A-Za-z_][\w.-]*)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)]
      .map((field) => [field[1], normalizeValue(decodeXml(field[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")).trim())]);
    if (entries.length === 0) throw new DatasetValidationError("XML kayıtlarında alan bulunamadı.");
    return Object.fromEntries(entries);
  });
}

export function parseDataset(format, content) {
  if (typeof content !== "string" || !content.trim()) throw new DatasetValidationError("Analiz edilecek içerik zorunludur.");
  const normalizedFormat = String(format ?? "").trim().toLowerCase();
  if (normalizedFormat === "csv") return csvRows(content);
  if (normalizedFormat === "json") return jsonRows(content);
  if (normalizedFormat === "xml") return xmlRows(content);
  throw new DatasetValidationError("Desteklenen biçimler CSV, JSON ve XML'dir.");
}

function valueType(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number" && Number.isFinite(value)) return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "string") {
    if (/^-?\d+$/.test(value)) return "integer";
    if (/^-?\d+(\.\d+)?$/.test(value)) return "number";
    if (/^(true|false)$/i.test(value)) return "boolean";
    if (/^\d{4}-\d{2}-\d{2}(?:T[\d:.+-]+Z?)?$/.test(value) && !Number.isNaN(Date.parse(value))) return value.includes("T") ? "datetime" : "date";
  }
  return "string";
}

function dominantType(values) {
  const counts = new Map();
  for (const value of values) {
    const type = valueType(value);
    if (type !== "null") counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "null";
}

export function createProfile(rows) {
  const fieldNames = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort();
  const fields = fieldNames.map((name) => {
    const values = rows.map((row) => normalizeValue(row[name]));
    const present = values.filter((value) => value !== null);
    const type = dominantType(values);
    const numeric = present.map(Number).filter(Number.isFinite);
    return {
      name,
      type,
      nullCount: values.length - present.length,
      nullRate: Number(((values.length - present.length) / values.length).toFixed(4)),
      uniqueCount: new Set(present.map((value) => JSON.stringify(value))).size,
      duplicateCount: present.length - new Set(present.map((value) => JSON.stringify(value))).size,
      ...(numeric.length ? {
        min: Math.min(...numeric),
        max: Math.max(...numeric),
        mean: Number((numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(4)),
      } : {}),
    };
  });
  const serializedRows = rows.map((row) => JSON.stringify(row));
  return {
    rowCount: rows.length,
    fieldCount: fields.length,
    duplicateRowCount: serializedRows.length - new Set(serializedRows).size,
    fields,
  };
}

function contractTypeMatches(expected, actual) {
  const aliases = { int: "integer", float: "number", double: "number", decimal: "number", bool: "boolean", timestamp: "datetime" };
  const normalizedExpected = aliases[expected.toLowerCase()] ?? expected.toLowerCase();
  if (normalizedExpected === actual) return true;
  return normalizedExpected === "number" && actual === "integer";
}

export function evaluateQuality(rows, profile, contract) {
  const issues = [];
  const byName = new Map(profile.fields.map((field) => [field.name, field]));
  const requiredFields = contract?.fields?.filter((field) => field.required) ?? [];

  for (const field of requiredFields) {
    const stats = byName.get(field.name);
    if (!stats || stats.nullCount > 0) {
      issues.push({
        ruleCode: "REQUIRED_FIELD", severity: "critical", fieldName: field.name,
        message: `${field.name} zorunlu olmasına rağmen ${stats ? stats.nullCount : rows.length} kayıtta eksik.`, sampleValue: null,
      });
    }
  }

  const keyField = profile.fields.find((field) => /(^id$|_id$|_key$|number$)/i.test(field.name));
  if (keyField && keyField.duplicateCount > 0) {
    issues.push({
      ruleCode: "UNIQUE_KEY", severity: "critical", fieldName: keyField.name,
      message: `${keyField.name} alanında ${keyField.duplicateCount} tekrar eden anahtar bulundu.`, sampleValue: null,
    });
  }

  for (const field of contract?.fields ?? []) {
    const stats = byName.get(field.name);
    if (stats && stats.type !== "null" && !contractTypeMatches(field.type, stats.type)) {
      issues.push({
        ruleCode: "TYPE_CONSISTENCY", severity: "warning", fieldName: field.name,
        message: `${field.name} için ${field.type} beklenirken ${stats.type} gözlendi.`, sampleValue: null,
      });
    }
  }

  for (const stats of profile.fields.filter((field) => field.nullRate >= 0.2)) {
    issues.push({
      ruleCode: "COMPLETENESS", severity: stats.nullRate >= 0.5 ? "critical" : "warning", fieldName: stats.name,
      message: `${stats.name} alanının eksik değer oranı %${Math.round(stats.nullRate * 100)}.`, sampleValue: null,
    });
  }

  return issues;
}

export function detectDrift(profile, baseline) {
  if (!baseline) return [];
  const previousFields = new Map((baseline.fields ?? []).map((field) => [field.name, field]));
  const drift = [];
  for (const field of profile.fields) {
    const previous = previousFields.get(field.name);
    if (!previous) {
      drift.push({ field: field.name, metric: "new_field", previous: null, current: field.type, changeRate: null });
      continue;
    }
    const nullDelta = Math.abs(field.nullRate - previous.nullRate);
    if (nullDelta >= 0.15) drift.push({ field: field.name, metric: "null_rate", previous: previous.nullRate, current: field.nullRate, changeRate: Number(nullDelta.toFixed(4)) });
    if (Number.isFinite(field.mean) && Number.isFinite(previous.mean)) {
      const meanDelta = Math.abs(field.mean - previous.mean) / Math.max(Math.abs(previous.mean), 1);
      if (meanDelta >= 0.25) drift.push({ field: field.name, metric: "mean", previous: previous.mean, current: field.mean, changeRate: Number(meanDelta.toFixed(4)) });
    }
    if (field.type !== previous.type) drift.push({ field: field.name, metric: "type", previous: previous.type, current: field.type, changeRate: null });
  }
  for (const field of previousFields.values()) {
    if (!profile.fields.some((current) => current.name === field.name)) drift.push({ field: field.name, metric: "removed_field", previous: field.type, current: null, changeRate: null });
  }
  return drift;
}

export function scoreQuality(issues, drift) {
  const issuePenalty = issues.reduce((total, issue) => total + ({ critical: 20, warning: 8, info: 2 }[issue.severity] ?? 0), 0);
  return Math.max(0, 100 - issuePenalty - Math.min(20, drift.length * 5));
}
