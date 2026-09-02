import type { ChangeEvent } from "react";
import { FormField } from "./FormField";

interface TextareaProps {
  label?: string;
  error?: string;
  id?: string;
  name?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  className?: string;
}

export function Textarea({
  label,
  error,
  id,
  name,
  value,
  onChange,
  rows = 4,
  className = "",
}: TextareaProps) {
  const fieldId = id ?? name ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <FormField label={label} error={error} htmlFor={fieldId}>
      <textarea
        id={fieldId}
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${
          error ? "border-danger" : "border-gray-200"
        } ${className}`}
      />
    </FormField>
  );
}
