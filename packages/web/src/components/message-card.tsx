"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Clock, Trash2, AlertCircle } from "lucide-react";
import type { Message, MessageStatus } from "@/lib/api";

interface MessageCardProps {
  message: Message;
  onDelete?: (id: number) => void;
}

const statusConfig: Record<
  MessageStatus,
  { label: string; className: string }
> = {
  QUEUED: {
    label: "Queued",
    className: "bg-secondary text-secondary-foreground",
  },
  ACCEPTED: {
    label: "Accepted",
    className: "bg-primary/10 text-primary",
  },
  SENT: {
    label: "Sent",
    className: "bg-accent text-accent-foreground",
  },
  DELIVERED: {
    label: "Delivered",
    className: "bg-emerald-100 text-emerald-700",
  },
  FAILED: {
    label: "Failed",
    className: "bg-destructive/10 text-destructive",
  },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MessageCard({ message, onDelete }: MessageCardProps) {
  const status = statusConfig[message.status];

  return (
    <Card className="group transition-colors hover:bg-accent/30">
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="mt-0.5 shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">
                  {message.phone}
                </span>
                <Badge
                  variant="secondary"
                  className={`text-xs px-2 py-0 ${status.className}`}
                >
                  {status.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed break-words">
                {message.body}
              </p>

              {message.errorMessage && (
                <div className="flex items-center gap-1 mt-2 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {message.errorMessage}
                </div>
              )}

              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDate(message.createdAt)}
                {message.sentAt && (
                  <span className="ml-2">
                    Sent: {formatDate(message.sentAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {message.status === "QUEUED" && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(message.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
