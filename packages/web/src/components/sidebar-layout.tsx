"use client"

import { createContext, useContext, useState, useCallback } from "react"
import { motion } from "motion/react"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { NewMessageDialog } from "@/components/new-message-dialog"
import { SSEProvider } from "@/components/sse-provider"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"
import { SPRING_BOUNCY } from "@/components/motion-primitives"

const pageTitles: Record<string, string> = {
  "/": "Messages",
  "/dashboard": "Dashboard",
  "/settings": "Settings",
}

interface NewMessageContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  refreshKey: number
}

const NewMessageContext = createContext<NewMessageContextValue>({
  open: false,
  setOpen: () => {},
  refreshKey: 0,
})

export function useNewMessage() {
  return useContext(NewMessageContext)
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const pageTitle = pageTitles[pathname] || "Sendpurple"
  const [dialogOpen, setDialogOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleMessageCreated = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  return (
    <NewMessageContext value={{ open: dialogOpen, setOpen: setDialogOpen, refreshKey }}>
      <SSEProvider>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center justify-between border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator
                  orientation="vertical"
                  className="mr-2 data-vertical:h-4 data-vertical:self-auto"
                />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbPage className="font-medium">
                        {pageTitle}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
              <div className="px-4">
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  transition={SPRING_BOUNCY}
                >
                  <Button
                    size="sm"
                    onClick={() => setDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">New Message</span>
                    <span className="sm:hidden">New</span>
                  </Button>
                </motion.div>
              </div>
            </header>
            <div className="flex-1">
              {children}
            </div>
          </SidebarInset>
          <NewMessageDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onMessageCreated={handleMessageCreated}
          />
        </SidebarProvider>
      </TooltipProvider>
      </SSEProvider>
    </NewMessageContext>
  )
}
