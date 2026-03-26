"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageCard } from "./message-card";
import { api } from "@/lib/api";
import type { Message } from "@/lib/api";
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
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading messages...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-red-500 mb-2">{error}</p>
        <button
          onClick={fetchMessages}
          className="text-sm text-blue-500 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">No messages yet.</p>
        <p className="text-xs mt-1">Schedule your first message above!</p>
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
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <h3 className="text-sm font-semibold text-gray-700">
                Scheduled Messages
              </h3>
            </div>
            <span className="text-xs text-gray-400">
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
              <h3 className="text-sm font-semibold text-gray-700">
                Processed Messages
              </h3>
            </div>
            <span className="text-xs text-gray-400">
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
