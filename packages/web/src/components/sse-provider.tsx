"use client";

import { createContext, useContext } from "react";
import { useSSE } from "@/hooks/use-sse";
import type { SSEData } from "@/hooks/use-sse";

const SSEContext = createContext<SSEData>({
  messages: [],
  stats: null,
  gatewayStatus: "checking",
  connected: false,
  subscribe: () => () => {},
});

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const data = useSSE();
  return <SSEContext value={data}>{children}</SSEContext>;
}

export function useSSEData(): SSEData {
  return useContext(SSEContext);
}
