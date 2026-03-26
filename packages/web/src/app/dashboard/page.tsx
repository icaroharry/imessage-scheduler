"use client";

import { DashboardStats } from "@/components/dashboard-stats";
import { MessageTable } from "@/components/message-table";

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor your scheduled messages and delivery status.
        </p>
      </div>

      <DashboardStats />
      <MessageTable />
    </div>
  );
}
