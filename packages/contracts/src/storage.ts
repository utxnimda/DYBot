import { z } from "zod";
import { BotEventSchema } from "./events";

export const StoredEventRecordSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  traceId: z.string().min(1),
  roomId: z.string().min(1).nullable(),
  occurredAt: z.number().int().nonnegative(),
  storedAt: z.number().int().nonnegative(),
  event: BotEventSchema,
});
export type StoredEventRecord = z.infer<typeof StoredEventRecordSchema>;

export const StoredEventQuerySchema = z.object({
  roomId: z.string().min(1).optional(),
  eventTypes: z.array(z.string().min(1)).max(20).optional(),
  limit: z.number().int().positive().max(500).default(100),
  offset: z.number().int().nonnegative().default(0),
});
export type StoredEventQuery = z.infer<typeof StoredEventQuerySchema>;
