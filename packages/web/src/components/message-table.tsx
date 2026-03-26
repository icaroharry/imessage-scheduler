"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import type { Message, MessageStatus } from "@/lib/api";
import { Loader2, RefreshCw } from "lucide-react";

const statusColors: Record<MessageStatus, string> = {
  QUEUED: "bg-secondary text-secondary-foreground",
  ACCEPTED: "bg-primary/10 text-primary",
  SENT: "bg-accent text-accent-foreground",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-destructive/10 text-destructive",
};

const statusFilters: { label: string; value: MessageStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Queued", value: "QUEUED" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Sent", value: "SENT" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Failed", value: "FAILED" },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

export function MessageTable() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MessageStatus | "ALL">("ALL");

  const fetchMessages = useCallback(async () => {
    try {
      const params: { status?: MessageStatus; limit: number } = { limit: 100 };
      if (filter !== "ALL") params.status = filter;
      const result = await api.getMessages(params);
      setMessages(result.data);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchMessages();
  }, [fetchMessages]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            All Messages
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLoading(true);
              fetchMessages();
            }}
            className="text-muted-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-1 flex-wrap">
          {statusFilters.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter(f.value)}
              className="text-xs h-7"
            >
              {f.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No messages found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="min-w-[200px]">Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      #{msg.id}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {msg.phone}
                    </TableCell>
                    <TableCell
                      className="text-sm text-muted-foreground max-w-[300px]"
                      title={msg.body}
                    >
                      {truncate(msg.body, 60)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs ${statusColors[msg.status]}`}
                      >
                        {msg.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(msg.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(msg.sentAt)}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[200px]">
                      {msg.errorMessage
                        ? truncate(msg.errorMessage, 40)
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
