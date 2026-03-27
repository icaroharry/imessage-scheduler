"use client";

import { useMemo } from "react";
import { useSSEData } from "@/components/sse-provider";
import {
  computeSuccessRate,
  computeAvgDeliveryTime,
  computeStatusDistribution,
  computeHourlyActivity,
  computeActivityTimeline,
  computeThroughput,
} from "@/lib/dashboard-utils";

export function useDashboardData() {
  const { messages, stats, gatewayStatus, connected } = useSSEData();

  const successRate = useMemo(
    () => (stats ? computeSuccessRate(stats) : 0),
    [stats]
  );

  const avgDeliveryTime = useMemo(
    () => computeAvgDeliveryTime(messages),
    [messages]
  );

  const statusDistribution = useMemo(
    () => (stats ? computeStatusDistribution(stats) : []),
    [stats]
  );

  const hourlyActivity = useMemo(
    () => computeHourlyActivity(messages),
    [messages]
  );

  const activityTimeline = useMemo(
    () => computeActivityTimeline(messages, 8),
    [messages]
  );

  const throughput = useMemo(() => computeThroughput(messages), [messages]);

  return {
    messages,
    stats,
    gatewayStatus,
    connected,
    successRate,
    avgDeliveryTime,
    statusDistribution,
    hourlyActivity,
    activityTimeline,
    throughput,
  };
}
