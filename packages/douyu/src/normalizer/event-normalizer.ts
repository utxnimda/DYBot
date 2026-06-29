import {
  DouyuRawMessageSchema,
  createEventId,
  createTraceId,
  type DouyuCaptureErrorEvent,
  type DouyuDanmakuEvent,
  type DouyuEvent,
  type DouyuGiftEvent,
  type DouyuRawMessage,
  type DouyuRoomStatusEvent,
  type DouyuUser,
  type DouyuUserEnteredEvent,
} from "@dybot/contracts";

export interface NormalizeDouyuMessageInput {
  readonly roomId: string;
  readonly raw: DouyuRawMessage;
  readonly receivedAt?: number | undefined;
}

export interface CreateDouyuRoomStatusInput {
  readonly roomId: string;
  readonly status: DouyuRoomStatusEvent["payload"]["status"];
  readonly message?: string | undefined;
  readonly raw?: DouyuRawMessage | undefined;
  readonly receivedAt?: number | undefined;
}

export interface CreateDouyuCaptureErrorInput {
  readonly roomId: string;
  readonly code: DouyuCaptureErrorEvent["payload"]["code"];
  readonly message: string;
  readonly recoverable: boolean;
  readonly raw?: DouyuRawMessage | undefined;
  readonly receivedAt?: number | undefined;
}

const giftTypes = new Set(["dgb", "gfcnt", "spbc"]);

export function normalizeDouyuMessage(input: NormalizeDouyuMessageInput): DouyuEvent | null {
  const raw = DouyuRawMessageSchema.parse(input.raw);
  const rawType = firstString(raw.type);

  if (rawType === undefined) {
    throw new Error("Douyu message is missing type");
  }

  if (rawType === "chatmsg") {
    return createDanmakuEvent(input.roomId, rawType, raw, input.receivedAt);
  }

  if (giftTypes.has(rawType)) {
    return createGiftEvent(input.roomId, rawType, raw, input.receivedAt);
  }

  if (rawType === "uenter") {
    return createUserEnteredEvent(input.roomId, rawType, raw, input.receivedAt);
  }

  if (rawType === "loginres") {
    return createDouyuRoomStatusEvent({
      roomId: resolveRoomId(input.roomId, raw),
      status: "login_ok",
      raw,
      receivedAt: input.receivedAt,
    });
  }

  if (rawType === "mrkl" || rawType === "keeplive") {
    return createDouyuRoomStatusEvent({
      roomId: resolveRoomId(input.roomId, raw),
      status: "heartbeat",
      raw,
      receivedAt: input.receivedAt,
    });
  }

  return null;
}

export function createDouyuRoomStatusEvent(
  input: CreateDouyuRoomStatusInput,
): DouyuRoomStatusEvent {
  const raw = input.raw ?? { type: "client_status" };
  const payload: DouyuRoomStatusEvent["payload"] = {
    eventId: createEventId(),
    receivedAt: input.receivedAt ?? Date.now(),
    roomId: input.roomId,
    rawType: firstString(raw.type) ?? "client_status",
    raw,
    status: input.status,
  };

  if (input.message !== undefined) {
    payload.message = input.message;
  }

  return {
    type: "douyu.room_status",
    traceId: createTraceId(),
    payload,
  };
}

export function createDouyuCaptureErrorEvent(
  input: CreateDouyuCaptureErrorInput,
): DouyuCaptureErrorEvent {
  const raw = input.raw ?? { type: "client_error" };

  return {
    type: "douyu.capture_error",
    traceId: createTraceId(),
    payload: {
      eventId: createEventId(),
      receivedAt: input.receivedAt ?? Date.now(),
      roomId: input.roomId,
      rawType: firstString(raw.type) ?? "client_error",
      raw,
      code: input.code,
      message: input.message,
      recoverable: input.recoverable,
    },
  };
}

function createDanmakuEvent(
  fallbackRoomId: string,
  rawType: string,
  raw: DouyuRawMessage,
  receivedAt?: number,
): DouyuDanmakuEvent {
  const payload: DouyuDanmakuEvent["payload"] = {
    eventId: createEventId(),
    receivedAt: receivedAt ?? Date.now(),
    roomId: resolveRoomId(fallbackRoomId, raw),
    rawType,
    raw,
    text: firstString(raw.txt) ?? "",
    user: createUser(raw),
  };
  const messageId = firstString(raw.cid, raw.cst, raw.mid);

  if (messageId !== undefined) {
    payload.messageId = messageId;
  }

  return {
    type: "douyu.danmaku",
    traceId: createTraceId(),
    payload,
  };
}

function createGiftEvent(
  fallbackRoomId: string,
  rawType: string,
  raw: DouyuRawMessage,
  receivedAt?: number,
): DouyuGiftEvent {
  const payload: DouyuGiftEvent["payload"] = {
    eventId: createEventId(),
    receivedAt: receivedAt ?? Date.now(),
    roomId: resolveRoomId(fallbackRoomId, raw),
    rawType,
    raw,
    count: toPositiveInt(firstString(raw.gfcnt, raw.hits, raw.cnt, raw.gc), 1),
    user: createUser(raw),
  };
  const giftId = firstString(raw.gfid, raw.giftid, raw.gid);
  const giftName = firstString(raw.gfn, raw.giftName, raw.giftname);
  const totalCount = toOptionalPositiveInt(firstString(raw.hits, raw.gfcnt));
  const coinType = firstString(raw.ct, raw.coinType);
  const coinAmount = toOptionalNumber(firstString(raw.price, raw.pc, raw.bdl));

  if (giftId !== undefined) {
    payload.giftId = giftId;
  }

  if (giftName !== undefined) {
    payload.giftName = giftName;
  }

  if (totalCount !== undefined) {
    payload.totalCount = totalCount;
  }

  if (coinType !== undefined) {
    payload.coinType = coinType;
  }

  if (coinAmount !== undefined) {
    payload.coinAmount = coinAmount;
  }

  return {
    type: "douyu.gift",
    traceId: createTraceId(),
    payload,
  };
}

function createUserEnteredEvent(
  fallbackRoomId: string,
  rawType: string,
  raw: DouyuRawMessage,
  receivedAt?: number,
): DouyuUserEnteredEvent {
  return {
    type: "douyu.user_entered",
    traceId: createTraceId(),
    payload: {
      eventId: createEventId(),
      receivedAt: receivedAt ?? Date.now(),
      roomId: resolveRoomId(fallbackRoomId, raw),
      rawType,
      raw,
      user: createUser(raw),
    },
  };
}

function createUser(raw: DouyuRawMessage): DouyuUser {
  const user: DouyuUser = {};
  const userId = firstString(raw.uid);
  const nickname = firstString(raw.nn, raw.nickname);
  const level = toOptionalNonNegativeInt(firstString(raw.level, raw.lv));
  const badgeName = firstString(raw.bnn, raw.badgeName);
  const badgeLevel = toOptionalNonNegativeInt(firstString(raw.bl, raw.badgeLevel));

  if (userId !== undefined) {
    user.userId = userId;
  }

  if (nickname !== undefined) {
    user.nickname = nickname;
  }

  if (level !== undefined) {
    user.level = level;
  }

  if (badgeName !== undefined) {
    user.badgeName = badgeName;
  }

  if (badgeLevel !== undefined) {
    user.badgeLevel = badgeLevel;
  }

  return user;
}

function resolveRoomId(fallbackRoomId: string, raw: DouyuRawMessage): string {
  return firstString(raw.rid, raw.roomid) ?? fallbackRoomId;
}

function firstString(...values: readonly (string | undefined)[]): string | undefined {
  for (const value of values) {
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = toOptionalPositiveInt(value);
  return parsed ?? fallback;
}

function toOptionalPositiveInt(value: string | undefined): number | undefined {
  const parsed = toOptionalNumber(value);

  if (parsed === undefined || !Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function toOptionalNonNegativeInt(value: string | undefined): number | undefined {
  const parsed = toOptionalNumber(value);

  if (parsed === undefined || !Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

function toOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
