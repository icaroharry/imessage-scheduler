import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewMessageDialog } from "@/components/new-message-dialog";

// Mock the API
vi.mock("@/lib/api", () => ({
  api: {
    createMessage: vi.fn(),
  },
}));

// Mock useIsMobile to control responsive behavior
const mockUseIsMobile = vi.fn(() => false);
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

import { api } from "@/lib/api";
const mockApi = vi.mocked(api);

describe("NewMessageDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
  });

  describe("when open", () => {
    it("renders the dialog title", async () => {
      render(
        <NewMessageDialog
          open={true}
          onOpenChange={vi.fn()}
          onMessageCreated={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("New Message")).toBeInTheDocument();
      });
    });

    it("renders the description", async () => {
      render(
        <NewMessageDialog
          open={true}
          onOpenChange={vi.fn()}
          onMessageCreated={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            "Enter a phone number and message to add it to the queue."
          )
        ).toBeInTheDocument();
      });
    });

    it("renders the schedule form", async () => {
      render(
        <NewMessageDialog
          open={true}
          onOpenChange={vi.fn()}
          onMessageCreated={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText("Phone Number")).toBeInTheDocument();
        expect(screen.getByLabelText("Message")).toBeInTheDocument();
      });
    });
  });

  describe("when closed", () => {
    it("does not render dialog content", () => {
      render(
        <NewMessageDialog
          open={false}
          onOpenChange={vi.fn()}
          onMessageCreated={vi.fn()}
        />
      );

      expect(screen.queryByText("New Message")).not.toBeInTheDocument();
    });
  });

  describe("on successful message creation", () => {
    it("calls onMessageCreated and closes dialog", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const onMessageCreated = vi.fn();
      mockApi.createMessage.mockResolvedValue({
        data: {
          id: 1,
          phone: "+15551234567",
          body: "Test",
          status: "QUEUED",
          scheduledAt: null,
          createdAt: "2026-03-26T10:00:00Z",
          updatedAt: "2026-03-26T10:00:00Z",
          sentAt: null,
          deliveredAt: null,
          errorMessage: null,
        },
      });

      render(
        <NewMessageDialog
          open={true}
          onOpenChange={onOpenChange}
          onMessageCreated={onMessageCreated}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText("Phone Number")).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText("Phone Number"), "+15551234567");
      await user.type(screen.getByLabelText("Message"), "Test");
      await user.click(
        screen.getByRole("button", { name: /schedule message/i })
      );

      await waitFor(() => {
        expect(onMessageCreated).toHaveBeenCalledTimes(1);
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe("responsive behavior", () => {
    it("uses Dialog on desktop", async () => {
      mockUseIsMobile.mockReturnValue(false);

      const { container } = render(
        <NewMessageDialog
          open={true}
          onOpenChange={vi.fn()}
          onMessageCreated={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("New Message")).toBeInTheDocument();
      });

      // Dialog uses data-slot="dialog-content"
      expect(
        container.ownerDocument.querySelector('[data-slot="dialog-content"]')
      ).toBeInTheDocument();
    });

    it("uses Drawer on mobile", async () => {
      mockUseIsMobile.mockReturnValue(true);

      const { container } = render(
        <NewMessageDialog
          open={true}
          onOpenChange={vi.fn()}
          onMessageCreated={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("New Message")).toBeInTheDocument();
      });

      // Drawer uses data-slot="drawer-content"
      expect(
        container.ownerDocument.querySelector('[data-slot="drawer-content"]')
      ).toBeInTheDocument();
    });
  });
});
