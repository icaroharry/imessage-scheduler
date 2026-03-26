import { DashboardStats } from "@/components/dashboard-stats";
import { MessageTable } from "@/components/message-table";

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor your scheduled messages and delivery status.
        </p>
      </div>

      <DashboardStats />
      <MessageTable />
    </div>
  );
}
