"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Stats } from "@/lib/api";
import {
  Clock,
  CheckCircle2,
  Send,
  XCircle,
  MessageSquare,
  Zap,
} from "lucide-react";

const statCards = [
  {
    key: "total" as const,
    label: "Total",
    icon: MessageSquare,
    color: "text-gray-600",
    bg: "bg-gray-50",
  },
  {
    key: "queued" as const,
    label: "Queued",
    icon: Clock,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    key: "accepted" as const,
    label: "Accepted",
    icon: Zap,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  {
    key: "sent" as const,
    label: "Sent",
    icon: Send,
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    key: "delivered" as const,
    label: "Delivered",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    key: "failed" as const,
    label: "Failed",
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
];

export function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const result = await api.getStats();
        setStats(result.data);
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((card) => (
          <Card
            key={card.key}
            className="border-0 shadow-sm bg-white/70 backdrop-blur-sm"
          >
            <CardContent className="py-4 px-4">
              <div className="h-12 animate-pulse bg-gray-100 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {statCards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.key}
            className="border-0 shadow-sm bg-white/70 backdrop-blur-sm hover:bg-white/90 transition-colors"
          >
            <CardContent className="py-4 px-4">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`h-7 w-7 rounded-lg ${card.bg} flex items-center justify-center`}
                >
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-gray-900">
                  {stats[card.key]}
                </div>
                <div className="text-xs text-gray-500">{card.label}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
