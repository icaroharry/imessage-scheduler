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

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: ({ children }: any) => <div>{children}</div>,
  Cell: () => null,
  Tooltip: () => null,
  Label: () => null,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
}));

// Must import after mocks are set up
const { default: DashboardPage } = await import(
  "@/app/dashboard/page"
);

describe("DashboardPage", () => {
  beforeEach(() => {
    sseData = {
      messages: [],
      stats: null,
      gatewayStatus: "checking",
      connected: true,
    };
  });

  it("renders the page heading", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders the page description", () => {
    render(<DashboardPage />);
    expect(
      screen.getByText("Monitor your scheduled messages and delivery status.")
    ).toBeInTheDocument();
  });

  it("renders KPI cards section", () => {
    sseData.stats = {
      total: 10,
      queued: 1,
      accepted: 1,
      sent: 3,
      delivered: 4,
      failed: 1,
    };
    render(<DashboardPage />);
    expect(screen.getByText("Success Rate")).toBeInTheDocument();
    expect(screen.getByText("Avg Delivery Time")).toBeInTheDocument();
    expect(screen.getByText("Throughput")).toBeInTheDocument();
  });

  it("renders chart sections", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Status Distribution")).toBeInTheDocument();
    expect(screen.getByText("24-Hour Activity")).toBeInTheDocument();
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  });

  it("renders message table", () => {
    render(<DashboardPage />);
    expect(screen.getByText("All Messages")).toBeInTheDocument();
  });

  it("shows success rate when stats are available", () => {
    sseData.stats = {
      total: 10,
      queued: 0,
      accepted: 0,
      sent: 3,
      delivered: 5,
      failed: 2,
    };
    render(<DashboardPage />);
    // (3 + 5) / (3 + 5 + 2) * 100 = 80.0%
    expect(screen.getByText("80.0%")).toBeInTheDocument();
  });

  it("shows N/A for delivery time when no delivered messages", () => {
    sseData.stats = {
      total: 5,
      queued: 5,
      accepted: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
    };
    render(<DashboardPage />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("renders activity timeline messages", () => {
    sseData.messages = [
      createMessage({
        id: 1,
        phone: "+15551111111",
        body: "Test message",
        status: "DELIVERED",
        updatedAt: new Date().toISOString(),
      }),
    ];
    sseData.stats = {
      total: 1,
      queued: 0,
      accepted: 0,
      sent: 0,
      delivered: 1,
      failed: 0,
    };
    render(<DashboardPage />);
    // Phone appears both in timeline and table
    const phoneElements = screen.getAllByText("+15551111111");
    expect(phoneElements.length).toBeGreaterThanOrEqual(1);
  });
});
