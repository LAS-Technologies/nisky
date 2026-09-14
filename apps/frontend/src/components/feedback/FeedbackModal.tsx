"use client";

import { X } from "lucide-react";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function FeedbackModal({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="flex max-h-[90dvh] max-w-md flex-col overflow-y-auto rounded-lg border-outline-variant bg-surface p-5" keyboardAware showCloseButton={false}>
        <DialogHeader className="mb-4 flex-row items-center justify-between text-left">
          <DialogTitle className="font-headline-sm text-headline-sm normal-case tracking-normal">Enviar feedback</DialogTitle>
          <DialogDescription className="sr-only">Comparte tus comentarios sobre Nisky.</DialogDescription>
          <DialogClose asChild>
            <button aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" type="button">
              <X size={20} />
            </button>
          </DialogClose>
        </DialogHeader>
        <FeedbackForm />
      </DialogContent>
    </Dialog>
  );
}
