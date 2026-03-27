import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from "@/components/ui/responsive-modal";

// Mock useIsMobile
const mockUseIsMobile = vi.fn(() => false);
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

function TestModal({ open = true }: { open?: boolean }) {
  return (
    <ResponsiveModal open={open} onOpenChange={vi.fn()}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Test Title</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Test description
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <div>Body content</div>
        <ResponsiveModalFooter>
          <button>Footer button</button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

describe("ResponsiveModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("desktop (Dialog)", () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(false);
    });

    it("renders Dialog primitives on desktop", async () => {
      const { container } = render(<TestModal />);

      await waitFor(() => {
        expect(screen.getByText("Test Title")).toBeInTheDocument();
      });

      expect(
        container.ownerDocument.querySelector('[data-slot="dialog-overlay"]')
      ).toBeInTheDocument();
      expect(
        container.ownerDocument.querySelector('[data-slot="dialog-content"]')
      ).toBeInTheDocument();
      expect(
        container.ownerDocument.querySelector('[data-slot="dialog-header"]')
      ).toBeInTheDocument();
      expect(
        container.ownerDocument.querySelector('[data-slot="dialog-title"]')
      ).toBeInTheDocument();
      expect(
        container.ownerDocument.querySelector('[data-slot="dialog-description"]')
      ).toBeInTheDocument();
      expect(
        container.ownerDocument.querySelector('[data-slot="dialog-footer"]')
      ).toBeInTheDocument();
    });

    it("does not render Drawer primitives on desktop", async () => {
      const { container } = render(<TestModal />);

      await waitFor(() => {
        expect(screen.getByText("Test Title")).toBeInTheDocument();
      });

      expect(
        container.ownerDocument.querySelector('[data-slot="drawer-content"]')
      ).not.toBeInTheDocument();
    });

    it("renders all content", async () => {
      render(<TestModal />);

      await waitFor(() => {
        expect(screen.getByText("Test Title")).toBeInTheDocument();
        expect(screen.getByText("Test description")).toBeInTheDocument();
        expect(screen.getByText("Body content")).toBeInTheDocument();
        expect(screen.getByText("Footer button")).toBeInTheDocument();
      });
    });

    it("shows close button by default", async () => {
      render(<TestModal />);

      await waitFor(() => {
        expect(screen.getByText("Close", { exact: false })).toBeInTheDocument();
      });
    });
  });

  describe("mobile (Drawer)", () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(true);
    });

    it("renders Drawer primitives on mobile", async () => {
      const { container } = render(<TestModal />);

      await waitFor(() => {
        expect(screen.getByText("Test Title")).toBeInTheDocument();
      });

      expect(
        container.ownerDocument.querySelector('[data-slot="drawer-content"]')
      ).toBeInTheDocument();
      expect(
        container.ownerDocument.querySelector('[data-slot="drawer-header"]')
      ).toBeInTheDocument();
      expect(
        container.ownerDocument.querySelector('[data-slot="drawer-title"]')
      ).toBeInTheDocument();
      expect(
        container.ownerDocument.querySelector('[data-slot="drawer-description"]')
      ).toBeInTheDocument();
    });

    it("does not render Dialog primitives on mobile", async () => {
      const { container } = render(<TestModal />);

      await waitFor(() => {
        expect(screen.getByText("Test Title")).toBeInTheDocument();
      });

      expect(
        container.ownerDocument.querySelector('[data-slot="dialog-content"]')
      ).not.toBeInTheDocument();
    });

    it("renders all content on mobile", async () => {
      render(<TestModal />);

      await waitFor(() => {
        expect(screen.getByText("Test Title")).toBeInTheDocument();
        expect(screen.getByText("Test description")).toBeInTheDocument();
        expect(screen.getByText("Body content")).toBeInTheDocument();
        expect(screen.getByText("Footer button")).toBeInTheDocument();
      });
    });
  });

  describe("open/close behavior", () => {
    it("renders nothing when closed on desktop", () => {
      mockUseIsMobile.mockReturnValue(false);

      render(<TestModal open={false} />);

      expect(screen.queryByText("Test Title")).not.toBeInTheDocument();
    });

    it("renders nothing when closed on mobile", () => {
      mockUseIsMobile.mockReturnValue(true);

      render(<TestModal open={false} />);

      expect(screen.queryByText("Test Title")).not.toBeInTheDocument();
    });
  });

  describe("switching between mobile and desktop", () => {
    it("switches from Dialog to Drawer when viewport changes", async () => {
      mockUseIsMobile.mockReturnValue(false);

      const { container, rerender } = render(<TestModal />);

      await waitFor(() => {
        expect(
          container.ownerDocument.querySelector('[data-slot="dialog-content"]')
        ).toBeInTheDocument();
      });

      mockUseIsMobile.mockReturnValue(true);
      rerender(<TestModal />);

      await waitFor(() => {
        expect(
          container.ownerDocument.querySelector('[data-slot="drawer-content"]')
        ).toBeInTheDocument();
      });
    });
  });
});
