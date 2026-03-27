"use client";

import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/dashboard-utils";
import {
  chartContainerVariants,
  chartCardVariants,
} from "@/components/motion-primitives";
import type { Message, MessageStatus } from "@/lib/api";

const statusConfig: Record<
  MessageStatus,
  { color: string; label: string }
> = {
  QUEUED: { color: "bg-blue-500", label: "Queued" },
  ACCEPTED: { color: "bg-amber-500", label: "Processing" },
  SENT: { color: "bg-sky-500", label: "Sent" },
  DELIVERED: { color: "bg-emerald-500", label: "Delivered" },
  FAILED: { color: "bg-red-500", label: "Failed" },
};

interface ActivityTimelineProps {
  messages: Message[];
}

export function ActivityTimeline({ messages }: ActivityTimelineProps) {
  return (
    <motion.div
      variants={chartContainerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={chartCardVariants}>
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                No recent activity
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, index) => {
                  const config = statusConfig[msg.status];
                  return (
                    <div key={msg.id} className="flex gap-3 items-start">
                      <div className="flex flex-col items-center">
                        <div
                          className={`h-2.5 w-2.5 rounded-full mt-1.5 ${config.color}`}
                        />
                        {index < messages.length - 1 && (
                          <div className="w-px h-full bg-border min-h-[20px]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium truncate">
                            {msg.phone}
                          </span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatRelativeTime(msg.updatedAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {msg.body}
                        </p>
                        <span
                          className={`inline-block text-[10px] mt-1 px-1.5 py-0.5 rounded-full ${
                            msg.status === "FAILED"
                              ? "bg-destructive/10 text-destructive"
                              : msg.status === "DELIVERED"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-secondary text-secondary-foreground"
                          }`}
                        >
                          {config.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
