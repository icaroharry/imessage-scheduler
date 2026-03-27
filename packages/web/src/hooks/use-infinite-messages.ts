"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import type { Message, MessageStatus } from "@/lib/api";
import { useSSEData } from "@/components/sse-provider";

export interface UseInfiniteMessagesOptions {
  statuses: MessageStatus[];
  pageSize?: number;
}

export interface UseInfiniteMessagesResult {
  messages: Message[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  totalCount: number;
  sentinelRef: (node: HTMLElement | null) => void;
}

/**
 * Infinite scroll hook for messages. Fetches pages from the REST API
 * as the user scrolls, and integrates with SSE events for real-time updates.
 */
export function useInfiniteMessages({
  statuses,
  pageSize = 20,
}: UseInfiniteMessagesOptions): UseInfiniteMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const offsetRef = useRef(0);
  const fetchIdRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Keep statuses in a ref so the SSE subscriber doesn't need to re-register
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;

  // Serialized key to detect filter changes
  const statusesKey = statuses.slice().sort().join(",");

  const { subscribe } = useSSEData();

  // Fetch a page of data from the API
  const fetchPage = useCallback(
    async (offset: number, id: number, isInitial: boolean) => {
      try {
        const res = await api.getMessages({
          status: statusesRef.current,
          limit: pageSize,
          offset,
        });

        // Discard stale responses (filter changed while fetch was in-flight)
        if (id !== fetchIdRef.current) return;

        if (isInitial) {
          setMessages(res.data);
        } else {
          // Append, deduplicating by ID
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newMessages = res.data.filter(
              (m) => !existingIds.has(m.id),
            );
            return [...prev, ...newMessages];
          });
        }

        offsetRef.current = offset + res.data.length;
        setHasMore(res.pagination.hasMore);
        setTotalCount(res.pagination.total);
      } catch (err) {
        console.error("[useInfiniteMessages] fetch failed:", err);
      } finally {
        if (id === fetchIdRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
          isLoadingMoreRef.current = false;
        }
      }
    },
    [pageSize],
  );

  // Load the next page
  const loadMore = useCallback(() => {
    if (isLoadingMoreRef.current || !hasMore) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    fetchPage(offsetRef.current, fetchIdRef.current, false);
  }, [hasMore, fetchPage]);

  // Reset and fetch first page when statuses change
  useEffect(() => {
    const id = ++fetchIdRef.current;
    offsetRef.current = 0;
    setMessages([]);
    setIsLoading(true);
    setHasMore(true);
    isLoadingMoreRef.current = false;
    fetchPage(0, id, true);
  }, [statusesKey, fetchPage]);

  // Subscribe to SSE events for real-time updates on the accumulated array
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      const currentStatuses = statusesRef.current;

      if (event.type === "message:created") {
        const msg = event.data;
        if (currentStatuses.includes(msg.status)) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [msg, ...prev];
          });
          offsetRef.current += 1;
          setTotalCount((t) => t + 1);
        }
      }

      if (event.type === "message:updated") {
        const msg = event.data;
        const matchesFilter = currentStatuses.includes(msg.status);

        setMessages((prev) => {
          const exists = prev.some((m) => m.id === msg.id);

          if (exists && matchesFilter) {
            // Update in place
            return prev.map((m) => (m.id === msg.id ? msg : m));
          }
          if (exists && !matchesFilter) {
            // Status no longer matches filter — remove
            offsetRef.current = Math.max(0, offsetRef.current - 1);
            setTotalCount((t) => Math.max(0, t - 1));
            return prev.filter((m) => m.id !== msg.id);
          }
          if (!exists && matchesFilter) {
            // Status now matches filter — prepend (e.g. QUEUED → SENT)
            offsetRef.current += 1;
            setTotalCount((t) => t + 1);
            return [msg, ...prev];
          }
          return prev;
        });
      }

      if (event.type === "message:deleted") {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === event.data.id);
          if (!exists) return prev;
          offsetRef.current = Math.max(0, offsetRef.current - 1);
          setTotalCount((t) => Math.max(0, t - 1));
          return prev.filter((m) => m.id !== event.data.id);
        });
      }
    });

    return unsubscribe;
  }, [subscribe]);

  // IntersectionObserver via callback ref
  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!node || !hasMore) return;

      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            loadMore();
          }
        },
        { rootMargin: "200px" },
      );
      observerRef.current.observe(node);
    },
    [hasMore, loadMore],
  );

  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    sentinelRef,
  };
}
