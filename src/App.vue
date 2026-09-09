<script setup>
import { computed, onMounted, ref } from "vue";

const overview = ref(null);
const sources = ref([]);
const lineage = ref(null);
const impact = ref(null);
const loading = ref(true);
const error = ref("");

const scoreTone = computed(() => {
  const score = overview.value?.qualityScore ?? 0;
  if (score >= 90) return "good";
  if (score >= 75) return "warning";
  return "critical";
});

function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDate(value) {
  if (!value) return "Henüz çalışmadı";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function request(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Veri kalite servisine ulaşılamadı.");
  return response.json();
}

async function loadDashboard() {
  loading.value = true;
  error.value = "";
  try {
    const [overviewResponse, sourcesResponse, lineageResponse] = await Promise.all([
      request("/api/quality/overview"),
      request("/api/data-sources"),
      request("/api/lineage"),
    ]);
    overview.value = overviewResponse.data;
    sources.value = sourcesResponse.data;
    lineage.value = lineageResponse.data;
    const source = lineage.value.nodes.find((node) => node.type === "source");
    if (source) await loadImpact(source.id);
  } catch (cause) {
    error.value = cause.message;
  } finally {
    loading.value = false;
  }
}

async function loadImpact(nodeId) {
  try {
    impact.value = (await request(`/api/lineage/${nodeId}/impact`)).data;
  } catch (cause) {
    error.value = cause.message;
  }
}

onMounted(loadDashboard);
</script>

<template>
  <main class="shell">
    <nav class="nav" aria-label="Ana navigasyon">
      <a class="brand" href="#">
        <span class="brand-mark">DP</span>
        <span>DataPulse <strong>Guardian</strong></span>
      </a>
      <div class="nav-actions">
        <span class="system-state"><i></i> Sistem izleniyor</span>
        <button type="button" @click="loadDashboard">Yenile</button>
      </div>
    </nav>

    <header class="hero">
      <div>
        <p class="eyebrow">VERİ KALİTESİ KOMUTA MERKEZİ</p>
        <h1>Veri değiştiğinde<br><em>ilk sen bil.</em></h1>
        <p class="subtitle">Şema kaymalarını, kalite sorunlarını ve etkilenecek veri ürünlerini üretime ulaşmadan önce görünür kıl.</p>
      </div>
      <div v-if="overview" class="score-card" :class="`score-card--${scoreTone}`">
        <span>Genel kalite puanı</span>
        <strong>{{ overview.qualityScore }}</strong>
        <small>/ 100 · {{ overview.healthySourceCount }}/{{ overview.sourceCount }} kaynak sağlıklı</small>
      </div>
    </header>

    <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
    <p v-if="loading" class="notice">Veri kaynakları profilleniyor...</p>

    <template v-else-if="overview">
      <section class="metrics" aria-label="Kalite özeti">
        <article>
          <span>İzlenen kaynak</span>
          <strong>{{ overview.sourceCount }}</strong>
          <small>{{ overview.healthySourceCount }} sağlıklı</small>
        </article>
        <article>
          <span>Açık bulgu</span>
          <strong>{{ overview.openIssueCount }}</strong>
          <small>Önceliklendirme bekliyor</small>
        </article>
        <article>
          <span>İşlenen kayıt</span>
          <strong>{{ formatNumber(overview.processedRowCount) }}</strong>
          <small>Son profil çalıştırmaları</small>
        </article>
      </section>

      <section class="grid">
        <article class="panel panel--sources">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">CANLI GÖRÜNÜM</p>
              <h2>Veri kaynakları</h2>
            </div>
            <span>{{ sources.length }} bağlantı</span>
          </div>

          <div class="source-list">
            <div v-for="source in sources" :key="source.id" class="source-row">
              <span class="source-icon" :class="`source-icon--${source.status}`">{{ source.kind.includes('XML') ? 'XM' : 'JS' }}</span>
              <div class="source-copy">
                <strong>{{ source.name }}</strong>
                <small>{{ source.kind }} · {{ source.owner }}</small>
              </div>
              <div class="source-run">
                <strong>{{ source.score }}</strong>
                <small>{{ formatDate(source.lastRunAt) }}</small>
              </div>
              <span class="status-pill" :class="`status-pill--${source.status}`">
                {{ source.status === 'healthy' ? 'Sağlıklı' : source.status === 'warning' ? 'İncele' : 'Kritik' }}
              </span>
            </div>
          </div>
        </article>

        <aside class="panel panel--issues">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">ÖNCELİKLİ</p>
              <h2>Kalite bulguları</h2>
            </div>
          </div>

          <div class="issue-list">
            <article v-for="issue in overview.latestIssues" :key="issue.id" class="issue">
              <div class="issue-topline">
                <span :class="`severity severity--${issue.severity}`">{{ issue.severity }}</span>
                <code>{{ issue.code }}</code>
              </div>
              <strong>{{ issue.sourceName }}</strong>
              <p>{{ issue.message }}</p>
              <small>Alan: {{ issue.field }}</small>
            </article>
          </div>
        </aside>
      </section>

      <section v-if="lineage && impact" class="panel impact-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">ETKİ ANALİZİ</p>
            <h2>{{ impact.root.name }} değişirse</h2>
          </div>
          <span class="severity" :class="`severity--${impact.riskLevel === 'critical' ? 'critical' : 'warning'}`">{{ impact.riskLevel }} risk</span>
        </div>
        <div class="impact-summary">
          <strong>{{ impact.blastRadius }}</strong><span>etkilenen bileşen</span>
          <strong>{{ impact.riskScore }}/100</strong><span>risk puanı</span>
        </div>
        <div class="lineage-actions" aria-label="Etki analizi başlangıç bileşeni">
          <button v-for="node in lineage.nodes" :key="node.id" type="button" :class="{ active: node.id === impact.root.id }" @click="loadImpact(node.id)">{{ node.name }}</button>
        </div>
        <ol class="impact-path">
          <li v-for="node in impact.affected" :key="node.id"><strong>{{ node.name }}</strong><span>{{ node.type }} · {{ node.depth }} adım · {{ node.criticality }}</span></li>
        </ol>
      </section>
    </template>
  </main>
</template>
