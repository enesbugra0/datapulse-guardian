<script setup>
import { computed, onMounted, ref } from "vue";

const overview = ref(null);
const sources = ref([]);
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
    const [overviewResponse, sourcesResponse] = await Promise.all([
      request("/api/quality/overview"),
      request("/api/data-sources"),
    ]);
    overview.value = overviewResponse.data;
    sources.value = sourcesResponse.data;
  } catch (cause) {
    error.value = cause.message;
  } finally {
    loading.value = false;
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
    </template>
  </main>
</template>
