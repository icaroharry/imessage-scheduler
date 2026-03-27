"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  MessageSquare,
  LayoutDashboard,
  Settings,
  Send,
  Activity,
  Clock,
} from "lucide-react"
import { useEffect, useState } from "react"

const navItems = [
  {
    title: "Schedule",
    url: "/",
    icon: Send,
    description: "Schedule new messages",
  },
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    description: "Monitor all messages",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    description: "Scheduler configuration",
  },
]

function GatewayStatus() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">(
    "checking"
  )

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("http://localhost:3002/health")
        setStatus(res.ok ? "online" : "offline")
      } catch {
        setStatus("offline")
      }
    }
    check()
    const interval = setInterval(check, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="px-2 py-2">
      <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
          <Activity className="h-3 w-3" />
          System Status
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Gateway</span>
            <span className="flex items-center gap-1">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  status === "online"
                    ? "bg-emerald-500"
                    : status === "offline"
                      ? "bg-red-500"
                      : "bg-yellow-500 animate-pulse"
                }`}
              />
              <span
                className={
                  status === "online"
                    ? "text-emerald-600"
                    : status === "offline"
                      ? "text-red-600"
                      : "text-yellow-600"
                }
              >
                {status === "online"
                  ? "Online"
                  : status === "offline"
                    ? "Offline"
                    : "Checking..."}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Scheduler</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-blue-500" />
              <span className="text-blue-600">Active</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <MessageSquare className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold">iScheduler</span>
                <span className="truncate text-xs text-muted-foreground">
                  iMessage Automation
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => {
              const isActive = pathname === item.url
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={isActive}
                    render={<Link href={item.url} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <GatewayStatus />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
