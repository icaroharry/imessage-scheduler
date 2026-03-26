const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export type MessageStatus =
  | "QUEUED"
  | "ACCEPTED"
  | "SENT"
  | "DELIVERED"
  | "FAILED";

export interface Message {
  id: number;
  phone: string;
  body: string;
  status: MessageStatus;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  errorMessage: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface Stats {
  total: number;
  queued: number;
  accepted: number;
  sent: number;
  delivered: number;
  failed: number;
}

export interface SchedulerConfig {
  sendIntervalMs: number;
  gatewayUrl: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options?: RequestInit,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: "Request failed",
      }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Messages
  async getMessages(params?: {
    status?: MessageStatus;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Message>> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));

    const query = searchParams.toString();
    return this.request(`/messages${query ? `?${query}` : ""}`);
  }

  async getMessage(id: number): Promise<{ data: Message }> {
    return this.request(`/messages/${id}`);
  }

  async createMessage(data: {
    phone: string;
    body: string;
    scheduledAt?: string;
  }): Promise<{ data: Message }> {
    return this.request("/messages", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteMessage(id: number): Promise<{ message: string }> {
    return this.request(`/messages/${id}`, {
      method: "DELETE",
    });
  }

  async getStats(): Promise<{ data: Stats }> {
    return this.request("/messages/stats/summary");
  }

  // Config
  async getConfig(): Promise<{ data: SchedulerConfig }> {
    return this.request("/config");
  }

  async updateConfig(
    data: Partial<SchedulerConfig>,
  ): Promise<{ data: SchedulerConfig }> {
    return this.request("/config", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // Health
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request("/health");
  }
}

export const api = new ApiClient();
