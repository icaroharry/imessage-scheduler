"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Stats } from "@/lib/api";
import {
  Clock,
  CheckCircle2,
  Send,
  XCircle,
  MessageSquare,
  Loader2,
} from "lucide-react";
import {
  statContainerVariants,
  statCardVariants,
} from "@/components/motion-primitives";

const statCards = [
  {
    key: "total" as const,
    label: "Total",
    icon: MessageSquare,
    color: "text-foreground",
    bg: "bg-secondary",
  },
  {
    key: "queued" as const,
    label: "Queued",
    icon: Clock,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    key: "accepted" as const,
    label: "Processing",
    icon: Loader2,
    color: "text-amber-600",
    bg: "bg-amber-50",
    spinning: true,
  },
  {
    key: "sent" as const,
    label: "Sent",
    icon: Send,
    color: "text-primary",
    bg: "bg-primary/10",
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
    color: "text-destructive",
    bg: "bg-destructive/10",
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
          <Card key={card.key}>
            <CardContent className="py-4 px-4">
              <div className="h-12 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
      variants={statContainerVariants}
      initial="hidden"
      animate="show"
    >
      {statCards.map((card) => {
        const Icon = card.icon;
        const spinning = "spinning" in card && card.spinning;
        return (
          <motion.div key={card.key} variants={statCardVariants}>
            <Card className="transition-colors hover:bg-accent/30">
              <CardContent className="py-4 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`h-7 w-7 rounded-lg ${card.bg} flex items-center justify-center`}
                  >
                    <Icon
                      className={`h-4 w-4 ${card.color}${spinning ? " animate-spin" : ""}`}
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-bold">{stats[card.key]}</div>
                  <div className="text-xs text-muted-foreground">
                    {card.label}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
