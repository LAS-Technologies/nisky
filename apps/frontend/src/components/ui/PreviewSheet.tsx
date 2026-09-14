"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const MOBILE_PREVIEW_QUERY = "(max-width: 1023px)";

type PreviewSheetProps = {
  title: ReactNode;
  eyebrow?: string;
  eyebrowBadge?: boolean;
  eyebrowClassName?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  headerExtra?: ReactNode;
  bodyHeader?: ReactNode;
  eyebrowIcon?: LucideIcon;
  onClose: () => void;
  titleClassName?: string;
  titlePlacement?: "header" | "body";
  wide?: boolean;
  extraWide?: boolean;
  tall?: boolean;
};

function useIsMobilePreview() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_PREVIEW_QUERY);
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function PreviewHeader({
  primitive,
  title,
  eyebrow,
  eyebrowBadge = false,
  eyebrowClassName,
  description,
  eyebrowIcon: EyebrowIcon,
  titleClassName,
  titlePlacement = "header",
}: Pick<PreviewSheetProps, "title" | "eyebrow" | "eyebrowBadge" | "eyebrowClassName" | "description" | "eyebrowIcon" | "titleClassName" | "titlePlacement"> & {
  primitive: "dialog" | "drawer";
}) {
  const content = (
    <div className="min-w-0 flex-1">
      {eyebrow && (eyebrowBadge || EyebrowIcon ? (
        <span className={cn(
          eyebrowBadge
            ? "inline-flex h-7 items-center gap-1.5 rounded-full border border-primary/15 bg-primary-fixed px-2.5 font-label-md text-label-md font-medium normal-case text-primary"
            : "inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary-fixed px-2.5 py-0.5 font-label-caps text-label-caps uppercase text-primary",
          eyebrowClassName,
        )}>
          {EyebrowIcon && <EyebrowIcon aria-hidden="true" size={14} />}
          {eyebrow}
        </span>
      ) : (
        <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">{eyebrow}</p>
      ))}
      {primitive === "drawer" ? (
        <DrawerTitle className={titlePlacement === "body" ? "sr-only" : cn("mt-1 min-w-0 break-words text-xl leading-7 [overflow-wrap:anywhere]", titleClassName)}>{title}</DrawerTitle>
      ) : (
        <DialogTitle className={titlePlacement === "body" ? "sr-only" : cn("mt-1 min-w-0 break-words text-xl leading-7 [overflow-wrap:anywhere]", titleClassName)}>{title}</DialogTitle>
      )}
      {description && (primitive === "drawer" ? (
        <DrawerDescription className="mt-1 line-clamp-2">{description}</DrawerDescription>
      ) : (
        <DialogDescription className="mt-1 line-clamp-2">{description}</DialogDescription>
      ))}
    </div>
  );
  const closeButton = (
    <button
      aria-label="Cerrar vista previa"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
      type="button"
    >
      <X size={19} />
    </button>
  );
  const close = primitive === "drawer" ? (
    <DrawerClose asChild>{closeButton}</DrawerClose>
  ) : (
    <DialogClose asChild>{closeButton}</DialogClose>
  );
  const className = cn(
    "flex shrink-0 flex-row justify-between gap-4 border-b border-outline-variant px-5 py-4 !text-left lg:px-6",
    titlePlacement === "body" ? "items-center" : "items-start",
  );

  return primitive === "drawer" ? (
    <DrawerHeader className={className}>
      {content}
      {close}
    </DrawerHeader>
  ) : (
    <DialogHeader className={className}>
      {content}
      {close}
    </DialogHeader>
  );
}

function PreviewBody({ bodyHeader, children, footer }: Pick<PreviewSheetProps, "bodyHeader" | "children" | "footer">) {
  return (
    <>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 lg:px-6" data-modal-scroll>
        {bodyHeader}
        {children}
      </div>
      {footer && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-outline-variant bg-surface-bright px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-[0_-4px_16px_rgba(15,23,42,0.03)] lg:px-6">
          {footer}
        </div>
      )}
    </>
  );
}

function MobilePreviewSheet({
  title,
  eyebrow,
  description,
  children,
  footer,
  headerExtra,
  bodyHeader,
  eyebrowBadge,
  eyebrowClassName,
  eyebrowIcon,
  onClose,
  titleClassName,
  titlePlacement,
  tall = false,
}: PreviewSheetProps) {
  const [open, setOpen] = useState(true);
  const closeNotifiedRef = useRef(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) closeNotifiedRef.current = false;
    setOpen(nextOpen);
  };

  const handleAnimationEnd = (nextOpen: boolean) => {
    if (nextOpen || closeNotifiedRef.current) return;
    closeNotifiedRef.current = true;
    onClose();
  };

  return (
    <Drawer
      fixed
      handleOnly
      onAnimationEnd={handleAnimationEnd}
      onOpenChange={handleOpenChange}
      open={open}
    >
      <DrawerContent
        className={cn(
          "flex min-h-0 w-full max-w-none rounded-t-[1.75rem] border-outline-variant bg-surface-bright p-0 shadow-cadence-3",
          tall
            ? "h-[min(94svh,52rem)] !max-h-[94svh]"
            : "h-[min(88svh,48rem)] max-h-[88svh]",
        )}
      >
        <PreviewHeader
          description={description}
          eyebrow={eyebrow}
          eyebrowBadge={eyebrowBadge}
          eyebrowClassName={eyebrowClassName}
          eyebrowIcon={eyebrowIcon}
          primitive="drawer"
          title={title}
          titleClassName={titleClassName}
          titlePlacement={titlePlacement}
        />
        {headerExtra}
        <PreviewBody bodyHeader={bodyHeader} footer={footer}>{children}</PreviewBody>
      </DrawerContent>
    </Drawer>
  );
}

function DesktopPreviewSheet({
  title,
  eyebrow,
  description,
  children,
  footer,
  headerExtra,
  bodyHeader,
  eyebrowBadge,
  eyebrowClassName,
  eyebrowIcon,
  onClose,
  titleClassName,
  titlePlacement,
  wide = false,
  extraWide = false,
}: PreviewSheetProps) {
  return (
    <Dialog modal={false} open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={cn(
          "fixed inset-x-0 bottom-0 left-0 right-0 top-auto z-50 flex h-[min(88dvh,48rem)] max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-b-none rounded-t-[1.75rem] border-outline-variant bg-surface-bright p-0 shadow-cadence-3 outline-none transition-transform duration-200 sm:max-w-none lg:inset-y-0 lg:bottom-0 lg:left-auto lg:right-0 lg:top-0 lg:h-full lg:max-h-full lg:rounded-l-2xl lg:rounded-r-none lg:rounded-t-none lg:shadow-[-8px_0_24px_-4px_rgba(15,23,42,0.06)]",
           wide
             ? extraWide
               ? "lg:w-[min(46rem,100vw)]"
               : "lg:w-[min(42rem,100vw)]"
             : "lg:w-[min(29rem,100vw)]",
        )}
        data-preview-sheet="true"
        onInteractOutside={(event) => {
          const target = event.target;
          if (target instanceof Element && target.closest('[data-preview-floating="true"]')) return;
          event.preventDefault();
        }}
        overlayClassName="preview-sheet-overlay lg:!pointer-events-none lg:bg-transparent lg:backdrop-blur-none"
        showCloseButton={false}
      >
        <PreviewHeader
          description={description}
          eyebrow={eyebrow}
          eyebrowBadge={eyebrowBadge}
          eyebrowClassName={eyebrowClassName}
          eyebrowIcon={eyebrowIcon}
          primitive="dialog"
          title={title}
          titleClassName={titleClassName}
          titlePlacement={titlePlacement}
        />
        {headerExtra}
        <PreviewBody bodyHeader={bodyHeader} footer={footer}>{children}</PreviewBody>
      </DialogContent>
    </Dialog>
  );
}

export function PreviewSheet(props: PreviewSheetProps) {
  const isMobile = useIsMobilePreview();
  if (isMobile === null) return null;
  return isMobile ? <MobilePreviewSheet {...props} /> : <DesktopPreviewSheet {...props} />;
}
