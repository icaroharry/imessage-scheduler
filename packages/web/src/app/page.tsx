"use client";

import { MessageList } from "@/components/message-list";
import { useNewMessage } from "@/components/sidebar-layout";

export default function HomePage() {
  const { refreshKey } = useNewMessage();

  return (
    <div className="px-6 py-6">
      <MessageList refreshTrigger={refreshKey} />
    </div>
  );
}
