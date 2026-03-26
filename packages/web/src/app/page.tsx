"use client";

import { useState } from "react";
import { ScheduleForm } from "@/components/schedule-form";
import { MessageList } from "@/components/message-list";

export default function HomePage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">
          Schedule a Message
        </h1>
        <p className="text-sm text-gray-500">
          Enter a phone number and message to add it to the queue.
        </p>
      </div>

      <ScheduleForm
        onMessageCreated={() => setRefreshTrigger((prev) => prev + 1)}
      />

      <MessageList refreshTrigger={refreshTrigger} />
    </div>
  );
}
