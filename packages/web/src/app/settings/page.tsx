"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import type { SchedulerConfig } from "@/lib/api";
import {
  Clock,
  Globe,
  Save,
  RefreshCw,
  CheckCircle2,
  Activity,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";

const INTERVAL_PRESETS = [
  { label: "6s (testing)", ms: 6000 },
  { label: "1 min", ms: 60000 },
  { label: "5 min", ms: 300000 },
  { label: "15 min", ms: 900000 },
  { label: "30 min", ms: 1800000 },
  { label: "1 hour", ms: 3600000 },
];

function formatInterval(ms: number): string {
  if (ms < 60000) return `${ms / 1000}s`;
  if (ms < 3600000) return `${ms / 60000} min`;
  return `${ms / 3600000} hour${ms > 3600000 ? "s" : ""}`;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<SchedulerConfig | null>(null);
  const [intervalMs, setIntervalMs] = useState("");
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [gatewayHealth, setGatewayHealth] = useState<{
    status: string;
    system?: {
      platform: string;
      isMacOS: boolean;
      chatDbAvailable: boolean;
      chatDbReadable: boolean;
    };
  } | null>(null);
  const [openingSettings, setOpeningSettings] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const result = await api.getConfig();
        setConfig(result.data);
        setIntervalMs(String(result.data.sendIntervalMs));
        setGatewayUrl(result.data.gatewayUrl);
      } catch (err) {
        console.error("Failed to fetch config:", err);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const checkGateway = async () => {
      try {
        const res = await fetch("http://localhost:3002/health");
        const data = await res.json();
        setGatewayHealth(data);
      } catch {
        setGatewayHealth(null);
      }
    };
    checkGateway();
  }, []);

  const handleSave = () => {
    setError(null);
    setSaved(false);

    startTransition(async () => {
      try {
        const result = await api.updateConfig({
          sendIntervalMs: Number(intervalMs),
          gatewayUrl,
        });
        setConfig(result.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save settings"
        );
      }
    });
  };

  if (!config) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted/50 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure the message scheduler and gateway connection.
        </p>
      </div>

      {/* Full Disk Access Banner */}
      {gatewayHealth?.system &&
        gatewayHealth.system.chatDbAvailable &&
        !gatewayHealth.system.chatDbReadable && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="py-4 px-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-amber-900">
                    Full Disk Access Required
                  </h3>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    Delivery tracking reads{" "}
                    <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px]">
                      ~/Library/Messages/chat.db
                    </code>{" "}
                    to confirm messages are delivered. Without Full Disk Access,
                    delivery status is estimated optimistically.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-amber-300 text-amber-800 hover:bg-amber-100"
                    disabled={openingSettings}
                    onClick={async () => {
                      setOpeningSettings(true);
                      try {
                        await fetch("http://localhost:3002/open-fda-settings", {
                          method: "POST",
                        });
                      } catch {
                        // fallback: tell user to open manually
                      } finally {
                        setOpeningSettings(false);
                      }
                    }}
                  >
                    <ExternalLink className="h-3 w-3 mr-1.5" />
                    {openingSettings
                      ? "Opening..."
                      : "Open Full Disk Access Settings"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Scheduler Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Scheduler
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Send Interval</Label>
            <p className="text-xs text-muted-foreground">
              How often the scheduler picks up the next queued message.
              Currently: <strong>{formatInterval(config.sendIntervalMs)}</strong>
            </p>
            <div className="flex gap-2 flex-wrap">
              {INTERVAL_PRESETS.map((preset) => (
                <Button
                  key={preset.ms}
                  variant={
                    Number(intervalMs) === preset.ms ? "default" : "outline"
                  }
                  size="sm"
                  className="text-xs"
                  onClick={() => setIntervalMs(String(preset.ms))}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={intervalMs}
                onChange={(e) => setIntervalMs(e.target.value)}
                placeholder="Milliseconds"
                min={1000}
                max={86400000}
                className="max-w-[200px]"
              />
              <span className="text-xs text-muted-foreground">ms</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Gateway URL</Label>
            <p className="text-xs text-muted-foreground">
              The URL of the iMessage gateway service.
            </p>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Input
                type="url"
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                placeholder="http://localhost:3002"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              {error}
            </div>
          )}

          {saved && (
            <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Settings saved! Restart the API to apply the new interval.
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={isPending}
            className="shadow-sm"
          >
            <Save className="h-4 w-4 mr-2" />
            {isPending ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Gateway Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            Gateway Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gatewayHealth ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  Online
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Last checked: {new Date().toLocaleTimeString()}
                </span>
              </div>
              {gatewayHealth.system && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Platform</span>
                    <span className="font-medium">
                      {gatewayHealth.system.platform}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">macOS</span>
                    <span className="font-medium">
                      {gatewayHealth.system.isMacOS ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Chat DB</span>
                    <span className="font-medium">
                      {gatewayHealth.system.chatDbAvailable
                        ? "Available"
                        : "Not found"}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">
                      Delivery Tracking
                    </span>
                    <span className="font-medium">
                      {gatewayHealth.system.chatDbReadable ? (
                        <span className="text-emerald-600">Active</span>
                      ) : (
                        <span className="text-amber-600">Optimistic</span>
                      )}
                    </span>
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Badge className="bg-red-100 text-red-700 border-red-200">
                Offline
              </Badge>
              <p className="text-sm text-muted-foreground">
                Gateway is not reachable. Make sure it&apos;s running on{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {gatewayUrl}
                </code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
