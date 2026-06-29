import { encodeDouyuPacket } from "./packet";
import { serializeStt } from "./stt";

export function createLoginRequest(roomId: string): string {
  return serializeStt({ type: "loginreq", roomid: roomId });
}

export function createJoinGroupRequest(roomId: string, groupId = "-9999"): string {
  return serializeStt({ type: "joingroup", rid: roomId, gid: groupId });
}

export function createHeartbeatRequest(): string {
  return serializeStt({ type: "mrkl" });
}

export function createLogoutRequest(): string {
  return serializeStt({ type: "logout" });
}

export function encodeDouyuClientCommand(command: string): Buffer {
  return encodeDouyuPacket(command);
}
