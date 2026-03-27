"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageCard } from "./message-card";
import { api } from "@/lib/api";
import type { Message } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface MessageListProps {
  refreshTrigger?: number;
}

export function MessageList({ refreshTrigger }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (messages.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No messages yet.</p>
        <p className="text-xs mt-1">
          Click <strong>New Message</strong> to schedule your first message.
        </p>
      </div>
    );
  }

  const queuedMessages = messages.filter((m) => m.status === "QUEUED");
  const otherMessages = messages.filter((m) => m.status !== "QUEUED");

  return (
    <div className="space-y-6">
      {queuedMessages.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <h3 className="text-sm font-semibold">
                Scheduled Messages
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">
              ({queuedMessages.length})
            </span>
          </div>
          <div className="space-y-2">
            {queuedMessages.map((message) => (
              <MessageCard
                key={message.id}
                message={message}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {otherMessages.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-semibold">
                Processed Messages
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">
              ({otherMessages.length})
            </span>
          </div>
          <div className="space-y-2">
            {otherMessages.map((message) => (
              <MessageCard key={message.id} message={message} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
