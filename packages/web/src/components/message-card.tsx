"use client";

import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Trash2, AlertCircle, Loader2 } from "lucide-react";
import type { Message, MessageStatus } from "@/lib/api";
import { SPRING_BOUNCY } from "@/components/motion-primitives";

interface MessageCardProps {
  message: Message;
  onDelete?: (id: number) => void;
}

const statusConfig: Record<
  MessageStatus,
  { label: string; className: string; spinning?: boolean }
> = {
  QUEUED: {
    label: "Queued",
    className: "bg-secondary text-secondary-foreground",
  },
  ACCEPTED: {
    label: "Processing",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    spinning: true,
  },
  SENT: {
    label: "Sent",
    className: "bg-accent text-accent-foreground",
  },
  DELIVERED: {
    label: "Delivered",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
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
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MessageCard({ message, onDelete }: MessageCardProps) {
  const status = statusConfig[message.status];

  return (
    <motion.div
      whileHover={{ y: -1 }}
      transition={SPRING_BOUNCY}
    >
      <Card
        size="sm"
        className="group relative min-h-30 transition-colors hover:bg-accent/30"
      >
        <CardContent className="py-2.5 px-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-px shrink-0 size-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone className="size-3 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-semibold text-[13px] leading-none">
                  {message.phone}
                </span>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={message.status}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge
                      variant="secondary"
                      className={`h-[18px] text-[10px] px-1.5 py-0 ${status.className}`}
                    >
                      {status.spinning && (
                        <Loader2 className="size-2.5 animate-spin mr-0.5" />
                      )}
                      {status.label}
                    </Badge>
                  </motion.div>
                </AnimatePresence>
              </div>
              <p className="text-[13px] text-muted-foreground leading-snug break-words">
                {message.body}
              </p>

              <AnimatePresence>
                {message.errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-destructive">
                      <AlertCircle className="size-3 shrink-0" />
                      <span className="break-words">
                        {message.errorMessage}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground/70">
                <span>{formatDate(message.createdAt)}</span>
                {message.sentAt && (
                  <>
                    <span aria-hidden="true" className="select-none">
                      ·
                    </span>
                    <span>Sent {formatDate(message.sentAt)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {message.status === "QUEUED" && onDelete && (
            <motion.div
              className="absolute top-2 right-2"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.85 }}
              transition={SPRING_BOUNCY}
            >
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onDelete(message.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
