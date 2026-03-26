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
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  QUEUED: {
    label: "Queued",
    variant: "secondary",
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
  ACCEPTED: {
    label: "Accepted",
    variant: "default",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  SENT: {
    label: "Sent",
    variant: "default",
    className: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  DELIVERED: {
    label: "Delivered",
    variant: "default",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  FAILED: {
    label: "Failed",
    variant: "destructive",
    className: "bg-red-100 text-red-700 border-red-200",
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
    <Card className="shadow-sm border-0 bg-white/70 backdrop-blur-sm hover:bg-white/90 transition-colors group">
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="mt-0.5 shrink-0 h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
              <Phone className="h-4 w-4 text-blue-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 text-sm">
                  {message.phone}
                </span>
                <Badge
                  variant={status.variant}
                  className={`text-xs px-2 py-0 ${status.className}`}
                >
                  {status.label}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed break-words">
                {message.body}
              </p>

              {message.errorMessage && (
                <div className="flex items-center gap-1 mt-2 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {message.errorMessage}
                </div>
              )}

              <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
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
              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
