<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type {
  BotEvent,
  DouyuEvent,
  DouyuRoomCaptureConfig,
  HealthSnapshot,
} from "@dybot/contracts";

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
  if (isDouyuEvent(event)) {
    return `${event.payload.eventId}-${event.traceId}`;
  }

  return `${event.type}-${event.traceId}`;
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
  }
}

function eventTime(event: BotEvent): string {
  if (isDouyuEvent(event)) {
    return new Date(event.payload.receivedAt).toLocaleTimeString();
  }

  if (event.type === "runtime.status") {
    return new Date(event.payload.updatedAt).toLocaleTimeString();
  }

  return "--";
}

function isDouyuEvent(event: BotEvent): event is DouyuEvent {
  return event.type.startsWith("douyu.");
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

        <article class="panel douyu-panel">
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
            <h3>事件流</h3>
            <span>{{ events.length }}</span>
          </div>
          <ol class="event-list">
            <li v-for="event in events" :key="eventKey(event)">
              <div>
                <span>{{ event.type }}</span>
                <p>{{ eventSummary(event) }}</p>
              </div>
              <code>{{ eventTime(event) }}</code>
            </li>
            <li v-if="events.length === 0" class="empty-row">暂无事件</li>
          </ol>
        </article>
      </section>
    </section>
  </main>
</template>
