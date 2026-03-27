"use client"

import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

const ResponsiveModalContext = React.createContext<{ isMobile: boolean }>({
  isMobile: false,
})

function useResponsiveModal() {
  return React.useContext(ResponsiveModalContext)
}

interface ResponsiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function ResponsiveModal({ open, onOpenChange, children }: ResponsiveModalProps) {
  const isMobile = useIsMobile()

  return (
    <ResponsiveModalContext.Provider value={{ isMobile }}>
      {isMobile ? (
        <Drawer open={open} onOpenChange={onOpenChange}>
          {children}
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      )}
    </ResponsiveModalContext.Provider>
  )
}

function ResponsiveModalContent({
  className,
  children,
  showCloseButton,
  ...props
}: React.ComponentProps<"div"> & { showCloseButton?: boolean }) {
  const { isMobile } = useResponsiveModal()

  if (isMobile) {
    return (
      <DrawerContent className={className}>
        {children}
      </DrawerContent>
    )
  }

  return (
    <DialogContent className={className} showCloseButton={showCloseButton} {...props}>
      {children}
    </DialogContent>
  )
}

function ResponsiveModalHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { isMobile } = useResponsiveModal()

  if (isMobile) {
    return <DrawerHeader className={className} {...props} />
  }

  return <DialogHeader className={className} {...props} />
}

function ResponsiveModalTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { isMobile } = useResponsiveModal()

  if (isMobile) {
    return <DrawerTitle className={className}>{children}</DrawerTitle>
  }

  return <DialogTitle className={className}>{children}</DialogTitle>
}

function ResponsiveModalDescription({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { isMobile } = useResponsiveModal()

  if (isMobile) {
    return <DrawerDescription className={className}>{children}</DrawerDescription>
  }

  return <DialogDescription className={className}>{children}</DialogDescription>
}

function ResponsiveModalFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { isMobile } = useResponsiveModal()

  if (isMobile) {
    return <DrawerFooter className={className} {...props} />
  }

  return <DialogFooter className={cn("border-t-0 bg-transparent", className)} {...props} />
}

export {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
}
