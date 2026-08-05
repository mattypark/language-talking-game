"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/**
 * Motion 4. Bottom sheet on small screens, centred panel above 640px.
 * Backdrop fades, panel travels 12px. Nothing scales, nothing springs.
 *
 * Uses <dialog> so focus containment, Esc, and inertness come from the
 * platform rather than a hand-rolled trap.
 */
export function Sheet({ isOpen, onClose, title, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Fires on Esc as well as on programmatic close.
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      className="sheet m-0 max-h-full w-full max-w-none bg-transparent p-0 backdrop:bg-transparent sm:m-auto sm:max-w-md"
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="sheet__backdrop" aria-hidden="true" />
      <div className="sheet__panel relative mt-auto p-6 sm:rounded-[var(--radius-lg)]">
        <h2 className="t-title-2 mb-4">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
