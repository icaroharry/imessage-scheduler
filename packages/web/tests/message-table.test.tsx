import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SSEData } from "@/hooks/use-sse";
import { createMessage } from "./fixtures";

let sseData: SSEData = {
  messages: [],
  stats: null,
  gatewayStatus: "checking",
  connected: true,
};

vi.mock("@/components/sse-provider", () => ({
  useSSEData: () => sseData,
}));

const { MessageTable } = await import("@/components/message-table");

describe("MessageTable", () => {
  beforeEach(() => {
    sseData = {
      messages: [
        createMessage({
          id: 1,
          phone: "+15551111111",
          body: "First message",
          status: "DELIVERED",
          errorMessage: null,
        }),
        createMessage({
          id: 2,
          phone: "+15552222222",
          body: "Second message",
          status: "FAILED",
          errorMessage: "Delivery failed",
        }),
        createMessage({
          id: 3,
          phone: "+15553333333",
          body: "Third message",
          status: "QUEUED",
        }),
      ],
      stats: null,
      gatewayStatus: "online",
      connected: true,
    };
  });

  describe("default mode", () => {
    it("shows ID column", () => {
      render(<MessageTable />);
      expect(screen.getByText("ID")).toBeInTheDocument();
    });

    it("shows Error column", () => {
      render(<MessageTable />);
      expect(screen.getByText("Error")).toBeInTheDocument();
    });

    it("shows all messages", () => {
      render(<MessageTable />);
      expect(screen.getByText("+15551111111")).toBeInTheDocument();
      expect(screen.getByText("+15552222222")).toBeInTheDocument();
      expect(screen.getByText("+15553333333")).toBeInTheDocument();
    });

    it("shows message IDs", () => {
      render(<MessageTable />);
      expect(screen.getByText("#1")).toBeInTheDocument();
      expect(screen.getByText("#2")).toBeInTheDocument();
    });

    it("shows error messages", () => {
      render(<MessageTable />);
      expect(screen.getByText("Delivery failed")).toBeInTheDocument();
    });
  });

  describe("compact mode", () => {
    it("hides ID column", () => {
      render(<MessageTable compact />);
      expect(screen.queryByText("ID")).not.toBeInTheDocument();
    });

    it("hides Error column", () => {
      render(<MessageTable compact />);
      expect(screen.queryByText("Error")).not.toBeInTheDocument();
    });

    it("does not render message IDs in cells", () => {
      render(<MessageTable compact />);
      expect(screen.queryByText("#1")).not.toBeInTheDocument();
      expect(screen.queryByText("#2")).not.toBeInTheDocument();
    });

    it("still shows phone numbers and messages", () => {
      render(<MessageTable compact />);
      expect(screen.getByText("+15551111111")).toBeInTheDocument();
      expect(screen.getByText("First message")).toBeInTheDocument();
    });
  });

  describe("maxRows prop", () => {
    it("limits the number of displayed rows", () => {
      render(<MessageTable maxRows={2} />);
      expect(screen.getByText("+15551111111")).toBeInTheDocument();
      expect(screen.getByText("+15552222222")).toBeInTheDocument();
      expect(screen.queryByText("+15553333333")).not.toBeInTheDocument();
    });

    it("shows all rows when maxRows exceeds message count", () => {
      render(<MessageTable maxRows={100} />);
      expect(screen.getByText("+15551111111")).toBeInTheDocument();
      expect(screen.getByText("+15552222222")).toBeInTheDocument();
      expect(screen.getByText("+15553333333")).toBeInTheDocument();
    });
  });

  describe("compact + maxRows combined", () => {
    it("applies both compact and maxRows", () => {
      render(<MessageTable compact maxRows={1} />);
      // Compact: no ID column
      expect(screen.queryByText("ID")).not.toBeInTheDocument();
      // maxRows: only first message
      expect(screen.getByText("+15551111111")).toBeInTheDocument();
      expect(screen.queryByText("+15552222222")).not.toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows empty state when no messages", () => {
      sseData.messages = [];
      render(<MessageTable />);
      expect(screen.getByText("No messages found.")).toBeInTheDocument();
    });
  });
});
