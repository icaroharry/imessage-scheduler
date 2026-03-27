"use client";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal";
import { ScheduleForm } from "@/components/schedule-form";

interface NewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMessageCreated?: () => void;
}

export function NewMessageDialog({
  open,
  onOpenChange,
  onMessageCreated,
}: NewMessageDialogProps) {
  const handleCreated = () => {
    onMessageCreated?.();
    onOpenChange(false);
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>New Message</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Enter a phone number and message to add it to the queue.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <div className="px-4 pb-4">
          <ScheduleForm onMessageCreated={handleCreated} />
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
