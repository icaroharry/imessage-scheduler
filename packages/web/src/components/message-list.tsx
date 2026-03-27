"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { MessageCard } from "./message-card";
import { api } from "@/lib/api";
import type { MessageStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useNewMessage } from "@/components/sidebar-layout";
import { useSSEData } from "@/components/sse-provider";
import { useInfiniteMessages } from "@/hooks/use-infinite-messages";
import { Loader2, Inbox, Clock, Plus } from "lucide-react";
import {
  listContainerVariants,
  cardItemVariants,
  fadeVariants,
  fadeScaleVariants,
} from "@/components/motion-primitives";

type ProcessedFilter = "all" | "SENT" | "DELIVERED" | "FAILED";

const filterChips: { value: ProcessedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "SENT", label: "Sent" },
  { value: "FAILED", label: "Failed" },
];

export function MessageList() {
  const { setOpen } = useNewMessage();
  const { messages, connected, stats } = useSSEData();
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const [processedFilter, setProcessedFilter] =
    useState<ProcessedFilter>("all");

  // Derive the statuses for the infinite scroll hook based on the active filter
  const processedStatuses: MessageStatus[] = useMemo(() => {
    if (processedFilter === "all") return ["SENT", "DELIVERED", "FAILED"];
    return [processedFilter];
  }, [processedFilter]);

  const {
    messages: processedMessages,
    isLoading: processedLoading,
    isLoadingMore,
    hasMore,
    sentinelRef,
  } = useInfiniteMessages({ statuses: processedStatuses, pageSize: 15 });

  const handleDelete = async (id: number) => {
    setDeleteNotice(null);

    try {
      await api.deleteMessage(id);
      // SSE will deliver the message:deleted event to update the list
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("Can only delete messages with QUEUED status")
      ) {
        // SSE keeps messages in sync, so no manual re-fetch needed
        setDeleteNotice("Message is already being processed.");
        return;
      }

      setDeleteNotice("Failed to delete message. Please try again.");
      console.error("Failed to delete message:", err);
    }
  };

  // Queue column: SSE context now only contains QUEUED/ACCEPTED messages
  const queuedMessages = messages;

  // Filter chip counts derived from real-time SSE stats
  const filterCounts: Record<ProcessedFilter, number> = {
    all: (stats?.sent ?? 0) + (stats?.delivered ?? 0) + (stats?.failed ?? 0),
    SENT: stats?.sent ?? 0,
    DELIVERED: stats?.delivered ?? 0,
    FAILED: stats?.failed ?? 0,
  };

  if (!connected && messages.length === 0 && processedLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading messages...
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key="content"
        variants={fadeVariants}
        initial="hidden"
        animate="show"
        className="space-y-3"
      >
        {deleteNotice && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            {deleteNotice}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-theme(spacing.14)-theme(spacing.12))]">
          {/* Queue column */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between min-h-8 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Queue</h3>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {queuedMessages.length > 0 ? (
                <motion.div
                  key="queue-list"
                  variants={listContainerVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="space-y-2 overflow-y-auto min-h-0 flex-1 py-px pr-3 pl-px thin-scrollbar"
                >
                  <AnimatePresence mode="popLayout">
                    {queuedMessages.map((message) => (
                      <motion.div
                        key={message.id}
                        layout
                        variants={cardItemVariants}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                      >
                        <MessageCard
                          message={message}
                          onDelete={handleDelete}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div
                  key="queue-empty"
                  variants={fadeScaleVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="flex flex-col items-center justify-center h-30 text-muted-foreground border border-dashed rounded-xl"
                >
                  <Inbox className="h-4 w-4 mb-1" />
                  <p className="text-xs">Queue is empty</p>
                  <Button
                    variant="outline"
                    size="xs"
                    className="mt-1.5"
                    onClick={() => setOpen(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Schedule Message
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Processed column */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between min-h-8 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-semibold">Processed</h3>
              </div>
              {filterCounts.all > 0 && (
                <div className="flex items-center gap-1">
                  {filterChips.map((chip) => (
                    <Button
                      key={chip.value}
                      variant={
                        processedFilter === chip.value
                          ? "default"
                          : "outline"
                      }
                      size="xs"
                      onClick={() => setProcessedFilter(chip.value)}
                    >
                      {chip.label}
                      <span className="ml-1 opacity-60">
                        {filterCounts[chip.value]}
                      </span>
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <AnimatePresence mode="wait">
              {processedLoading ? (
                <motion.div
                  key="processed-loading"
                  variants={fadeScaleVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="flex items-center justify-center h-30 text-muted-foreground"
                >
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <p className="text-xs">Loading...</p>
                </motion.div>
              ) : processedMessages.length > 0 ? (
                <motion.div
                  key={`processed-${processedFilter}`}
                  variants={listContainerVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="space-y-2 overflow-y-auto min-h-0 flex-1 py-px pr-3 pl-px thin-scrollbar"
                >
                  <AnimatePresence mode="popLayout">
                    {processedMessages.map((message) => (
                      <motion.div
                        key={message.id}
                        layout
                        variants={cardItemVariants}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                      >
                        <MessageCard message={message} />
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Infinite scroll sentinel */}
                  {hasMore && (
                    <div
                      ref={sentinelRef}
                      className="flex justify-center py-4"
                    >
                      {isLoadingMore && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="processed-empty"
                  variants={fadeScaleVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="flex flex-col items-center justify-center h-30 text-muted-foreground border border-dashed rounded-xl"
                >
                  <Inbox className="h-4 w-4 mb-1" />
                  <p className="text-xs">
                    {filterCounts.all > 0
                      ? "No messages match this filter"
                      : "No messages processed yet"}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </MotionConfig>
  );
}
