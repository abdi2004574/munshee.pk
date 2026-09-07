import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { t } from "@/i18n";

interface PlanGatingErrorProps {
  open: boolean;
  onClose: () => void;
  mode: "actions_exhausted" | "feature_cap";
  feature?: string;
  actionsLeft?: number;
  actionsMonthly?: number;
}

export function PlanGatingError({ open, onClose, mode, feature, actionsLeft = 0, actionsMonthly = 0 }: PlanGatingErrorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  function handleUpgrade() {
    onClose();
    navigate("/apps/billing");
  }

  const isActions = mode === "actions_exhausted";

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/50"
    >
      <div className="relative w-full max-w-md">
        <div className={`absolute top-0 right-0 h-1.5 w-12 rounded-bl-full ${isActions ? "bg-brand-500" : "bg-amber-500"}`}></div>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <Icon
                name={isActions ? "gift" : "alert-triangle"}
                size={24}
                className={isActions ? "text-brand-500" : "text-amber-500"}
              />
            </div>
            <div className="flex-1">
              {isActions ? (
                <>
                  <h2 className="text-lg font-semibold text-brand-600">
                    {t("errors.actions_exhausted_modal.celebration_title")}
                  </h2>
                  <p className="mt-2 text-sm text-ink-muted">
                    {t("errors.actions_exhausted_modal.celebration_message")}
                  </p>
                  {actionsMonthly > 0 && (
                    <div className="mt-3 rounded-lg bg-brand-50 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-ink-muted">{t("billing.actions_left")}</span>
                        <span className="font-medium tabular-nums text-ink">
                          {actionsLeft} / {actionsMonthly}
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-2 rounded-full bg-brand-500 transition-all"
                          style={{
                            width: `${Math.min(100, (actionsLeft / actionsMonthly) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-amber-600">
                    {t("errors.feature_cap_modal.title")}
                  </h2>
                  <p className="mt-2 text-sm text-ink-muted">
                    {t("errors.feature_cap_modal.message")}
                  </p>
                  {feature && (
                    <div className="mt-3 rounded-lg bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-700">
                        {t("errors.feature_cap_modal.feature_label")}: {feature}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {isActions ? t("errors.actions_exhausted_modal.close") : t("errors.feature_cap_modal.close")}
            </Button>
            <Button onClick={handleUpgrade}>
              {isActions ? t("errors.actions_exhausted_modal.cta") : t("errors.feature_cap_modal.cta")}
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
