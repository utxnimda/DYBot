import { DouyuProtocolError } from "./errors";

export type DouyuSttValue = string | number | boolean | null | undefined;
export type DouyuSttMessage = Record<string, string>;

export function escapeSttValue(value: string): string {
  return value.replaceAll("@", "@A").replaceAll("/", "@S");
}

export function unescapeSttValue(value: string): string {
  return value.replaceAll("@S", "/").replaceAll("@A", "@");
}

export function serializeStt(message: Readonly<Record<string, DouyuSttValue>>): string {
  const segments: string[] = [];

  for (const [key, value] of Object.entries(message)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (key.length === 0) {
      throw new DouyuProtocolError("STT key cannot be empty");
    }

    segments.push(`${escapeSttValue(key)}@=${escapeSttValue(String(value))}`);
  }

  return `${segments.join("/")}/`;
}

export function parseStt(input: string | Buffer): DouyuSttMessage {
  const text = Buffer.isBuffer(input) ? input.toString("utf8") : input;
  const normalized = text.replace(/\0+$/u, "");
  const message: DouyuSttMessage = {};

  for (const segment of normalized.split("/")) {
    if (segment.length === 0) {
      continue;
    }

    const delimiterIndex = segment.indexOf("@=");
    if (delimiterIndex <= 0) {
      throw new DouyuProtocolError(`Invalid STT segment: ${segment}`);
    }

    const key = unescapeSttValue(segment.slice(0, delimiterIndex));
    const value = unescapeSttValue(segment.slice(delimiterIndex + 2));
    message[key] = value;
  }

  return message;
}
