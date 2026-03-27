import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScheduleForm } from "@/components/schedule-form";

vi.mock("@/lib/api", () => ({
  api: {
    createMessage: vi.fn(),
  },
}));

import { api } from "@/lib/api";
const mockApi = vi.mocked(api);

describe("ScheduleForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders phone and message fields", () => {
      render(<ScheduleForm />);

      expect(screen.getByLabelText("Phone Number")).toBeInTheDocument();
      expect(screen.getByLabelText("Message")).toBeInTheDocument();
    });

    it("renders submit button", () => {
      render(<ScheduleForm />);

      expect(
        screen.getByRole("button", { name: /schedule message/i })
      ).toBeInTheDocument();
    });

    it("shows character counter starting at 0/2000", () => {
      render(<ScheduleForm />);

      expect(screen.getByText("0/2000")).toBeInTheDocument();
    });

    it("submit button is disabled when fields are empty", () => {
      render(<ScheduleForm />);

      expect(
        screen.getByRole("button", { name: /schedule message/i })
      ).toBeDisabled();
    });
  });

  describe("interaction", () => {
    it("enables submit when both fields are filled", async () => {
      const user = userEvent.setup();
      render(<ScheduleForm />);

      await user.type(screen.getByLabelText("Phone Number"), "+15551234567");
      await user.type(screen.getByLabelText("Message"), "Hello");

      expect(
        screen.getByRole("button", { name: /schedule message/i })
      ).toBeEnabled();
    });

    it("updates character counter as user types", async () => {
      const user = userEvent.setup();
      render(<ScheduleForm />);

      await user.type(screen.getByLabelText("Message"), "Hello");

      expect(screen.getByText("5/2000")).toBeInTheDocument();
    });

    it("keeps submit disabled with only phone filled", async () => {
      const user = userEvent.setup();
      render(<ScheduleForm />);

      await user.type(screen.getByLabelText("Phone Number"), "+15551234567");

      expect(
        screen.getByRole("button", { name: /schedule message/i })
      ).toBeDisabled();
    });

    it("keeps submit disabled with only message filled", async () => {
      const user = userEvent.setup();
      render(<ScheduleForm />);

      await user.type(screen.getByLabelText("Message"), "Hello");

      expect(
        screen.getByRole("button", { name: /schedule message/i })
      ).toBeDisabled();
    });
  });

  describe("submission", () => {
    it("calls api.createMessage with phone and body", async () => {
      const user = userEvent.setup();
      mockApi.createMessage.mockResolvedValue({
        data: {
          id: 1,
          phone: "+15551234567",
          body: "Hello",
          status: "QUEUED",
          scheduledAt: null,
          createdAt: "2026-03-26T10:00:00Z",
          updatedAt: "2026-03-26T10:00:00Z",
          sentAt: null,
          deliveredAt: null,
          errorMessage: null,
        },
      });

      render(<ScheduleForm />);

      await user.type(screen.getByLabelText("Phone Number"), "+15551234567");
      await user.type(screen.getByLabelText("Message"), "Hello");
      await user.click(
        screen.getByRole("button", { name: /schedule message/i })
      );

      await waitFor(() => {
        expect(mockApi.createMessage).toHaveBeenCalledWith({
          phone: "+15551234567",
          body: "Hello",
        });
      });
    });

    it("clears fields after successful submission", async () => {
      const user = userEvent.setup();
      mockApi.createMessage.mockResolvedValue({
        data: {
          id: 1,
          phone: "+15551234567",
          body: "Hello",
          status: "QUEUED",
          scheduledAt: null,
          createdAt: "2026-03-26T10:00:00Z",
          updatedAt: "2026-03-26T10:00:00Z",
          sentAt: null,
          deliveredAt: null,
          errorMessage: null,
        },
      });

      render(<ScheduleForm />);

      await user.type(screen.getByLabelText("Phone Number"), "+15551234567");
      await user.type(screen.getByLabelText("Message"), "Hello");
      await user.click(
        screen.getByRole("button", { name: /schedule message/i })
      );

      await waitFor(() => {
        expect(screen.getByLabelText("Phone Number")).toHaveValue("");
        expect(screen.getByLabelText("Message")).toHaveValue("");
      });
    });

    it("shows success message after creation", async () => {
      const user = userEvent.setup();
      mockApi.createMessage.mockResolvedValue({
        data: {
          id: 1,
          phone: "+15551234567",
          body: "Hello",
          status: "QUEUED",
          scheduledAt: null,
          createdAt: "2026-03-26T10:00:00Z",
          updatedAt: "2026-03-26T10:00:00Z",
          sentAt: null,
          deliveredAt: null,
          errorMessage: null,
        },
      });

      render(<ScheduleForm />);

      await user.type(screen.getByLabelText("Phone Number"), "+15551234567");
      await user.type(screen.getByLabelText("Message"), "Hello");
      await user.click(
        screen.getByRole("button", { name: /schedule message/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText("Message scheduled successfully!")
        ).toBeInTheDocument();
      });
    });

    it("calls onMessageCreated callback after success", async () => {
      const user = userEvent.setup();
      const onCreated = vi.fn();
      mockApi.createMessage.mockResolvedValue({
        data: {
          id: 1,
          phone: "+15551234567",
          body: "Hello",
          status: "QUEUED",
          scheduledAt: null,
          createdAt: "2026-03-26T10:00:00Z",
          updatedAt: "2026-03-26T10:00:00Z",
          sentAt: null,
          deliveredAt: null,
          errorMessage: null,
        },
      });

      render(<ScheduleForm onMessageCreated={onCreated} />);

      await user.type(screen.getByLabelText("Phone Number"), "+15551234567");
      await user.type(screen.getByLabelText("Message"), "Hello");
      await user.click(
        screen.getByRole("button", { name: /schedule message/i })
      );

      await waitFor(() => {
        expect(onCreated).toHaveBeenCalledTimes(1);
      });
    });

    it("shows error message on failure", async () => {
      const user = userEvent.setup();
      mockApi.createMessage.mockRejectedValue(
        new Error("Validation failed")
      );

      render(<ScheduleForm />);

      await user.type(screen.getByLabelText("Phone Number"), "+15551234567");
      await user.type(screen.getByLabelText("Message"), "Hello");
      await user.click(
        screen.getByRole("button", { name: /schedule message/i })
      );

      await waitFor(() => {
        expect(screen.getByText("Validation failed")).toBeInTheDocument();
      });
    });

    it("shows generic error for non-Error exceptions", async () => {
      const user = userEvent.setup();
      mockApi.createMessage.mockRejectedValue("unknown");

      render(<ScheduleForm />);

      await user.type(screen.getByLabelText("Phone Number"), "+15551234567");
      await user.type(screen.getByLabelText("Message"), "Hello");
      await user.click(
        screen.getByRole("button", { name: /schedule message/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText("Failed to schedule message")
        ).toBeInTheDocument();
      });
    });
  });
});
