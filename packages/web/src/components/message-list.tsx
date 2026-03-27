"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { MessageCard } from "./message-card";
import { api } from "@/lib/api";
import type { Message, MessageStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useNewMessage } from "@/components/sidebar-layout";
import { Loader2, Inbox, Clock, Plus } from "lucide-react";

type ProcessedFilter = "all" | "SENT" | "DELIVERED" | "FAILED";

const filterChips: { value: ProcessedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "SENT", label: "Sent" },
  { value: "FAILED", label: "Failed" },
];

interface MessageListProps {
  refreshTrigger?: number;
}

export function MessageList({ refreshTrigger }: MessageListProps) {
  const { setOpen } = useNewMessage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processedFilter, setProcessedFilter] = useState<ProcessedFilter>("all");

  const fetchMessages = useCallback(async () => {
    try {
      setError(null);
      const result = await api.getMessages({ limit: 50 });
      setMessages(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages, refreshTrigger]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleDelete = async (id: number) => {
    try {
      await api.deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const queuedMessages = messages.filter(
    (m) => m.status === "QUEUED" || m.status === "ACCEPTED"
  );
  const processedMessages = messages.filter(
    (m) => m.status !== "QUEUED" && m.status !== "ACCEPTED"
  );

  const filteredProcessed = useMemo(
    () =>
      processedFilter === "all"
        ? processedMessages
        : processedMessages.filter((m) => m.status === processedFilter),
    [processedMessages, processedFilter]
  );

  const filterCounts = useMemo(() => {
    const counts: Record<ProcessedFilter, number> = {
      all: processedMessages.length,
      SENT: 0,
      DELIVERED: 0,
      FAILED: 0,
    };
    for (const m of processedMessages) {
      if (m.status in counts) counts[m.status as ProcessedFilter]++;
    }
    return counts;
  }, [processedMessages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading messages...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-destructive mb-2">{error}</p>
        <Button
          variant="link"
          size="sm"
          onClick={fetchMessages}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-theme(spacing.14)-theme(spacing.12))]">
      {/* Queue column */}
      <div className="flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Queue</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            ({queuedMessages.length})
          </span>
        </div>
        {queuedMessages.length > 0 ? (
          <div className="space-y-2 overflow-y-auto min-h-0 flex-1 p-px">
            {queuedMessages.map((message) => (
              <MessageCard
                key={message.id}
                message={message}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed rounded-xl">
            <Inbox className="h-5 w-5 mb-2" />
            <p className="text-xs">Queue is empty</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Schedule Message
            </Button>
          </div>
        )}
      </div>

      {/* Processed column */}
      <div className="flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <h3 className="text-sm font-semibold">Processed</h3>
          </div>
          {processedMessages.length > 0 && (
            <div className="flex items-center gap-1">
              {filterChips.map((chip) => (
                <Button
                  key={chip.value}
                  variant={processedFilter === chip.value ? "default" : "outline"}
                  size="xs"
                  onClick={() => setProcessedFilter(chip.value)}
                >
                  {chip.label}
                  <span className="ml-1 opacity-60">{filterCounts[chip.value]}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
        {filteredProcessed.length > 0 ? (
          <div className="space-y-2 overflow-y-auto min-h-0 flex-1 p-px">
            {filteredProcessed.map((message) => (
              <MessageCard key={message.id} message={message} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed rounded-xl">
            <Inbox className="h-5 w-5 mb-2" />
            <p className="text-xs">
              {processedMessages.length > 0
                ? "No messages match this filter"
                : "No messages processed yet"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
