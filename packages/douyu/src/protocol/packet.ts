import { DouyuProtocolError } from "./errors";

export const DOUYU_CLIENT_MESSAGE_TYPE = 689;
export const DOUYU_SERVER_MESSAGE_TYPE = 690;
export const DOUYU_PACKET_HEADER_BYTES = 12;
export const DOUYU_MAX_PACKET_BYTES = 1024 * 1024;

export interface DouyuPacket {
  readonly messageType: number;
  readonly payload: Buffer;
  readonly text: string;
}

export interface DouyuPacketDecodeResult {
  readonly packets: readonly DouyuPacket[];
  readonly remaining: Buffer;
}

export function encodeDouyuPacket(
  payload: string | Buffer,
  messageType = DOUYU_CLIENT_MESSAGE_TYPE,
): Buffer {
  const payloadBuffer = Buffer.isBuffer(payload)
    ? ensureNullTerminated(payload)
    : Buffer.from(`${payload.replace(/\0+$/u, "")}\0`, "utf8");
  const packetLength = payloadBuffer.byteLength + 8;
  const frame = Buffer.alloc(packetLength + 4);

  frame.writeUInt32LE(packetLength, 0);
  frame.writeUInt32LE(packetLength, 4);
  frame.writeUInt32LE(messageType, 8);
  payloadBuffer.copy(frame, DOUYU_PACKET_HEADER_BYTES);

  return frame;
}

export function decodeDouyuPackets(input: Buffer): DouyuPacketDecodeResult {
  const packets: DouyuPacket[] = [];
  let offset = 0;

  while (input.byteLength - offset >= DOUYU_PACKET_HEADER_BYTES) {
    const packetLength = input.readUInt32LE(offset);
    const duplicatedLength = input.readUInt32LE(offset + 4);

    if (packetLength !== duplicatedLength) {
      throw new DouyuProtocolError("Douyu packet length header mismatch");
    }

    if (packetLength < 8) {
      throw new DouyuProtocolError("Douyu packet length is smaller than header payload");
    }

    if (packetLength > DOUYU_MAX_PACKET_BYTES) {
      throw new DouyuProtocolError("Douyu packet exceeds maximum accepted size");
    }

    const totalFrameLength = packetLength + 4;
    if (input.byteLength - offset < totalFrameLength) {
      break;
    }

    const messageType = input.readUInt32LE(offset + 8);
    const payloadStart = offset + DOUYU_PACKET_HEADER_BYTES;
    const payloadEnd = offset + totalFrameLength;
    const payload = Buffer.from(input.subarray(payloadStart, payloadEnd));
    packets.push({
      messageType,
      payload,
      text: payload.toString("utf8").replace(/\0+$/u, ""),
    });

    offset += totalFrameLength;
  }

  return {
    packets,
    remaining: Buffer.from(input.subarray(offset)),
  };
}

function ensureNullTerminated(payload: Buffer): Buffer {
  if (payload.byteLength > 0 && payload[payload.byteLength - 1] === 0) {
    return Buffer.from(payload);
  }

  return Buffer.concat([payload, Buffer.from([0])]);
}
