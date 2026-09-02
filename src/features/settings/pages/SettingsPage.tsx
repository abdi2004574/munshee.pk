import { useState } from "react";
import { useTenant, useUpdateTenant, useAppSettings, useUpdateAppSettings } from "../hooks";
import { Card } from "@/components/Card";
import { FormField } from "@/components/FormField";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";

const LOCALES = [
  { value: "en-PK", label: "English (Pakistan)" },
  { value: "en-US", label: "English (United States)" },
  { value: "ur-PK", label: "Urdu (Pakistan)" },
] as const;

const CURRENCIES = [
  { value: "PKR", label: "PKR" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
] as const;

const TIMEZONES = [
  { value: "Asia/Karachi", label: "Asia/Karachi" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New_York" },
] as const;

export function SettingsPage() {
  const tenant = useTenant();
  const updateTenant = useUpdateTenant();
  const settings = useAppSettings();
  const updateSettings = useUpdateAppSettings();

  const [displayName, setDisplayName] = useState(tenant.data?.display_name ?? "");
  const [locale, setLocale] = useState(settings.data?.locale ?? "en-PK");
  const [currency, setCurrency] = useState(settings.data?.currency ?? "PKR");
  const [timezone, setTimezone] = useState(settings.data?.timezone ?? "Asia/Karachi");

  const [savedTenant, setSavedTenant] = useState(false);
  const [savedSettings, setSavedSettings] = useState(false);

  const isTenantPending = updateTenant.isPending;
  const isSettingsPending = updateSettings.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="text-sm text-ink-muted">Manage your store preferences.</p>
      </div>

      <Card className="p-6 space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-ink mb-4">Tenant Settings</h2>
          <div className="max-w-md space-y-4">
            <Input
              label="Display Name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setSavedTenant(false);
              }}
              disabled={isTenantPending}
            />
            <Button
              variant="primary"
              disabled={isTenantPending || displayName === tenant.data?.display_name}
              onClick={async () => {
                await updateTenant.mutateAsync({ display_name: displayName });
                setSavedTenant(true);
              }}
            >
              {isTenantPending ? "Saving..." : "Save tenant"}
            </Button>
            {savedTenant && (
              <p className="text-sm text-success">Saved successfully</p>
            )}
          </div>
        </section>

        <hr className="border-gray-100" />

        <section>
          <h2 className="text-lg font-semibold text-ink mb-4">App Settings</h2>
          <div className="max-w-md space-y-4">
            <FormField label="Locale">
              <Select
                value={locale}
                onChange={(v) => {
                  setLocale(v);
                  setSavedSettings(false);
                }}
                options={LOCALES.map((o) => ({ value: o.value, label: o.label }))}
              />
            </FormField>
            <FormField label="Currency">
              <Select
                value={currency}
                onChange={(v) => {
                  setCurrency(v);
                  setSavedSettings(false);
                }}
                options={CURRENCIES.map((o) => ({ value: o.value, label: o.label }))}
              />
            </FormField>
            <FormField label="Timezone">
              <Select
                value={timezone}
                onChange={(v) => {
                  setTimezone(v);
                  setSavedSettings(false);
                }}
                options={TIMEZONES.map((o) => ({ value: o.value, label: o.label }))}
              />
            </FormField>
            <Button
              variant="primary"
              disabled={
                isSettingsPending ||
                (locale === settings.data?.locale &&
                  currency === settings.data?.currency &&
                  timezone === settings.data?.timezone)
              }
              onClick={async () => {
                await updateSettings.mutateAsync({ locale, currency, timezone });
                setSavedSettings(true);
              }}
            >
              {isSettingsPending ? "Saving..." : "Save app settings"}
            </Button>
            {savedSettings && (
              <p className="text-sm text-success">Saved successfully</p>
            )}
          </div>
        </section>
      </Card>
    </div>
  );
}
