export const douyuReplayRoomId = "9999";

export const douyuReplaySttFixtures = [
  {
    expectedType: "douyu.danmaku",
    receivedAt: 1_782_800_000_000,
    stt: "type@=chatmsg/rid@=9999/uid@=42/nn@=tester/txt@=hello from replay/cid@=msg_storage_runtime_danmaku/",
  },
  {
    expectedType: "douyu.gift",
    receivedAt: 1_782_800_000_100,
    stt: "type@=dgb/rid@=9999/uid@=43/nn@=gifter/gfid@=20003/gfn@=rocket/gfcnt@=2/",
  },
  {
    expectedType: "douyu.user_entered",
    receivedAt: 1_782_800_000_200,
    stt: "type@=uenter/rid@=9999/uid@=44/nn@=visitor/",
  },
  {
    expectedType: "douyu.room_status",
    receivedAt: 1_782_800_000_300,
    stt: "type@=loginres/rid@=9999/",
  },
] as const;

export const douyuReplayCaptureErrorFixture = {
  receivedAt: 1_782_800_000_400,
  code: "socket_error",
  message: "fake capture socket error",
  recoverable: true,
} as const;
