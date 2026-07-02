export type TraceId = `trace_${string}`;
export type EventId = `evt_${string}`;
export type TaskId = `task_${string}`;
export type ProfileId = `profile_${string}`;
export type AudioAssetId = `asset_${string}`;

function randomIdPart(): string {
  return globalThis.crypto.randomUUID().replaceAll("-", "");
}

export function createTraceId(): TraceId {
  return `trace_${randomIdPart()}`;
}

export function createEventId(): EventId {
  return `evt_${randomIdPart()}`;
}

export function createTaskId(): TaskId {
  return `task_${randomIdPart()}`;
}

export function createAudioAssetId(): AudioAssetId {
  return `asset_${randomIdPart()}`;
}
