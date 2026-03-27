import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageList } from "@/components/message-list";
import { createMessage } from "./fixtures";
import type { SSEData } from "@/hooks/use-sse";
import type { UseInfiniteMessagesResult } from "@/hooks/use-infinite-messages";

// Default SSE data for tests (now only contains QUEUED/ACCEPTED messages)
let sseData: SSEData = {
  messages: [],
  stats: null,
  gatewayStatus: "checking",
  connected: true,
  subscribe: () => () => {},
};

// Default infinite messages data for processed column
let infiniteData: UseInfiniteMessagesResult = {
  messages: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  totalCount: 0,
  sentinelRef: () => {},
};

// Track the statuses passed to useInfiniteMessages
let lastInfiniteStatuses: string[] = [];

// Mock the SSE provider
vi.mock("@/components/sse-provider", () => ({
  useSSEData: () => sseData,
}));

// Mock the infinite messages hook
vi.mock("@/hooks/use-infinite-messages", () => ({
  useInfiniteMessages: (opts: { statuses: string[] }) => {
    lastInfiniteStatuses = opts.statuses;
    return infiniteData;
  },
}));

// Mock the API module (still used for deleteMessage)
vi.mock("@/lib/api", () => ({
  api: {
    deleteMessage: vi.fn(),
  },
}));

// Mock useNewMessage context
const mockSetOpen = vi.fn();
vi.mock("@/components/sidebar-layout", () => ({
  useNewMessage: () => ({
    open: false,
    setOpen: mockSetOpen,
    refreshKey: 0,
  }),
}));

import { api } from "@/lib/api";
const mockApi = vi.mocked(api);

describe("MessageList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sseData = {
      messages: [],
      stats: null,
      gatewayStatus: "checking",
      connected: true,
      subscribe: () => () => {},
    };
    infiniteData = {
      messages: [],
      isLoading: false,
      isLoadingMore: false,
      hasMore: false,
      totalCount: 0,
      sentinelRef: () => {},
    };
    lastInfiniteStatuses = [];
  });

  it("shows loading state when not connected and no messages", () => {
    sseData = { ...sseData, connected: false, messages: [] };
    infiniteData = { ...infiniteData, isLoading: true };

    render(<MessageList />);

    expect(screen.getByText("Loading messages...")).toBeInTheDocument();
  });

  it("shows both empty placeholders when connected with no messages", () => {
    sseData = {
      ...sseData,
      connected: true,
      messages: [],
      stats: { total: 0, queued: 0, accepted: 0, sent: 0, delivered: 0, failed: 0 },
    };

    render(<MessageList />);

    expect(screen.getByText("Queue is empty")).toBeInTheDocument();
    expect(
      screen.getByText("No messages processed yet")
    ).toBeInTheDocument();
  });

  describe("two-column layout", () => {
    it("always shows both Queue and Processed headers", () => {
      sseData = {
        ...sseData,
        messages: [createMessage({ id: 1, status: "QUEUED" })],
        stats: { total: 2, queued: 1, accepted: 0, sent: 1, delivered: 0, failed: 0 },
      };
      infiniteData = {
        ...infiniteData,
        messages: [createMessage({ id: 2, status: "SENT" })],
        totalCount: 1,
      };

      render(<MessageList />);

      expect(screen.getByText("Queue")).toBeInTheDocument();
      expect(screen.getByText("Processed")).toBeInTheDocument();
    });

    it("shows empty queue placeholder with schedule button when all messages are processed", async () => {
      const user = userEvent.setup();
      sseData = {
        ...sseData,
        messages: [],
        stats: { total: 2, queued: 0, accepted: 0, sent: 1, delivered: 1, failed: 0 },
      };
      infiniteData = {
        ...infiniteData,
        messages: [
          createMessage({ id: 1, status: "SENT" }),
          createMessage({ id: 2, status: "DELIVERED" }),
        ],
        totalCount: 2,
      };

      render(<MessageList />);

      expect(screen.getByText("Queue is empty")).toBeInTheDocument();

      const scheduleBtn = screen.getByRole("button", {
        name: /schedule message/i,
      });
      expect(scheduleBtn).toBeInTheDocument();

      await user.click(scheduleBtn);
      expect(mockSetOpen).toHaveBeenCalledWith(true);
    });

    it("shows empty processed placeholder when all messages are queued", () => {
      sseData = {
        ...sseData,
        messages: [
          createMessage({ id: 1, status: "QUEUED" }),
          createMessage({ id: 2, status: "QUEUED" }),
        ],
        stats: { total: 2, queued: 2, accepted: 0, sent: 0, delivered: 0, failed: 0 },
      };

      render(<MessageList />);

      expect(
        screen.getByText("No messages processed yet")
      ).toBeInTheDocument();
    });

    it("groups ACCEPTED messages in the Queue column", () => {
      sseData = {
        ...sseData,
        messages: [
          createMessage({ id: 1, status: "ACCEPTED", phone: "+15550001111" }),
          createMessage({ id: 2, status: "QUEUED", phone: "+15550003333" }),
        ],
        stats: { total: 3, queued: 1, accepted: 1, sent: 0, delivered: 1, failed: 0 },
      };
      infiniteData = {
        ...infiniteData,
        messages: [
          createMessage({ id: 3, status: "DELIVERED", phone: "+15550002222" }),
        ],
        totalCount: 1,
      };

      render(<MessageList />);

      expect(screen.getByText("+15550001111")).toBeInTheDocument();
      expect(screen.getByText("+15550003333")).toBeInTheDocument();
      expect(screen.getByText("+15550002222")).toBeInTheDocument();
    });

    it("shows queue header without count", () => {
      sseData = {
        ...sseData,
        messages: [
          createMessage({ id: 1, status: "QUEUED" }),
          createMessage({ id: 2, status: "QUEUED" }),
        ],
        stats: { total: 3, queued: 2, accepted: 0, sent: 1, delivered: 0, failed: 0 },
      };
      infiniteData = {
        ...infiniteData,
        messages: [createMessage({ id: 3, status: "SENT" })],
        totalCount: 1,
      };

      render(<MessageList />);

      expect(screen.getByText("Queue")).toBeInTheDocument();
      expect(screen.queryByText("(2)")).not.toBeInTheDocument();
    });
  });

  describe("filter chips", () => {
    it("shows filter chips when processed messages exist", () => {
      sseData = {
        ...sseData,
        messages: [],
        stats: { total: 2, queued: 0, accepted: 0, sent: 0, delivered: 1, failed: 1 },
      };
      infiniteData = {
        ...infiniteData,
        messages: [
          createMessage({ id: 1, status: "DELIVERED" }),
          createMessage({ id: 2, status: "FAILED" }),
        ],
        totalCount: 2,
      };

      render(<MessageList />);

      expect(screen.getByRole("button", { name: /All/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Delivered/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sent/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Failed/ })).toBeInTheDocument();
    });

    it("does not show filter chips when no processed messages", () => {
      sseData = {
        ...sseData,
        messages: [createMessage({ id: 1, status: "QUEUED" })],
        stats: { total: 1, queued: 1, accepted: 0, sent: 0, delivered: 0, failed: 0 },
      };

      render(<MessageList />);

      expect(screen.getByText("Queue")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^All/ })).not.toBeInTheDocument();
    });

    it("filters to show only failed messages", async () => {
      const user = userEvent.setup();
      sseData = {
        ...sseData,
        messages: [],
        stats: { total: 2, queued: 0, accepted: 0, sent: 0, delivered: 1, failed: 1 },
      };
      infiniteData = {
        ...infiniteData,
        messages: [
          createMessage({ id: 1, status: "DELIVERED", phone: "+15550001111" }),
          createMessage({ id: 2, status: "FAILED", phone: "+15550002222" }),
        ],
        totalCount: 2,
      };

      render(<MessageList />);

      expect(screen.getByText("+15550001111")).toBeInTheDocument();
      expect(screen.getByText("+15550002222")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Failed/ }));

      // After clicking, the hook is called with ["FAILED"] statuses
      // Since the hook is mocked, it still returns the same messages
      // but the important thing is the filter was triggered
      expect(lastInfiniteStatuses).toEqual(["FAILED"]);
    });

    it("filters to show only delivered messages", async () => {
      const user = userEvent.setup();
      sseData = {
        ...sseData,
        messages: [],
        stats: { total: 2, queued: 0, accepted: 0, sent: 0, delivered: 1, failed: 1 },
      };
      infiniteData = {
        ...infiniteData,
        messages: [
          createMessage({ id: 1, status: "DELIVERED", phone: "+15550001111" }),
          createMessage({ id: 2, status: "FAILED", phone: "+15550002222" }),
        ],
        totalCount: 2,
      };

      render(<MessageList />);

      expect(screen.getByText("+15550001111")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Delivered/ }));

      expect(lastInfiniteStatuses).toEqual(["DELIVERED"]);
    });

    it("shows empty filter state when no messages match", async () => {
      const user = userEvent.setup();
      sseData = {
        ...sseData,
        messages: [],
        stats: { total: 1, queued: 0, accepted: 0, sent: 0, delivered: 1, failed: 0 },
      };
      infiniteData = {
        ...infiniteData,
        messages: [
          createMessage({ id: 1, status: "DELIVERED", phone: "+15550001111" }),
        ],
        totalCount: 1,
      };

      render(<MessageList />);

      expect(screen.getByText("+15550001111")).toBeInTheDocument();

      // Update infinite data to return empty for FAILED filter
      infiniteData = { ...infiniteData, messages: [], totalCount: 0 };

      await user.click(screen.getByRole("button", { name: /Failed/ }));

      expect(
        screen.getByText("No messages match this filter")
      ).toBeInTheDocument();
    });

    it("returns to all when All chip is clicked", async () => {
      const user = userEvent.setup();
      sseData = {
        ...sseData,
        messages: [],
        stats: { total: 2, queued: 0, accepted: 0, sent: 0, delivered: 1, failed: 1 },
      };
      infiniteData = {
        ...infiniteData,
        messages: [
          createMessage({ id: 1, status: "DELIVERED", phone: "+15550001111" }),
          createMessage({ id: 2, status: "FAILED", phone: "+15550002222" }),
        ],
        totalCount: 2,
      };

      render(<MessageList />);

      expect(screen.getByText("+15550001111")).toBeInTheDocument();

      // Filter to failed only
      await user.click(screen.getByRole("button", { name: /Failed/ }));
      expect(lastInfiniteStatuses).toEqual(["FAILED"]);

      // Back to all
      await user.click(screen.getByRole("button", { name: /All/ }));
      expect(lastInfiniteStatuses).toEqual(
        expect.arrayContaining(["SENT", "DELIVERED", "FAILED"])
      );
    });
  });

  it("calls deleteMessage API when delete button is clicked", async () => {
    const user = userEvent.setup();
    sseData = {
      ...sseData,
      messages: [createMessage({ id: 1, status: "QUEUED", phone: "+15550001111" })],
      stats: { total: 1, queued: 1, accepted: 0, sent: 0, delivered: 0, failed: 0 },
    };
    mockApi.deleteMessage.mockResolvedValue({ message: "Deleted" });

    render(<MessageList />);

    expect(screen.getByText("+15550001111")).toBeInTheDocument();

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockApi.deleteMessage).toHaveBeenCalledWith(1);
    });
  });

  it("shows a friendly notice when delete hits a stale QUEUED conflict", async () => {
    const user = userEvent.setup();
    sseData = {
      ...sseData,
      messages: [createMessage({ id: 1, status: "QUEUED", phone: "+15550001111" })],
      stats: { total: 1, queued: 1, accepted: 0, sent: 0, delivered: 0, failed: 0 },
    };
    mockApi.deleteMessage.mockRejectedValue(
      new Error("Can only delete messages with QUEUED status")
    );

    render(<MessageList />);

    expect(screen.getByText("+15550001111")).toBeInTheDocument();

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockApi.deleteMessage).toHaveBeenCalledWith(1);
      expect(
        screen.getByText("Message is already being processed.")
      ).toBeInTheDocument();
    });
  });

  it("handles non-Error exceptions gracefully in delete", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    sseData = {
      ...sseData,
      messages: [createMessage({ id: 1, status: "QUEUED", phone: "+15550001111" })],
      stats: { total: 1, queued: 1, accepted: 0, sent: 0, delivered: 0, failed: 0 },
    };
    mockApi.deleteMessage.mockRejectedValue("string error");

    render(<MessageList />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });
});
