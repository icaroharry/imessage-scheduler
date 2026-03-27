"use client";

import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, CheckCircle2, Clock } from "lucide-react";
import {
  statContainerVariants,
  statCardVariants,
} from "@/components/motion-primitives";
import { formatDuration } from "@/lib/dashboard-utils";

interface KPICardsProps {
  successRate: number;
  avgDeliveryTime: number | null;
  throughput: { last1h: number; last24h: number };
}

function ProgressRing({
  value,
  size = 48,
  strokeWidth = 4,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-emerald-500 transition-all duration-700"
      />
    </svg>
  );
}

function SparklineBars({ last1h, last24h }: { last1h: number; last24h: number }) {
  const max = Math.max(last1h, last24h, 1);
  const bars = [
    { value: last24h, label: "24h" },
    { value: last1h, label: "1h" },
  ];

  return (
    <div className="flex items-end gap-1 h-8">
      {bars.map((bar) => (
        <div key={bar.label} className="flex flex-col items-center gap-0.5">
          <div
            className="w-4 bg-primary/60 rounded-sm transition-all duration-500"
            style={{ height: `${Math.max((bar.value / max) * 24, 2)}px` }}
          />
          <span className="text-[9px] text-muted-foreground">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}

export function KPICards({ successRate, avgDeliveryTime, throughput }: KPICardsProps) {
  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      variants={statContainerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Success Rate */}
      <motion.div variants={statCardVariants}>
        <Card className="transition-colors hover:bg-accent/30">
          <CardContent className="py-4 px-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="text-xs text-muted-foreground">Success Rate</span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {successRate.toFixed(1)}%
                </div>
              </div>
              <ProgressRing value={successRate} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Avg Delivery Time */}
      <motion.div variants={statCardVariants}>
        <Card className="transition-colors hover:bg-accent/30">
          <CardContent className="py-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Avg Delivery Time</span>
            </div>
            <div className="text-2xl font-bold mt-1">
              {avgDeliveryTime !== null ? formatDuration(avgDeliveryTime) : "N/A"}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Throughput */}
      <motion.div variants={statCardVariants}>
        <Card className="transition-colors hover:bg-accent/30">
          <CardContent className="py-4 px-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground">Throughput</span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {throughput.last1h}
                  <span className="text-sm font-normal text-muted-foreground"> /hr</span>
                </div>
              </div>
              <SparklineBars last1h={throughput.last1h} last24h={throughput.last24h} />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
