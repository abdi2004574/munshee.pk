import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isDestructive?: boolean;
  children?: ReactNode;
}

const DESTRUCTIVE_BTN =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-danger text-white hover:bg-red-600 focus-visible:ring-danger";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isDestructive = true,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    if (isLoading) return;
    onCancel();
  }, [isLoading, onCancel]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/50"
    >
      <div className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {description && (
          <p className="mt-2 text-sm text-ink-muted">{description}</p>
        )}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={handleCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          {isDestructive ? (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className={DESTRUCTIVE_BTN}
            >
              {isLoading ? "Working..." : confirmLabel}
            </button>
          ) : (
            <Button variant="primary" onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? "Working..." : confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </dialog>
  );
}
