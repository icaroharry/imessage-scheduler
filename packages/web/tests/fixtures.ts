import type { Message } from "@/lib/api";

export function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    phone: "+15551234567",
    body: "Hello, world!",
    status: "QUEUED",
    scheduledAt: null,
    createdAt: "2026-03-26T10:00:00.000Z",
    updatedAt: "2026-03-26T10:00:00.000Z",
    sentAt: null,
    deliveredAt: null,
    errorMessage: null,
    ...overrides,
  };
}

export const messages = {
  queued: createMessage({ id: 1, status: "QUEUED" }),
  accepted: createMessage({ id: 2, status: "ACCEPTED" }),
  sent: createMessage({
    id: 3,
    status: "SENT",
    sentAt: "2026-03-26T10:01:00.000Z",
  }),
  delivered: createMessage({
    id: 4,
    status: "DELIVERED",
    sentAt: "2026-03-26T10:01:00.000Z",
    deliveredAt: "2026-03-26T10:01:05.000Z",
  }),
  failed: createMessage({
    id: 5,
    status: "FAILED",
    errorMessage: "NO_IMESSAGE_ACCOUNT: No iMessage account is signed in",
  }),
};
