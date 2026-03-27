"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { MessageCard } from "./message-card";
import { api } from "@/lib/api";
import type { MessageStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useNewMessage } from "@/components/sidebar-layout";
import { useSSEData } from "@/components/sse-provider";
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
  const { messages, connected } = useSSEData();
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const [processedFilter, setProcessedFilter] =
    useState<ProcessedFilter>("all");

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

  if (!connected && messages.length === 0) {
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
              {processedMessages.length > 0 && (
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
              {filteredProcessed.length > 0 ? (
                <motion.div
                  key={`processed-${processedFilter}`}
                  variants={listContainerVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="space-y-2 overflow-y-auto min-h-0 flex-1 py-px pr-3 pl-px thin-scrollbar"
                >
                  <AnimatePresence mode="popLayout">
                    {filteredProcessed.map((message) => (
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
                    {processedMessages.length > 0
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
