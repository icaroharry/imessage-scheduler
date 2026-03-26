"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { Send } from "lucide-react";

interface ScheduleFormProps {
  onMessageCreated?: () => void;
}

export function ScheduleForm({ onMessageCreated }: ScheduleFormProps) {
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        await api.createMessage({ phone, body });
        setPhone("");
        setBody("");
        setSuccess(true);
        onMessageCreated?.();
        setTimeout(() => setSuccess(false), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to schedule message");
      }
    });
  };

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="phone"
              className="text-sm font-medium text-gray-700"
            >
              Phone Number
            </label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="h-12 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="message"
              className="text-sm font-medium text-gray-700"
            >
              Message
            </label>
            <Textarea
              id="message"
              placeholder="Enter your message here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              maxLength={2000}
              className="rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white transition-colors resize-none"
            />
            <div className="text-xs text-gray-400 text-right">
              {body.length}/2000
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3">
              Message scheduled successfully!
            </div>
          )}

          <Button
            type="submit"
            disabled={isPending || !phone || !body}
            className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 shadow-md shadow-blue-500/25 transition-all duration-200"
          >
            <Send className="mr-2 h-4 w-4" />
            {isPending ? "Scheduling..." : "Schedule Message"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
