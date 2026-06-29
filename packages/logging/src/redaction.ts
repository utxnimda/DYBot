const SECRET_KEY_PATTERNS = [/key/i, /token/i, /secret/i, /cookie/i, /password/i, /authorization/i];

function shouldRedactKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      redacted[key] = shouldRedactKey(key) ? "[redacted]" : redactValue(nested);
    }
    return redacted;
  }

  if (typeof value === "string" && value.length > 16 && /(?:sk-|key|token|secret)/i.test(value)) {
    return "[redacted]";
  }

  return value;
}
