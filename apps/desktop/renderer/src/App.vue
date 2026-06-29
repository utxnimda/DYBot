<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { BotEvent, HealthSnapshot } from "@dybot/contracts";

const health = ref<HealthSnapshot | null>(null);
const events = ref<BotEvent[]>([]);
const actionError = ref("");
const busy = ref(false);

const statusLabel = computed(() => health.value?.status ?? "idle");
const isRunning = computed(
  () => statusLabel.value === "running" || statusLabel.value === "starting",
);
const statusClass = computed(() => `status-dot status-${statusLabel.value}`);

let unsubscribe: (() => void) | undefined;

async function refreshHealth(): Promise<void> {
  health.value = await window.dybot.bot.getHealth();
}

async function runAction(action: "start" | "stop"): Promise<void> {
  busy.value = true;
  actionError.value = "";
  try {
    health.value =
      action === "start" ? await window.dybot.bot.start() : await window.dybot.bot.stop();
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : "操作失败";
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  await refreshHealth();
  unsubscribe = window.dybot.bot.onEvent((event) => {
    events.value = [event, ...events.value].slice(0, 40);
    if (event.type === "runtime.status") {
      health.value = event.payload;
    }
  });
});

onBeforeUnmount(() => {
  unsubscribe?.();
});
</script>

<template>
  <main class="shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">DY</span>
        <div>
          <h1>DYBot</h1>
          <p>桌面机器人助手</p>
        </div>
      </div>

      <nav class="nav-list" aria-label="主导航">
        <button class="nav-item active" type="button">总览</button>
        <button class="nav-item" type="button">弹幕</button>
        <button class="nav-item" type="button">AI</button>
        <button class="nav-item" type="button">语音</button>
        <button class="nav-item" type="button">日志</button>
      </nav>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div>
          <p class="eyebrow">Runtime</p>
          <h2>控制台</h2>
        </div>
        <div class="status-pill">
          <span :class="statusClass" />
          <span>{{ statusLabel }}</span>
        </div>
      </header>

      <section class="metrics-grid" aria-label="运行状态">
        <article class="metric-card">
          <span class="metric-label">斗鱼采集</span>
          <strong>待接入</strong>
          <small>Douyu capture</small>
        </article>
        <article class="metric-card">
          <span class="metric-label">AI 回复</span>
          <strong>待接入</strong>
          <small>AI pipeline</small>
        </article>
        <article class="metric-card">
          <span class="metric-label">TTS</span>
          <strong>待接入</strong>
          <small>Voice engine</small>
        </article>
        <article class="metric-card">
          <span class="metric-label">播放队列</span>
          <strong>0</strong>
          <small>Audio queue</small>
        </article>
      </section>

      <section class="panel-grid">
        <article class="panel runtime-panel">
          <div class="panel-heading">
            <h3>运行控制</h3>
            <span>{{
              health?.updatedAt ? new Date(health.updatedAt).toLocaleTimeString() : "--"
            }}</span>
          </div>
          <div class="runtime-actions">
            <button
              class="primary-button"
              type="button"
              :disabled="busy || isRunning"
              @click="runAction('start')"
            >
              启动
            </button>
            <button
              class="secondary-button"
              type="button"
              :disabled="busy || !isRunning"
              @click="runAction('stop')"
            >
              停止
            </button>
          </div>
          <p v-if="actionError" class="error-text">{{ actionError }}</p>
        </article>

        <article class="panel event-panel">
          <div class="panel-heading">
            <h3>事件流</h3>
            <span>{{ events.length }}</span>
          </div>
          <ol class="event-list">
            <li v-for="event in events" :key="`${event.traceId}-${event.type}`">
              <span>{{ event.type }}</span>
              <code>{{ event.traceId }}</code>
            </li>
            <li v-if="events.length === 0" class="empty-row">暂无事件</li>
          </ol>
        </article>
      </section>
    </section>
  </main>
</template>
