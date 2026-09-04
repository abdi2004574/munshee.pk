import { useToast } from "./Toast";
import type { Toast } from "./Toast";

const typeStyles: Record<Toast["type"], string> = {
  success: "border-success/30 bg-success/10 text-success",
  error: "border-danger/30 bg-danger/10 text-danger",
  info: "border-brand-200 bg-brand-50 text-brand-700",
  warning: "border-warning/30 bg-warning/10 text-warning",
};

export function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${typeStyles[toast.type]}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
