import { describe, it, expect } from "vitest";
import {
  computeSuccessRate,
  computeAvgDeliveryTime,
  computeStatusDistribution,
  computeHourlyActivity,
  computeActivityTimeline,
  formatDuration,
  formatRelativeTime,
  computeThroughput,
} from "@/lib/dashboard-utils";
import type { Stats } from "@/lib/api";
import { createMessage } from "./fixtures";

describe("computeSuccessRate", () => {
  it("returns 100 when all messages are delivered", () => {
    const stats: Stats = {
      total: 10,
      queued: 0,
      accepted: 0,
      sent: 0,
      delivered: 10,
      failed: 0,
    };
    expect(computeSuccessRate(stats)).toBe(100);
  });

  it("returns 0 when all messages failed", () => {
    const stats: Stats = {
      total: 5,
      queued: 0,
      accepted: 0,
      sent: 0,
      delivered: 0,
      failed: 5,
    };
    expect(computeSuccessRate(stats)).toBe(0);
  });

  it("returns 0 when there are no completed messages", () => {
    const stats: Stats = {
      total: 5,
      queued: 3,
      accepted: 2,
      sent: 0,
      delivered: 0,
      failed: 0,
    };
    expect(computeSuccessRate(stats)).toBe(0);
  });

  it("calculates correct rate with mixed statuses", () => {
    const stats: Stats = {
      total: 10,
      queued: 2,
      accepted: 1,
      sent: 3,
      delivered: 2,
      failed: 2,
    };
    // (3 + 2) / (3 + 2 + 2) * 100 = 71.43...
    expect(computeSuccessRate(stats)).toBeCloseTo(71.43, 1);
  });
});

describe("computeAvgDeliveryTime", () => {
  it("returns null when no delivered messages", () => {
    const msgs = [createMessage({ status: "QUEUED" })];
    expect(computeAvgDeliveryTime(msgs)).toBeNull();
  });

  it("computes average for delivered messages", () => {
    const msgs = [
      createMessage({
        id: 1,
        status: "DELIVERED",
        createdAt: "2026-03-26T10:00:00.000Z",
        deliveredAt: "2026-03-26T10:01:00.000Z",
      }),
      createMessage({
        id: 2,
        status: "DELIVERED",
        createdAt: "2026-03-26T10:00:00.000Z",
        deliveredAt: "2026-03-26T10:02:00.000Z",
      }),
    ];
    // Average of 60000ms and 120000ms = 90000ms
    expect(computeAvgDeliveryTime(msgs)).toBe(90000);
  });

  it("ignores non-delivered messages", () => {
    const msgs = [
      createMessage({
        id: 1,
        status: "DELIVERED",
        createdAt: "2026-03-26T10:00:00.000Z",
        deliveredAt: "2026-03-26T10:01:00.000Z",
      }),
      createMessage({ id: 2, status: "FAILED" }),
    ];
    expect(computeAvgDeliveryTime(msgs)).toBe(60000);
  });
});

describe("computeStatusDistribution", () => {
  it("returns empty array when all counts are zero", () => {
    const stats: Stats = {
      total: 0,
      queued: 0,
      accepted: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
    };
    expect(computeStatusDistribution(stats)).toEqual([]);
  });

  it("filters out zero-value statuses", () => {
    const stats: Stats = {
      total: 5,
      queued: 0,
      accepted: 0,
      sent: 2,
      delivered: 3,
      failed: 0,
    };
    const result = computeStatusDistribution(stats);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(["Sent", "Delivered"]);
  });

  it("returns all statuses when all have values", () => {
    const stats: Stats = {
      total: 15,
      queued: 1,
      accepted: 2,
      sent: 3,
      delivered: 4,
      failed: 5,
    };
    const result = computeStatusDistribution(stats);
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual(
      expect.objectContaining({ name: "Queued", value: 1 })
    );
  });

  it("includes fill colors", () => {
    const stats: Stats = {
      total: 1,
      queued: 1,
      accepted: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
    };
    const result = computeStatusDistribution(stats);
    expect(result[0].fill).toBeDefined();
    expect(typeof result[0].fill).toBe("string");
  });
});

describe("computeHourlyActivity", () => {
  it("returns 24 buckets", () => {
    const result = computeHourlyActivity([]);
    expect(result).toHaveLength(24);
  });

  it("all buckets are zero for empty input", () => {
    const result = computeHourlyActivity([]);
    expect(result.every((b) => b.count === 0)).toBe(true);
  });

  it("buckets messages by creation hour", () => {
    const msgs = [
      createMessage({
        id: 1,
        createdAt: "2026-03-26T10:00:00.000Z",
      }),
      createMessage({
        id: 2,
        createdAt: "2026-03-26T10:30:00.000Z",
      }),
      createMessage({
        id: 3,
        createdAt: "2026-03-26T14:00:00.000Z",
      }),
    ];
    const result = computeHourlyActivity(msgs);
    // Note: hours are in local time, so we check the bucket structure
    const nonZero = result.filter((b) => b.count > 0);
    expect(nonZero.length).toBeGreaterThanOrEqual(1);
    const totalCount = result.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(3);
  });

  it("formats hours correctly", () => {
    const result = computeHourlyActivity([]);
    expect(result[0].hour).toBe("00:00");
    expect(result[9].hour).toBe("09:00");
    expect(result[23].hour).toBe("23:00");
  });
});

describe("computeActivityTimeline", () => {
  it("returns empty array for no messages", () => {
    expect(computeActivityTimeline([])).toEqual([]);
  });

  it("sorts by updatedAt descending", () => {
    const msgs = [
      createMessage({
        id: 1,
        updatedAt: "2026-03-26T10:00:00.000Z",
      }),
      createMessage({
        id: 2,
        updatedAt: "2026-03-26T12:00:00.000Z",
      }),
      createMessage({
        id: 3,
        updatedAt: "2026-03-26T11:00:00.000Z",
      }),
    ];
    const result = computeActivityTimeline(msgs);
    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(3);
    expect(result[2].id).toBe(1);
  });

  it("respects the limit parameter", () => {
    const msgs = Array.from({ length: 20 }, (_, i) =>
      createMessage({
        id: i + 1,
        updatedAt: new Date(2026, 2, 26, i).toISOString(),
      })
    );
    const result = computeActivityTimeline(msgs, 5);
    expect(result).toHaveLength(5);
  });

  it("defaults limit to 10", () => {
    const msgs = Array.from({ length: 20 }, (_, i) =>
      createMessage({
        id: i + 1,
        updatedAt: new Date(2026, 2, 26, i).toISOString(),
      })
    );
    const result = computeActivityTimeline(msgs);
    expect(result).toHaveLength(10);
  });
});

describe("formatDuration", () => {
  it("formats milliseconds", () => {
    expect(formatDuration(500)).toBe("500ms");
  });

  it("formats seconds only", () => {
    expect(formatDuration(5000)).toBe("5s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(154000)).toBe("2m 34s");
  });

  it("formats exact minutes", () => {
    expect(formatDuration(120000)).toBe("2m 0s");
  });
});

describe("formatRelativeTime", () => {
  it("returns seconds ago for recent times", () => {
    const now = new Date();
    now.setSeconds(now.getSeconds() - 30);
    expect(formatRelativeTime(now.toISOString())).toBe("30s ago");
  });

  it("returns minutes ago", () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - 5);
    expect(formatRelativeTime(now.toISOString())).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const now = new Date();
    now.setHours(now.getHours() - 3);
    expect(formatRelativeTime(now.toISOString())).toBe("3h ago");
  });

  it("returns days ago", () => {
    const now = new Date();
    now.setDate(now.getDate() - 2);
    expect(formatRelativeTime(now.toISOString())).toBe("2d ago");
  });

  it("returns 'just now' for future dates", () => {
    const future = new Date();
    future.setMinutes(future.getMinutes() + 5);
    expect(formatRelativeTime(future.toISOString())).toBe("just now");
  });
});

describe("computeThroughput", () => {
  it("returns zeros for empty array", () => {
    expect(computeThroughput([])).toEqual({ last1h: 0, last24h: 0 });
  });

  it("counts messages in the last hour", () => {
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const msgs = [
      createMessage({
        id: 1,
        createdAt: thirtyMinAgo.toISOString(),
      }),
    ];
    const result = computeThroughput(msgs);
    expect(result.last1h).toBe(1);
    expect(result.last24h).toBe(1);
  });

  it("separates 1h and 24h windows", () => {
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const msgs = [
      createMessage({
        id: 1,
        createdAt: thirtyMinAgo.toISOString(),
      }),
      createMessage({
        id: 2,
        createdAt: twoHoursAgo.toISOString(),
      }),
    ];
    const result = computeThroughput(msgs);
    expect(result.last1h).toBe(1);
    expect(result.last24h).toBe(2);
  });

  it("ignores messages older than 24h", () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const msgs = [
      createMessage({
        id: 1,
        createdAt: twoDaysAgo.toISOString(),
      }),
    ];
    const result = computeThroughput(msgs);
    expect(result.last1h).toBe(0);
    expect(result.last24h).toBe(0);
  });
});
