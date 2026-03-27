import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageCard } from "@/components/message-card";
import { createMessage, messages } from "./fixtures";

describe("MessageCard", () => {
  describe("rendering", () => {
    it("displays the phone number and message body", () => {
      render(<MessageCard message={messages.queued} />);

      expect(screen.getByText("+15551234567")).toBeInTheDocument();
      expect(screen.getByText("Hello, world!")).toBeInTheDocument();
    });

    it("displays the created date", () => {
      render(<MessageCard message={messages.queued} />);

      // formatDate produces something like "Mar 26, 2026, 10:00 AM"
      expect(screen.getByText(/Mar 26, 2026/)).toBeInTheDocument();
    });

    it("displays sent date when available", () => {
      render(<MessageCard message={messages.sent} />);

      expect(screen.getByText(/Sent:/)).toBeInTheDocument();
    });

    it("does not display sent date when absent", () => {
      render(<MessageCard message={messages.queued} />);

      expect(screen.queryByText(/Sent:/)).not.toBeInTheDocument();
    });
  });

  describe("status badges", () => {
    it("shows 'Queued' for QUEUED status", () => {
      render(<MessageCard message={messages.queued} />);
      expect(screen.getByText("Queued")).toBeInTheDocument();
    });

    it("shows 'Processing' for ACCEPTED status", () => {
      render(<MessageCard message={messages.accepted} />);
      expect(screen.getByText("Processing")).toBeInTheDocument();
    });

    it("shows 'Sent' for SENT status", () => {
      render(<MessageCard message={messages.sent} />);
      expect(screen.getByText("Sent")).toBeInTheDocument();
    });

    it("shows 'Delivered' for DELIVERED status", () => {
      render(<MessageCard message={messages.delivered} />);
      expect(screen.getByText("Delivered")).toBeInTheDocument();
    });

    it("shows 'Failed' for FAILED status", () => {
      render(<MessageCard message={messages.failed} />);
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });

    it("shows spinner icon for ACCEPTED status", () => {
      const { container } = render(
        <MessageCard message={messages.accepted} />
      );

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("does not show spinner for other statuses", () => {
      const { container } = render(<MessageCard message={messages.queued} />);

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe("error display", () => {
    it("shows error message when present", () => {
      render(<MessageCard message={messages.failed} />);

      expect(
        screen.getByText(
          "NO_IMESSAGE_ACCOUNT: No iMessage account is signed in"
        )
      ).toBeInTheDocument();
    });

    it("does not show error section when no error", () => {
      render(<MessageCard message={messages.queued} />);

      expect(
        screen.queryByText(/NO_IMESSAGE_ACCOUNT/)
      ).not.toBeInTheDocument();
    });
  });

  describe("delete button", () => {
    it("shows delete button for QUEUED messages when onDelete is provided", () => {
      render(
        <MessageCard message={messages.queued} onDelete={vi.fn()} />
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("hides delete button for non-QUEUED messages", () => {
      render(
        <MessageCard message={messages.sent} onDelete={vi.fn()} />
      );

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("hides delete button when onDelete is not provided", () => {
      render(<MessageCard message={messages.queued} />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("calls onDelete with message id when clicked", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();

      render(
        <MessageCard message={messages.queued} onDelete={onDelete} />
      );

      await user.click(screen.getByRole("button"));

      expect(onDelete).toHaveBeenCalledWith(1);
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe("edge cases", () => {
    it("handles long message body with word break", () => {
      const longMessage = createMessage({
        body: "a".repeat(500),
      });

      const { container } = render(<MessageCard message={longMessage} />);

      const bodyEl = container.querySelector(".break-words");
      expect(bodyEl).toBeInTheDocument();
    });

    it("renders different phone number formats", () => {
      const intlMessage = createMessage({
        phone: "+447911123456",
      });

      render(<MessageCard message={intlMessage} />);
      expect(screen.getByText("+447911123456")).toBeInTheDocument();
    });
  });
});
