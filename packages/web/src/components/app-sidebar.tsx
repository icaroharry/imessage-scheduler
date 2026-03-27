"use client"

import * as React from "react"
import Image from "next/image"
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
import { MessageSquare, Clock } from "lucide-react"
import { useSSEData } from "@/components/sse-provider"

const navItems = [
  {
    title: "Queue",
    url: "/",
    icon: "/icons/queue.svg",
    description: "Schedule new messages",
  },
  {
    title: "Metrics",
    url: "/dashboard",
    icon: "/icons/metrics.svg",
    description: "Monitor all messages",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: "/icons/settings.svg",
    description: "Scheduler configuration",
  },
]

function GatewayStatus() {
  const { gatewayStatus: status } = useSSEData()

  return (
    <div className="px-2 py-2 group-data-[collapsible=icon]:hidden">
      <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
          <MessageSquare className="h-3 w-3" />
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
              <div className="flex aspect-square size-8 items-center justify-center rounded-xl bg-[linear-gradient(180deg,rgba(211,200,249,0.7),rgba(211,200,249,0.3))] ring-1 ring-[#846FEB]/15">
                <Image
                  src="/icons/logo.svg"
                  alt="Sendpurple"
                  width={48}
                  height={48}
                  className="size-5 object-contain"
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold">Sendpurple</span>
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
                    <Image
                      src={item.icon}
                      alt=""
                      aria-hidden="true"
                      width={48}
                      height={48}
                      className="size-4.5 object-contain"
                    />
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
