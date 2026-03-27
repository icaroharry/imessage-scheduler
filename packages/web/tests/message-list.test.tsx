import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageList } from "@/components/message-list";
import { createMessage } from "./fixtures";

// Mock the API module
vi.mock("@/lib/api", () => ({
  api: {
    getMessages: vi.fn(),
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
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows loading state initially", () => {
    mockApi.getMessages.mockReturnValue(new Promise(() => {})); // never resolves

    render(<MessageList />);

    expect(screen.getByText("Loading messages...")).toBeInTheDocument();
  });

  it("shows both empty placeholders when no messages", async () => {
    mockApi.getMessages.mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 50, offset: 0 },
    });

    render(<MessageList />);

    await waitFor(() => {
      expect(screen.getByText("Queue is empty")).toBeInTheDocument();
      expect(
        screen.getByText("No messages processed yet")
      ).toBeInTheDocument();
    });
  });

  it("shows error state and retry button on failure", async () => {
    mockApi.getMessages.mockRejectedValue(new Error("Network error"));

    render(<MessageList />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("retries fetch when 'Try again' is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    mockApi.getMessages
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        data: [createMessage()],
        pagination: { total: 1, limit: 50, offset: 0 },
      });

    render(<MessageList />);

    await waitFor(() => {
      expect(screen.getByText("Try again")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Try again"));

    await waitFor(() => {
      expect(screen.getByText("+15551234567")).toBeInTheDocument();
    });
  });

  describe("two-column layout", () => {
    it("always shows both Queue and Processed headers", async () => {
      mockApi.getMessages.mockResolvedValue({
        data: [
          createMessage({ id: 1, status: "QUEUED" }),
          createMessage({ id: 2, status: "SENT" }),
        ],
        pagination: { total: 2, limit: 50, offset: 0 },
      });

      render(<MessageList />);

      await waitFor(() => {
        expect(screen.getByText("Queue")).toBeInTheDocument();
        expect(screen.getByText("Processed")).toBeInTheDocument();
      });
    });

    it("shows empty queue placeholder with schedule button when all messages are processed", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockApi.getMessages.mockResolvedValue({
        data: [
          createMessage({ id: 1, status: "SENT" }),
          createMessage({ id: 2, status: "DELIVERED" }),
        ],
        pagination: { total: 2, limit: 50, offset: 0 },
      });

      render(<MessageList />);

      await waitFor(() => {
        expect(screen.getByText("Queue is empty")).toBeInTheDocument();
      });

      const scheduleBtn = screen.getByRole("button", {
        name: /schedule message/i,
      });
      expect(scheduleBtn).toBeInTheDocument();

      await user.click(scheduleBtn);
      expect(mockSetOpen).toHaveBeenCalledWith(true);
    });

    it("shows empty processed placeholder when all messages are queued", async () => {
      mockApi.getMessages.mockResolvedValue({
        data: [
          createMessage({ id: 1, status: "QUEUED" }),
          createMessage({ id: 2, status: "QUEUED" }),
        ],
        pagination: { total: 2, limit: 50, offset: 0 },
      });

      render(<MessageList />);

      await waitFor(() => {
        expect(
          screen.getByText("No messages processed yet")
        ).toBeInTheDocument();
      });
    });

    it("groups ACCEPTED messages in the Queue column", async () => {
      mockApi.getMessages.mockResolvedValue({
        data: [
          createMessage({ id: 1, status: "ACCEPTED", phone: "+15550001111" }),
          createMessage({ id: 2, status: "QUEUED", phone: "+15550003333" }),
          createMessage({ id: 3, status: "DELIVERED", phone: "+15550002222" }),
        ],
        pagination: { total: 3, limit: 50, offset: 0 },
      });

      render(<MessageList />);

      await waitFor(() => {
        expect(screen.getByText("+15550001111")).toBeInTheDocument();
        expect(screen.getByText("+15550003333")).toBeInTheDocument();
        expect(screen.getByText("+15550002222")).toBeInTheDocument();
      });
    });

    it("shows queue header without count", async () => {
      mockApi.getMessages.mockResolvedValue({
        data: [
          createMessage({ id: 1, status: "QUEUED" }),
          createMessage({ id: 2, status: "QUEUED" }),
          createMessage({ id: 3, status: "SENT" }),
        ],
        pagination: { total: 3, limit: 50, offset: 0 },
      });

      render(<MessageList />);

      await waitFor(() => {
        expect(screen.getByText("Queue")).toBeInTheDocument();
      });

      expect(screen.queryByText("(2)")).not.toBeInTheDocument();
    });
  });

  describe("filter chips", () => {
    it("shows filter chips when processed messages exist", async () => {
      mockApi.getMessages.mockResolvedValue({
        data: [
          createMessage({ id: 1, status: "DELIVERED" }),
          createMessage({ id: 2, status: "FAILED" }),
        ],
        pagination: { total: 2, limit: 50, offset: 0 },
      });

      render(<MessageList />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /All/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Delivered/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Sent/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Failed/ })).toBeInTheDocument();
      });
    });

    it("does not show filter chips when no processed messages", async () => {
      mockApi.getMessages.mockResolvedValue({
        data: [createMessage({ id: 1, status: "QUEUED" })],
        pagination: { total: 1, limit: 50, offset: 0 },
      });

      render(<MessageList />);

      await waitFor(() => {
        expect(screen.getByText("Queue")).toBeInTheDocument();
      });

      expect(screen.queryByRole("button", { name: /^All/ })).not.toBeInTheDocument();
    });

    it("filters to show only failed messages", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockApi.getMessages.mockResolvedValue({
        data: [
          createMessage({ id: 1, status: "DELIVERED", phone: "+15550001111" }),
          createMessage({ id: 2, status: "FAILED", phone: "+15550002222" }),
        ],
        pagination: { total: 2, limit: 50, offset: 0 },
      });

      render(<MessageList />);

      await waitFor(() => {
        expect(screen.getByText("+15550001111")).toBeInTheDocument();
        expect(screen.getByText("+15550002222")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Failed/ }));

      expect(screen.queryByText("+15550001111")).not.toBeInTheDocument();
      expect(screen.getByText("+15550002222")).toBeInTheDocument();
    });

    it("filters to show only delivered messages", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockApi.getMessages.mockResolvedValue({
        data: [
          createMessage({ id: 1, status: "DELIVERED", phone: "+15550001111" }),
          createMessage({ id: 2, status: "FAILED", phone: "+15550002222" }),
        ],
        pagination: { total: 2, limit: 50, offset: 0 },
      });

      render(<MessageList />);

      await waitFor(() => {
        expect(screen.getByText("+15550001111")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Delivered/ }));

      expect(screen.getByText("+15550001111")).toBeInTheDocument();
      expect(screen.queryByText("+15550002222")).not.toBeInTheDocument();
    });

    it("shows empty filter state when no messages match", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockApi.getMessages.mockResolvedValue({
        data: [
          createMessage({ id: 1, status: "DELIVERED", phone: "+15550001111" }),
        ],
        pagination: { total: 1, limit: 50, offset: 0 },
      });

      render(<MessageList />);

      await waitFor(() => {
        expect(screen.getByText("+15550001111")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Failed/ }));

      expect(
        screen.getByText("No messages match this filter")
      ).toBeInTheDocument();
    });

    it("returns to all when All chip is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockApi.getMessages.mockResolvedValue({
        data: [
          createMessage({ id: 1, status: "DELIVERED", phone: "+15550001111" }),
          createMessage({ id: 2, status: "FAILED", phone: "+15550002222" }),
        ],
        pagination: { total: 2, limit: 50, offset: 0 },
      });

      render(<MessageList />);

      await waitFor(() => {
        expect(screen.getByText("+15550001111")).toBeInTheDocument();
      });

      // Filter to failed only
      await user.click(screen.getByRole("button", { name: /Failed/ }));
      expect(screen.queryByText("+15550001111")).not.toBeInTheDocument();

      // Back to all
      await user.click(screen.getByRole("button", { name: /All/ }));
      expect(screen.getByText("+15550001111")).toBeInTheDocument();
      expect(screen.getByText("+15550002222")).toBeInTheDocument();
    });
  });

  it("removes a message optimistically on delete", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockApi.getMessages.mockResolvedValue({
      data: [createMessage({ id: 1, status: "QUEUED", phone: "+15550001111" })],
      pagination: { total: 1, limit: 50, offset: 0 },
    });
    mockApi.deleteMessage.mockResolvedValue({ message: "Deleted" });

    render(<MessageList />);

    await waitFor(() => {
      expect(screen.getByText("+15550001111")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockApi.deleteMessage).toHaveBeenCalledWith(1);
      expect(screen.queryByText("+15550001111")).not.toBeInTheDocument();
    });
  });

  it("re-fetches and shows a friendly notice when delete hits a stale QUEUED conflict", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockApi.getMessages
      .mockResolvedValueOnce({
        data: [createMessage({ id: 1, status: "QUEUED", phone: "+15550001111" })],
        pagination: { total: 1, limit: 50, offset: 0 },
      })
      .mockResolvedValueOnce({
        data: [createMessage({ id: 1, status: "ACCEPTED", phone: "+15550001111" })],
        pagination: { total: 1, limit: 50, offset: 0 },
      });
    mockApi.deleteMessage.mockRejectedValue(
      new Error("Can only delete messages with QUEUED status")
    );

    render(<MessageList />);

    await waitFor(() => {
      expect(screen.getByText("+15550001111")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockApi.deleteMessage).toHaveBeenCalledWith(1);
      expect(mockApi.getMessages).toHaveBeenCalledTimes(2);
      expect(
        screen.getByText("Message is already being processed.")
      ).toBeInTheDocument();
    });
  });

  it("re-fetches when refreshTrigger changes", async () => {
    mockApi.getMessages.mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 50, offset: 0 },
    });

    const { rerender } = render(<MessageList refreshTrigger={0} />);

    await waitFor(() => {
      expect(mockApi.getMessages).toHaveBeenCalledTimes(1);
    });

    rerender(<MessageList refreshTrigger={1} />);

    await waitFor(() => {
      expect(mockApi.getMessages).toHaveBeenCalledTimes(2);
    });
  });

  it("auto-refreshes every 10 seconds", async () => {
    mockApi.getMessages.mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 50, offset: 0 },
    });

    render(<MessageList />);

    await waitFor(() => {
      expect(mockApi.getMessages).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    await waitFor(() => {
      expect(mockApi.getMessages).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    await waitFor(() => {
      expect(mockApi.getMessages).toHaveBeenCalledTimes(3);
    });
  });

  it("handles non-Error exceptions gracefully", async () => {
    mockApi.getMessages.mockRejectedValue("string error");

    render(<MessageList />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load messages")).toBeInTheDocument();
    });
  });
});
