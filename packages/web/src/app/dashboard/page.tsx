"use client";

import { motion } from "motion/react";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { StatusChart } from "@/components/dashboard/status-chart";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { MessageTable } from "@/components/message-table";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import {
  formContainerVariants,
  formFieldVariants,
} from "@/components/motion-primitives";

export default function DashboardPage() {
  const {
    stats,
    successRate,
    avgDeliveryTime,
    statusDistribution,
    hourlyActivity,
    activityTimeline,
    throughput,
  } = useDashboardData();

  return (
    <motion.div
      className="p-6 space-y-6"
      variants={formContainerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={formFieldVariants}>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor your scheduled messages and delivery status.
        </p>
      </motion.div>

      {/* Row 1: KPI Cards */}
      <motion.div variants={formFieldVariants}>
        <KPICards
          successRate={successRate}
          avgDeliveryTime={avgDeliveryTime}
          throughput={throughput}
        />
      </motion.div>

      {/* Row 2: Charts + Timeline */}
      <motion.div
        variants={formFieldVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <StatusChart data={statusDistribution} stats={stats} />
        <ActivityChart data={hourlyActivity} />
        <ActivityTimeline messages={activityTimeline} />
      </motion.div>

      {/* Row 3: Message Table */}
      <motion.div variants={formFieldVariants}>
        <MessageTable compact maxRows={20} />
      </motion.div>
    </motion.div>
  );
}
