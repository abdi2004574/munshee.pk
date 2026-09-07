import { type ReactNode } from "react";

interface FreeWatermarkProps {
  children: ReactNode;
  enabled?: boolean;
}

export function FreeWatermark({
  children,
  enabled = false,
}: FreeWatermarkProps) {
  return (
    <>
      {children}
      {enabled && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-10 select-none">
          <span
            className="text-xs font-medium text-brand-500/25 sm:text-sm"
            style={{ transform: "rotate(-45deg)" }}
          >
            Made free with Munshee.pk
          </span>
        </div>
      )}
    </>
  );
}
