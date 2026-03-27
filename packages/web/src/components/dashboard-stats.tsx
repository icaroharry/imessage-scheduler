"use client";

import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { useSSEData } from "@/components/sse-provider";
import {
  Inbox,
  Clock,
  CircleCheck,
  ArrowUpRight,
  BadgeCheck,
  TriangleAlert,
  TrendingUp,
} from "lucide-react";
import {
  statContainerVariants,
  statCardVariants,
} from "@/components/motion-primitives";

const pipelineCards = [
  {
    key: "queued" as const,
    label: "Queued",
    icon: Clock,
    color: "text-slate-600",
    bg: "bg-slate-100",
  },
  {
    key: "accepted" as const,
    label: "Accepted",
    icon: CircleCheck,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    key: "sent" as const,
    label: "Sent",
    icon: ArrowUpRight,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    key: "delivered" as const,
    label: "Delivered",
    icon: BadgeCheck,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    key: "failed" as const,
    label: "Failed",
    icon: TriangleAlert,
    color: "text-red-600",
    bg: "bg-red-50",
  },
];

export function DashboardStats() {
  const { stats } = useSSEData();

  if (!stats) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-5 px-5">
                <div className="h-[72px] animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="py-4 px-4">
                <div className="h-12 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const deliveryRate =
    stats.total > 0
      ? Math.round((stats.delivered / stats.total) * 100)
      : 0;

  const failureRate =
    stats.total > 0
      ? Math.round((stats.failed / stats.total) * 100)
      : 0;

  return (
    <motion.div
      className="space-y-3"
      variants={statContainerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Total Messages */}
        <motion.div variants={statCardVariants}>
          <Card className="h-full">
            <CardContent className="py-5 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Messages
                  </p>
                  <p className="text-3xl font-bold mt-1">{stats.total}</p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Inbox className="h-5 w-5 text-primary" />
                </div>
              </div>
              {stats.total > 0 && (
                <div className="mt-3 flex h-1.5 rounded-full overflow-hidden bg-muted">
                  {stats.delivered > 0 && (
                    <div
                      className="bg-emerald-500 transition-all duration-500"
                      style={{
                        width: `${(stats.delivered / stats.total) * 100}%`,
                      }}
                    />
                  )}
                  {stats.sent > 0 && (
                    <div
                      className="bg-blue-500 transition-all duration-500"
                      style={{
                        width: `${(stats.sent / stats.total) * 100}%`,
                      }}
                    />
                  )}
                  {stats.accepted > 0 && (
                    <div
                      className="bg-amber-500 transition-all duration-500"
                      style={{
                        width: `${(stats.accepted / stats.total) * 100}%`,
                      }}
                    />
                  )}
                  {stats.queued > 0 && (
                    <div
                      className="bg-slate-400 transition-all duration-500"
                      style={{
                        width: `${(stats.queued / stats.total) * 100}%`,
                      }}
                    />
                  )}
                  {stats.failed > 0 && (
                    <div
                      className="bg-red-500 transition-all duration-500"
                      style={{
                        width: `${(stats.failed / stats.total) * 100}%`,
                      }}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Delivery Rate */}
        <motion.div variants={statCardVariants}>
          <Card className="h-full">
            <CardContent className="py-5 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Delivery Rate
                  </p>
                  <p className="text-3xl font-bold mt-1">
                    {deliveryRate}
                    <span className="text-lg font-semibold text-muted-foreground">
                      %
                    </span>
                  </p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {stats.delivered} of {stats.total} delivered
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Failure Rate */}
        <motion.div variants={statCardVariants}>
          <Card className="h-full">
            <CardContent className="py-5 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Failure Rate
                  </p>
                  <p className="text-3xl font-bold mt-1">
                    <span className={failureRate > 0 ? "text-red-600" : ""}>
                      {failureRate}
                    </span>
                    <span className="text-lg font-semibold text-muted-foreground">
                      %
                    </span>
                  </p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <TriangleAlert className="h-5 w-5 text-red-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {stats.failed} of {stats.total} failed
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Pipeline Status Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {pipelineCards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.key} variants={statCardVariants}>
              <Card className="transition-colors hover:bg-accent/30">
                <CardContent className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-9 w-9 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}
                    >
                      <Icon className={`h-[18px] w-[18px] ${card.color}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xl font-bold leading-none">
                        {stats[card.key]}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {card.label}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
