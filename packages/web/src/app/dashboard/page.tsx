"use client";

import { motion } from "motion/react";
import { DashboardStats } from "@/components/dashboard-stats";
import { MessageTable } from "@/components/message-table";
import {
  formContainerVariants,
  formFieldVariants,
} from "@/components/motion-primitives";

export default function DashboardPage() {
  return (
    <motion.div
      className="p-6 space-y-6"
      variants={formContainerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={formFieldVariants}>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor your scheduled messages and delivery status.
        </p>
      </motion.div>

      <motion.div variants={formFieldVariants}>
        <DashboardStats />
      </motion.div>

      <motion.div variants={formFieldVariants}>
        <MessageTable />
      </motion.div>
    </motion.div>
  );
}
