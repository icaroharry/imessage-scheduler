"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Message, Stats } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export type SSEEvent =
  | { type: "message:created"; data: Message }
  | { type: "message:updated"; data: Message }
  | { type: "message:deleted"; data: { id: number } };

export type SSESubscriber = (event: SSEEvent) => void;

export interface SSEData {
  messages: Message[];
  stats: Stats | null;
  gatewayStatus: "checking" | "online" | "offline";
  connected: boolean;
  subscribe: (callback: SSESubscriber) => () => void;
}

/**
 * Manages a single EventSource connection to the API's /events SSE endpoint.
 * Fetches initial data via REST, then applies incremental updates from SSE.
 * Provides a subscribe mechanism for other hooks to receive SSE events.
 */
export function useSSE(): SSEData {
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");
  const [connected, setConnected] = useState(false);

  // Track whether we've done the initial REST fetch
  const initialFetchDone = useRef(false);

  // Subscriber registry for forwarding SSE events to other hooks
  const subscribersRef = useRef(new Set<SSESubscriber>());

  const subscribe = useCallback((callback: SSESubscriber) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const notifySubscribers = useCallback((event: SSEEvent) => {
    for (const cb of subscribersRef.current) {
      cb(event);
    }
  }, []);

  // Fetch initial data via REST
  const fetchInitialData = useCallback(async () => {
    try {
      const [messagesRes, statsRes] = await Promise.all([
        api.getMessages({ status: ["QUEUED", "ACCEPTED"], limit: 200 }),
        api.getStats(),
      ]);
      setMessages(messagesRes.data);
      setStats(statsRes.data);
      initialFetchDone.current = true;
    } catch (err) {
      console.error("[SSE] Failed to fetch initial data:", err);
    }

    // Gateway health is best-effort — don't block on it
    try {
      await api.getGatewayHealth();
      setGatewayStatus("online");
    } catch {
      setGatewayStatus("offline");
    }
  }, []);

  useEffect(() => {
    fetchInitialData();

    const es = new EventSource(`${API_BASE_URL}/events`);

    es.addEventListener("connected", () => {
      setConnected(true);
    });

    es.addEventListener("message:created", (e) => {
      const msg: Message = JSON.parse(e.data);
      setMessages((prev) => {
        // Deduplicate by ID (in case we got the REST response + SSE event)
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [msg, ...prev];
      });
      notifySubscribers({ type: "message:created", data: msg });
    });

    es.addEventListener("message:updated", (e) => {
      const msg: Message = JSON.parse(e.data);
      const isQueueStatus =
        msg.status === "QUEUED" || msg.status === "ACCEPTED";
      setMessages((prev) => {
        if (isQueueStatus) {
          // Still in queue — update in place
          return prev.map((m) => (m.id === msg.id ? msg : m));
        }
        // Graduated out of queue — remove from the queue-only array
        return prev.filter((m) => m.id !== msg.id);
      });
      notifySubscribers({ type: "message:updated", data: msg });
    });

    es.addEventListener("message:deleted", (e) => {
      const { id }: { id: number } = JSON.parse(e.data);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      notifySubscribers({ type: "message:deleted", data: { id } });
    });

    es.addEventListener("stats:updated", (e) => {
      const data: Stats = JSON.parse(e.data);
      setStats(data);
    });

    es.addEventListener("gateway:status", (e) => {
      const { status }: { status: "online" | "offline" } = JSON.parse(e.data);
      setGatewayStatus(status);
    });

    es.onerror = () => {
      setConnected(false);
      // EventSource will automatically reconnect
    };

    es.onopen = () => {
      setConnected(true);
      // Re-fetch data on reconnect to catch anything missed
      fetchInitialData();
    };

    return () => {
      es.close();
    };
  }, [fetchInitialData, notifySubscribers]);

  return { messages, stats, gatewayStatus, connected, subscribe };
}
