"use client";

import { useMemo, useState } from "react";
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
import type { MessageStatus } from "@/lib/api";
import { useSSEData } from "@/components/sse-provider";
import { Loader2 } from "lucide-react";

const statusDisplay: Record<MessageStatus, { label: string; className: string; spinning?: boolean }> = {
  QUEUED: { label: "Queued", className: "bg-secondary text-secondary-foreground" },
  ACCEPTED: { label: "Processing", className: "bg-amber-100 text-amber-700", spinning: true },
  SENT: { label: "Sent", className: "bg-accent text-accent-foreground" },
  DELIVERED: { label: "Delivered", className: "bg-emerald-100 text-emerald-700" },
  FAILED: { label: "Failed", className: "bg-destructive/10 text-destructive" },
};

const statusFilters: { label: string; value: MessageStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Queued", value: "QUEUED" },
  { label: "Processing", value: "ACCEPTED" },
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
  const { messages, connected } = useSSEData();
  const [filter, setFilter] = useState<MessageStatus | "ALL">("ALL");

  const filtered = useMemo(
    () =>
      filter === "ALL"
        ? messages
        : messages.filter((m) => m.status === filter),
    [messages, filter],
  );

  const loading = !connected && messages.length === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            All Messages
          </CardTitle>
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
        ) : filtered.length === 0 ? (
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
                {filtered.map((msg) => (
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
                        className={`text-xs ${statusDisplay[msg.status].className}`}
                      >
                        {statusDisplay[msg.status].spinning && (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        )}
                        {statusDisplay[msg.status].label}
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
