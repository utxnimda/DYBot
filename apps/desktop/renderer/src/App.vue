<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { BotEvent, DouyuRoomCaptureConfig, HealthSnapshot } from "@dybot/contracts";
import { getBotEventMetadata } from "@dybot/contracts";

type NavTab = "overview" | "danmaku" | "ai" | "voice" | "logs";

interface DetailRow {
  readonly label: string;
  readonly value: string | number;
}

const navItems: ReadonlyArray<{ readonly id: NavTab; readonly label: string }> = [
  { id: "overview", label: "总览" },
  { id: "danmaku", label: "弹幕" },
  { id: "ai", label: "AI" },
  { id: "voice", label: "语音" },
  { id: "logs", label: "日志" },
];

const activeTab = ref<NavTab>("overview");
const health = ref<HealthSnapshot | null>(null);
const events = ref<BotEvent[]>([]);
const actionError = ref("");
const douyuError = ref("");
const busy = ref(false);
const douyuBusy = ref(false);
const douyuRoom = ref("9999");
const defaultDouyuConfig = ref<DouyuRoomCaptureConfig | null>(null);
const douyuStatus = ref("idle");
const danmakuCount = ref(0);
const giftCount = ref(0);
const aiReplyCount = ref(0);
const voiceSynthesisCount = ref(0);
const audioPlaybackCount = ref(0);
const audioPlaybackStatus = ref("idle");

const statusLabel = computed(() => health.value?.status ?? "idle");
const isRunning = computed(
  () => statusLabel.value === "running" || statusLabel.value === "starting",
);
const statusClass = computed(() => `status-dot status-${statusLabel.value}`);
const douyuStatusClass = computed(() => `status-dot status-${douyuStatus.value}`);
const douyuConnected = computed(
  () =>
    douyuStatus.value === "connected" ||
    douyuStatus.value === "login_ok" ||
    douyuStatus.value === "joined_group" ||
    douyuStatus.value === "heartbeat",
);

const pageTitle = computed(
  () => navItems.find((item) => item.id === activeTab.value)?.label ?? "总览",
);
const visibleEvents = computed(() => {
  switch (activeTab.value) {
    case "danmaku":
      return events.value.filter(isDouyuFeedEvent);
    case "ai":
      return events.value.filter(isAiEvent);
    case "voice":
      return events.value.filter(isVoiceOrAudioEvent);
    case "logs":
    case "overview":
      return events.value;
  }
});
const eventPanelTitle = computed(() => {
  switch (activeTab.value) {
    case "danmaku":
      return "弹幕事件";
    case "ai":
      return "AI 事件";
    case "voice":
      return "语音事件";
    case "logs":
      return "运行日志";
    case "overview":
      return "事件流";
  }
});
const detailPanelTitle = computed(() => {
  switch (activeTab.value) {
    case "danmaku":
      return "斗鱼采集";
    case "ai":
      return "AI 状态";
    case "voice":
      return "语音状态";
    case "logs":
      return "运行状态";
    case "overview":
      return "运行控制";
  }
});
const detailRows = computed<readonly DetailRow[]>(() => {
  switch (activeTab.value) {
    case "danmaku":
      return [
        { label: "房间", value: douyuRoom.value || "--" },
        { label: "采集", value: douyuStatus.value },
        { label: "弹幕", value: danmakuCount.value },
        { label: "礼物", value: giftCount.value },
      ];
    case "ai":
      return [
        { label: "回复", value: aiReplyCount.value },
        { label: "跳过", value: countEvents(["ai.reply.skipped"]) },
        { label: "失败", value: countEvents(["ai.reply.failed"]) },
        { label: "Runtime", value: statusLabel.value },
      ];
    case "voice":
      return [
        { label: "TTS", value: voiceSynthesisCount.value },
        { label: "播放", value: audioPlaybackCount.value },
        { label: "播放状态", value: audioPlaybackStatus.value },
        { label: "失败", value: countEvents(["voice.synthesis.failed", "audio.playback.failed"]) },
      ];
    case "logs":
      return [
        { label: "Runtime", value: statusLabel.value },
        { label: "事件", value: events.value.length },
        {
          label: "更新",
          value: health.value?.updatedAt
            ? new Date(health.value.updatedAt).toLocaleTimeString()
            : "--",
        },
      ];
    case "overview":
      return [];
  }
});

let unsubscribe: (() => void) | undefined;

async function refreshHealth(): Promise<void> {
  health.value = await window.dybot.bot.getHealth();
}

async function loadDefaultDouyuConfig(): Promise<void> {
  defaultDouyuConfig.value = await window.dybot.bot.douyu.getDefaultRoom();
  douyuRoom.value = defaultDouyuConfig.value.roomId;
}

async function runAction(action: "start" | "stop"): Promise<void> {
  busy.value = true;
  actionError.value = "";
  try {
    health.value =
      action === "start" ? await window.dybot.bot.start() : await window.dybot.bot.stop();
    if (action === "stop") {
      douyuStatus.value = "idle";
    }
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : "操作失败";
  } finally {
    busy.value = false;
  }
}

async function startDouyuCapture(): Promise<void> {
  douyuBusy.value = true;
  douyuError.value = "";
  try {
    const roomId = douyuRoom.value.trim();
    const baseConfig = defaultDouyuConfig.value ?? (await window.dybot.bot.douyu.getDefaultRoom());
    const config: DouyuRoomCaptureConfig = {
      roomId,
      host: baseConfig.host,
      port: baseConfig.port,
      groupId: baseConfig.groupId,
      heartbeatIntervalMs: baseConfig.heartbeatIntervalMs,
      reconnect: { ...baseConfig.reconnect },
    };
    health.value = await window.dybot.bot.douyu.start(config);
    douyuStatus.value = "connecting";
  } catch (error) {
    douyuError.value = error instanceof Error ? error.message : "斗鱼采集启动失败";
  } finally {
    douyuBusy.value = false;
  }
}

async function stopDouyuCapture(): Promise<void> {
  douyuBusy.value = true;
  douyuError.value = "";
  try {
    health.value = await window.dybot.bot.douyu.stop();
    douyuStatus.value = "idle";
  } catch (error) {
    douyuError.value = error instanceof Error ? error.message : "斗鱼采集停止失败";
  } finally {
    douyuBusy.value = false;
  }
}

function onBotEvent(event: BotEvent): void {
  events.value = [event, ...events.value].slice(0, 80);
  if (event.type === "runtime.status") {
    health.value = event.payload;
    return;
  }

  if (event.type === "douyu.danmaku") {
    danmakuCount.value += 1;
    return;
  }

  if (event.type === "douyu.gift") {
    giftCount.value += 1;
    return;
  }

  if (event.type === "ai.reply.generated") {
    aiReplyCount.value += 1;
    return;
  }

  if (event.type === "voice.synthesis.generated") {
    voiceSynthesisCount.value += 1;
    return;
  }

  if (event.type === "audio.playback.started") {
    audioPlaybackStatus.value = "playing";
    return;
  }

  if (event.type === "audio.playback.finished") {
    audioPlaybackCount.value += 1;
    audioPlaybackStatus.value = "done";
    return;
  }

  if (event.type === "audio.playback.failed") {
    audioPlaybackStatus.value = "failed";
    return;
  }

  if (event.type === "audio.playback.skipped") {
    audioPlaybackStatus.value = "skipped";
    return;
  }

  if (event.type === "douyu.room_status") {
    douyuStatus.value = event.payload.status;
    return;
  }

  if (event.type === "douyu.capture_error") {
    douyuStatus.value = "error";
    douyuError.value = event.payload.message;
  }
}

function eventKey(event: BotEvent): string {
  return getBotEventMetadata(event).stableId;
}

function eventSummary(event: BotEvent): string {
  switch (event.type) {
    case "runtime.status":
      return `runtime ${event.payload.status}`;
    case "log.entry":
      return event.payload.message;
    case "douyu.danmaku": {
      const nickname = event.payload.user.nickname ?? event.payload.user.userId ?? "匿名";
      return `${nickname}: ${event.payload.text}`;
    }
    case "douyu.gift": {
      const nickname = event.payload.user.nickname ?? event.payload.user.userId ?? "匿名";
      const giftName = event.payload.giftName ?? event.payload.giftId ?? "礼物";
      return `${nickname} 送出 ${giftName} x${event.payload.count}`;
    }
    case "douyu.user_entered":
      return `${event.payload.user.nickname ?? event.payload.user.userId ?? "用户"} 进入直播间`;
    case "douyu.room_status":
      return event.payload.message ?? `room ${event.payload.status}`;
    case "douyu.capture_error":
      return event.payload.message;
    case "ai.reply.generated":
      return `AI reply: ${event.payload.result.text}`;
    case "ai.reply.failed":
      return `AI reply failed: ${event.payload.error.message}`;
    case "ai.reply.skipped":
      return `AI reply skipped: ${event.payload.reason}`;
    case "voice.synthesis.generated":
      return `Voice generated: ${event.payload.result.text}`;
    case "voice.synthesis.failed":
      return `Voice failed: ${event.payload.error.message}`;
    case "voice.synthesis.skipped":
      return `Voice skipped: ${event.payload.reason}`;
    case "audio.playback.started":
      return `Audio started: ${event.payload.outputDeviceId}`;
    case "audio.playback.finished":
      return `Audio finished: ${event.payload.result.outputDeviceId}`;
    case "audio.playback.failed":
      return `Audio failed: ${event.payload.error.message}`;
    case "audio.playback.skipped":
      return `Audio skipped: ${event.payload.reason}`;
  }
}

function eventTime(event: BotEvent): string {
  return new Date(getBotEventMetadata(event).occurredAt).toLocaleTimeString();
}

function isDouyuFeedEvent(event: BotEvent): boolean {
  return (
    event.type === "douyu.danmaku" ||
    event.type === "douyu.gift" ||
    event.type === "douyu.user_entered" ||
    event.type === "douyu.room_status" ||
    event.type === "douyu.capture_error"
  );
}

function isAiEvent(event: BotEvent): boolean {
  return (
    event.type === "ai.reply.generated" ||
    event.type === "ai.reply.failed" ||
    event.type === "ai.reply.skipped"
  );
}

function isVoiceOrAudioEvent(event: BotEvent): boolean {
  return event.type.startsWith("voice.") || event.type.startsWith("audio.");
}

function countEvents(types: readonly BotEvent["type"][]): number {
  return events.value.filter((event) => types.includes(event.type)).length;
}

onMounted(async () => {
  await Promise.all([refreshHealth(), loadDefaultDouyuConfig()]);
  unsubscribe = window.dybot.bot.onEvent(onBotEvent);
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
        <button
          v-for="item in navItems"
          :key="item.id"
          :class="['nav-item', { active: activeTab === item.id }]"
          type="button"
          :aria-current="activeTab === item.id ? 'page' : undefined"
          @click="activeTab = item.id"
        >
          {{ item.label }}
        </button>
      </nav>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div>
          <p class="eyebrow">Runtime</p>
          <h2>{{ pageTitle }}</h2>
        </div>
        <div class="status-pill">
          <span :class="statusClass" />
          <span>{{ statusLabel }}</span>
        </div>
      </header>

      <section class="metrics-grid" aria-label="运行状态">
        <article class="metric-card">
          <span class="metric-label">斗鱼采集</span>
          <strong>{{ douyuStatus }}</strong>
          <small>Room {{ douyuRoom || "--" }}</small>
        </article>
        <article class="metric-card">
          <span class="metric-label">弹幕</span>
          <strong>{{ danmakuCount }}</strong>
          <small>Danmaku</small>
        </article>
        <article class="metric-card">
          <span class="metric-label">礼物</span>
          <strong>{{ giftCount }}</strong>
          <small>Gifts</small>
        </article>
        <article class="metric-card">
          <span class="metric-label">AI</span>
          <strong>{{ aiReplyCount }}</strong>
          <small>Replies</small>
        </article>
        <article class="metric-card">
          <span class="metric-label">语音</span>
          <strong>{{ voiceSynthesisCount }}</strong>
          <small>TTS</small>
        </article>
        <article class="metric-card">
          <span class="metric-label">播放</span>
          <strong>{{ audioPlaybackCount }}</strong>
          <small>{{ audioPlaybackStatus }}</small>
        </article>
      </section>

      <section class="panel-grid">
        <article v-if="activeTab === 'overview'" class="panel runtime-panel">
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

        <article v-else class="panel detail-panel">
          <div class="panel-heading">
            <h3>{{ detailPanelTitle }}</h3>
            <span>{{ visibleEvents.length }}</span>
          </div>
          <dl class="detail-grid">
            <div v-for="row in detailRows" :key="row.label">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>
        </article>

        <article
          v-if="activeTab === 'overview' || activeTab === 'danmaku'"
          class="panel douyu-panel"
        >
          <div class="panel-heading">
            <h3>斗鱼采集</h3>
            <span class="inline-status"><span :class="douyuStatusClass" />{{ douyuStatus }}</span>
          </div>
          <label class="field-label" for="douyu-room">房间号</label>
          <div class="douyu-form">
            <input id="douyu-room" v-model="douyuRoom" class="room-input" inputmode="numeric" />
            <button
              class="primary-button"
              type="button"
              :disabled="douyuBusy || douyuConnected || !douyuRoom.trim()"
              @click="startDouyuCapture"
            >
              连接
            </button>
            <button
              class="secondary-button"
              type="button"
              :disabled="douyuBusy || !douyuConnected"
              @click="stopDouyuCapture"
            >
              断开
            </button>
          </div>
          <p v-if="douyuError" class="error-text">{{ douyuError }}</p>
        </article>

        <article class="panel event-panel">
          <div class="panel-heading">
            <h3>{{ eventPanelTitle }}</h3>
            <span>{{ visibleEvents.length }}</span>
          </div>
          <ol class="event-list">
            <li v-for="event in visibleEvents" :key="eventKey(event)">
              <div>
                <span>{{ event.type }}</span>
                <p>{{ eventSummary(event) }}</p>
              </div>
              <code>{{ eventTime(event) }}</code>
            </li>
            <li v-if="visibleEvents.length === 0" class="empty-row">暂无事件</li>
          </ol>
        </article>
      </section>
    </section>
  </main>
</template>
