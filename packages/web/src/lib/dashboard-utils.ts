import type { Message, Stats } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  queued: "hsl(220, 70%, 55%)",
  accepted: "hsl(38, 90%, 50%)",
  sent: "hsl(200, 70%, 50%)",
  delivered: "hsl(150, 60%, 45%)",
  failed: "hsl(0, 72%, 51%)",
};

export function computeSuccessRate(stats: Stats): number {
  const successful = stats.delivered + stats.sent;
  const total = successful + stats.failed;
  if (total === 0) return 0;
  return (successful / total) * 100;
}

export function computeAvgDeliveryTime(messages: Message[]): number | null {
  const delivered = messages.filter(
    (m) => m.status === "DELIVERED" && m.deliveredAt && m.createdAt
  );
  if (delivered.length === 0) return null;

  const totalMs = delivered.reduce((sum, m) => {
    const created = new Date(m.createdAt).getTime();
    const deliveredAt = new Date(m.deliveredAt!).getTime();
    return sum + (deliveredAt - created);
  }, 0);

  return totalMs / delivered.length;
}

export function computeStatusDistribution(
  stats: Stats
): { name: string; value: number; fill: string }[] {
  const entries: { key: keyof Omit<Stats, "total">; label: string }[] = [
    { key: "queued", label: "Queued" },
    { key: "accepted", label: "Processing" },
    { key: "sent", label: "Sent" },
    { key: "delivered", label: "Delivered" },
    { key: "failed", label: "Failed" },
  ];

  return entries
    .filter((e) => stats[e.key] > 0)
    .map((e) => ({
      name: e.label,
      value: stats[e.key],
      fill: STATUS_COLORS[e.key],
    }));
}

export function computeHourlyActivity(
  messages: Message[]
): { hour: string; count: number }[] {
  const buckets = new Array(24).fill(0);

  for (const msg of messages) {
    const hour = new Date(msg.createdAt).getHours();
    buckets[hour]++;
  }

  return buckets.map((count, i) => ({
    hour: `${i.toString().padStart(2, "0")}:00`,
    count,
  }));
}

export function computeActivityTimeline(
  messages: Message[],
  limit: number = 10
): Message[] {
  return [...messages]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, limit);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function computeThroughput(
  messages: Message[]
): { last1h: number; last24h: number } {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  let last1h = 0;
  let last24h = 0;

  for (const msg of messages) {
    const created = new Date(msg.createdAt).getTime();
    if (created >= twentyFourHoursAgo) {
      last24h++;
      if (created >= oneHourAgo) {
        last1h++;
      }
    }
  }

  return { last1h, last24h };
}
