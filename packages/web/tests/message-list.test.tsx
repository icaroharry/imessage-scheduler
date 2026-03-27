import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

  it("shows empty state when no messages", async () => {
    mockApi.getMessages.mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 50, offset: 0 },
    });

    render(<MessageList />);

    await waitFor(() => {
      expect(screen.getByText("No messages yet.")).toBeInTheDocument();
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

  it("separates queued messages as 'Scheduled Messages'", async () => {
    mockApi.getMessages.mockResolvedValue({
      data: [
        createMessage({ id: 1, status: "QUEUED" }),
        createMessage({ id: 2, status: "SENT" }),
      ],
      pagination: { total: 2, limit: 50, offset: 0 },
    });

    render(<MessageList />);

    await waitFor(() => {
      expect(screen.getByText("Scheduled Messages")).toBeInTheDocument();
      expect(screen.getByText("Processed Messages")).toBeInTheDocument();
    });
  });

  it("shows only 'Scheduled Messages' when all are queued", async () => {
    mockApi.getMessages.mockResolvedValue({
      data: [
        createMessage({ id: 1, status: "QUEUED" }),
        createMessage({ id: 2, status: "QUEUED" }),
      ],
      pagination: { total: 2, limit: 50, offset: 0 },
    });

    render(<MessageList />);

    await waitFor(() => {
      expect(screen.getByText("Scheduled Messages")).toBeInTheDocument();
    });
    expect(screen.queryByText("Processed Messages")).not.toBeInTheDocument();
  });

  it("shows only 'Processed Messages' when none are queued", async () => {
    mockApi.getMessages.mockResolvedValue({
      data: [
        createMessage({ id: 1, status: "SENT" }),
        createMessage({ id: 2, status: "DELIVERED" }),
      ],
      pagination: { total: 2, limit: 50, offset: 0 },
    });

    render(<MessageList />);

    await waitFor(() => {
      expect(screen.getByText("Processed Messages")).toBeInTheDocument();
    });
    expect(screen.queryByText("Scheduled Messages")).not.toBeInTheDocument();
  });

  it("displays correct counts in section headers", async () => {
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
      expect(screen.getByText("(2)")).toBeInTheDocument();
      expect(screen.getByText("(1)")).toBeInTheDocument();
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

    vi.advanceTimersByTime(10000);

    await waitFor(() => {
      expect(mockApi.getMessages).toHaveBeenCalledTimes(2);
    });

    vi.advanceTimersByTime(10000);

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
