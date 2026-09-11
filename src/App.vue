<script setup>
import { computed, onMounted, ref, watch } from "vue";

const overview = ref(null);
const sources = ref([]);
const lineage = ref(null);
const impact = ref(null);
const loading = ref(true);
const analyzing = ref(false);
const error = ref("");
const feedback = ref("");
const analysis = ref(null);
const history = ref([]);
const selectedSourceId = ref(1);
const selectedFormat = ref("json");

const samples = {
  json: JSON.stringify([
    { customer_id: 1001, amount: 1250.5, registered_at: "2026-09-10" },
    { customer_id: 1002, amount: 980, registered_at: "2026-09-11" },
    { customer_id: 1003, amount: 1410, registered_at: "2026-09-11" },
  ], null, 2),
  csv: "registry_number,company_name,revenue\nTSG-1001,Atlas Teknoloji,1250000\nTSG-1002,Marmara Veri,980000\nTSG-1003,Anadolu Sistem,1410000",
  xml: "<records>\n  <record><customer_id>1001</customer_id><amount>1250.5</amount><registered_at>2026-09-10</registered_at></record>\n  <record><customer_id>1002</customer_id><amount>980</amount><registered_at>2026-09-11</registered_at></record>\n</records>",
};
const datasetContent = ref(samples.json);

const scoreTone = computed(() => {
  const score = overview.value?.qualityScore ?? 0;
  if (score >= 90) return "good";
  if (score >= 75) return "warning";
  return "critical";
});

const graphPositions = computed(() => {
  const order = ["source", "pipeline", "table", "rule", "dashboard"];
  const counts = new Map();
  return Object.fromEntries((lineage.value?.nodes ?? []).map((node) => {
    const column = order.indexOf(node.type);
    const row = counts.get(node.type) ?? 0;
    counts.set(node.type, row + 1);
    return [node.id, { x: 92 + Math.max(column, 0) * 188, y: 72 + row * 92 }];
  }));
});

function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDate(value) {
  if (!value) return "Henüz çalışmadı";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

async function request(path, options) {
  const response = await fetch(path, options);
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? "Veri kalite servisine ulaşılamadı.");
  return body;
}

async function loadDashboard() {
  loading.value = true;
  error.value = "";
  try {
    const [overviewResponse, sourcesResponse, lineageResponse] = await Promise.all([
      request("/api/quality/overview"), request("/api/data-sources"), request("/api/lineage"),
    ]);
    overview.value = overviewResponse.data;
    sources.value = sourcesResponse.data;
    lineage.value = lineageResponse.data;
    if (!sources.value.some((source) => source.id === selectedSourceId.value)) selectedSourceId.value = sources.value[0]?.id;
    const source = lineage.value.nodes.find((node) => node.type === "source");
    if (source && !impact.value) await loadImpact(source.id);
    await loadHistory();
  } catch (cause) {
    error.value = cause.message;
  } finally {
    loading.value = false;
  }
}

async function loadImpact(nodeId) {
  try { impact.value = (await request(`/api/lineage/${nodeId}/impact`)).data; }
  catch (cause) { error.value = cause.message; }
}

async function loadHistory() {
  if (!selectedSourceId.value) return;
  try { history.value = (await request(`/api/data-sources/${selectedSourceId.value}/history`)).data; }
  catch (cause) { error.value = cause.message; }
}

async function analyzeDataset() {
  analyzing.value = true;
  error.value = "";
  feedback.value = "";
  try {
    analysis.value = (await request(`/api/data-sources/${selectedSourceId.value}/analyze`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: selectedFormat.value, content: datasetContent.value }),
    })).data;
    feedback.value = `${analysis.value.profile.rowCount} kayıt analiz edildi; kalite puanı ${analysis.value.score}/100.`;
    await loadDashboard();
  } catch (cause) { error.value = cause.message; }
  finally { analyzing.value = false; }
}

async function promoteBaseline() {
  try {
    const result = (await request(`/api/data-sources/${selectedSourceId.value}/baseline`, { method: "POST" })).data;
    feedback.value = `${result.runId} numaralı çalışma yeni drift referansı yapıldı.`;
  } catch (cause) { error.value = cause.message; }
}

watch(selectedFormat, (format) => {
  datasetContent.value = samples[format];
  analysis.value = null;
  window.sessionStorage.setItem("datapulse-format", format);
});
watch(selectedSourceId, (sourceId) => {
  window.sessionStorage.setItem("datapulse-source", String(sourceId));
  loadHistory();
});
onMounted(() => {
  const savedFormat = window.sessionStorage.getItem("datapulse-format");
  if (samples[savedFormat]) selectedFormat.value = savedFormat;
  const savedSource = Number(window.sessionStorage.getItem("datapulse-source"));
  if (Number.isInteger(savedSource) && savedSource > 0) selectedSourceId.value = savedSource;
  loadDashboard();
});
</script>

<template>
  <main class="shell">
    <nav class="nav" aria-label="Ana navigasyon">
      <a class="brand" href="#top"><span class="brand-mark">DP</span><span>DataPulse <strong>Guardian</strong></span></a>
      <div class="nav-actions"><span class="system-state"><i></i> Sistem izleniyor</span><button type="button" @click="loadDashboard">Yenile</button></div>
    </nav>

    <header id="top" class="hero">
      <div><p class="eyebrow">VERİ KALİTESİ KOMUTA MERKEZİ</p><h1>Değişimi yakala.<br><em>Etkiyi yönet.</em></h1><p class="subtitle">CSV, JSON ve XML kaynaklarını profilleyin; kalite, şema ve dağılım değişikliklerini tek ekrandan izleyin.</p></div>
      <div v-if="overview" class="score-card" :class="`score-card--${scoreTone}`"><span>Genel kalite puanı</span><strong>{{ overview.qualityScore }}</strong><small>/ 100 · {{ overview.healthySourceCount }}/{{ overview.sourceCount }} kaynak sağlıklı</small></div>
    </header>

    <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
    <p v-if="feedback" class="notice notice--success" role="status">{{ feedback }}</p>
    <p v-if="loading" class="notice">Veri kaynakları hazırlanıyor...</p>

    <template v-else-if="overview">
      <section class="metrics" aria-label="Kalite özeti">
        <article><span>İzlenen kaynak</span><strong>{{ overview.sourceCount }}</strong><small>{{ overview.healthySourceCount }} sağlıklı</small></article>
        <article><span>Açık bulgu</span><strong>{{ overview.openIssueCount }}</strong><small>Önceliklendirme bekliyor</small></article>
        <article><span>İşlenen kayıt</span><strong>{{ formatNumber(overview.processedRowCount) }}</strong><small>Son profil çalıştırmaları</small></article>
      </section>

      <section class="grid">
        <article class="panel panel--sources">
          <div class="panel-heading"><div><p class="eyebrow">CANLI GÖRÜNÜM</p><h2>Veri kaynakları</h2></div><span>{{ sources.length }} bağlantı</span></div>
          <div class="source-list">
            <button v-for="source in sources" :key="source.id" type="button" class="source-row" :class="{ selected: source.id === selectedSourceId }" @click="selectedSourceId = source.id">
              <span class="source-icon" :class="`source-icon--${source.status}`">{{ source.kind.includes('XML') ? 'XM' : 'JS' }}</span>
              <span class="source-copy"><strong>{{ source.name }}</strong><small>{{ source.kind }} · {{ source.owner }}</small></span>
              <span class="source-run"><strong>{{ source.score }}</strong><small>{{ formatDate(source.lastRunAt) }}</small></span>
              <span class="status-pill" :class="`status-pill--${source.status}`">{{ source.status === 'healthy' ? 'Sağlıklı' : source.status === 'warning' ? 'İncele' : 'Kritik' }}</span>
            </button>
          </div>
        </article>

        <aside class="panel panel--issues">
          <div class="panel-heading"><div><p class="eyebrow">ÖNCELİKLİ</p><h2>Kalite bulguları</h2></div></div>
          <div class="issue-list">
            <article v-for="issue in overview.latestIssues" :key="issue.id" class="issue"><div class="issue-topline"><span :class="`severity severity--${issue.severity}`">{{ issue.severity }}</span><code>{{ issue.code }}</code></div><strong>{{ issue.sourceName }}</strong><p>{{ issue.message }}</p><small>Alan: {{ issue.field }}</small></article>
            <p v-if="overview.latestIssues.length === 0" class="empty">Açık kalite bulgusu yok.</p>
          </div>
        </aside>
      </section>

      <section class="panel analyzer-panel">
        <div class="panel-heading"><div><p class="eyebrow">CANLI PROFİL</p><h2>Veri setini analiz et</h2></div><span>CSV · JSON · XML</span></div>
        <div class="analyzer-grid">
          <form class="analyzer-form" @submit.prevent="analyzeDataset">
            <div class="form-row"><label>Veri kaynağı<select v-model.number="selectedSourceId"><option v-for="source in sources" :key="source.id" :value="source.id">{{ source.name }}</option></select></label><label>Biçim<select v-model="selectedFormat"><option value="json">JSON</option><option value="csv">CSV</option><option value="xml">XML</option></select></label></div>
            <label>Örnek veri<textarea v-model="datasetContent" rows="11" spellcheck="false"></textarea></label>
            <div class="button-row"><button class="primary" type="submit" :disabled="analyzing">{{ analyzing ? 'Analiz ediliyor…' : 'Analizi çalıştır' }}</button><button type="button" :disabled="history.length === 0" @click="promoteBaseline">Sonucu referans yap</button></div>
          </form>
          <div class="analysis-result" aria-live="polite">
            <template v-if="analysis"><div class="result-score"><span>Son kalite puanı</span><strong>{{ analysis.score }}</strong><small>{{ analysis.status }} · {{ analysis.profile.rowCount }} kayıt</small></div><dl><div><dt>Alan</dt><dd>{{ analysis.profile.fieldCount }}</dd></div><div><dt>Tekrar kayıt</dt><dd>{{ analysis.profile.duplicateRowCount }}</dd></div><div><dt>Kalite bulgusu</dt><dd>{{ analysis.issues.length }}</dd></div><div><dt>Drift bulgusu</dt><dd>{{ analysis.drift.length }}</dd></div></dl><div class="field-table"><div v-for="field in analysis.profile.fields" :key="field.name"><strong>{{ field.name }}</strong><span>{{ field.type }}</span><span>%{{ Math.round(field.nullRate * 100) }} eksik</span></div></div></template>
            <template v-else><p class="empty">Soldaki örnek veriyi çalıştırarak alan tiplerini, eksik değerleri, tekrarları ve drift sonucunu görün.</p><ol class="history-list"><li v-for="event in history.slice(0, 4)" :key="event.id"><strong>#{{ event.runId }} · {{ event.score }}/100</strong><span>{{ formatDate(event.createdAt) }} · {{ event.rowCount }} kayıt</span></li></ol></template>
          </div>
        </div>
      </section>

      <section v-if="lineage && impact" class="panel impact-panel">
        <div class="panel-heading"><div><p class="eyebrow">ETKİ ANALİZİ</p><h2>{{ impact.root.name }} değişirse</h2></div><span class="severity" :class="`severity--${impact.riskLevel === 'critical' ? 'critical' : 'warning'}`">{{ impact.riskLevel }} risk</span></div>
        <div class="impact-layout">
          <svg class="lineage-graph" viewBox="0 0 940 150" role="img" aria-label="Veri soy ağacı bağımlılık grafiği">
            <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
            <line v-for="edge in lineage.edges" :key="edge.id" :x1="graphPositions[edge.fromNodeId]?.x + 54" :y1="graphPositions[edge.fromNodeId]?.y" :x2="graphPositions[edge.toNodeId]?.x - 54" :y2="graphPositions[edge.toNodeId]?.y" marker-end="url(#arrow)" />
            <g v-for="node in lineage.nodes" :key="node.id" class="graph-node" :class="{ active: node.id === impact.root.id }" role="button" tabindex="0" @click="loadImpact(node.id)" @keydown.enter="loadImpact(node.id)"><rect :x="graphPositions[node.id]?.x - 58" :y="graphPositions[node.id]?.y - 26" width="116" height="52" rx="10" /><text :x="graphPositions[node.id]?.x" :y="graphPositions[node.id]?.y - 3">{{ node.name.slice(0, 16) }}</text><text class="node-type" :x="graphPositions[node.id]?.x" :y="graphPositions[node.id]?.y + 14">{{ node.type }}</text></g>
          </svg>
          <div class="impact-summary"><div><strong>{{ impact.blastRadius }}</strong><span>etkilenen bileşen</span></div><div><strong>{{ impact.riskScore }}/100</strong><span>risk puanı</span></div></div>
        </div>
        <ol class="impact-path"><li v-for="node in impact.affected" :key="node.id"><strong>{{ node.name }}</strong><span>{{ node.type }} · {{ node.depth }} adım · {{ node.criticality }}</span></li></ol>
      </section>

    </template>
  </main>
</template>
