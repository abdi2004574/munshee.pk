import { FormField } from "./FormField";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  error?: string;
  id?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  className?: string;
  placeholder?: string;
}

export function Select({
  label,
  error,
  id,
  name,
  value,
  onChange,
  options,
  className = "",
  placeholder,
}: SelectProps) {
  const selectId = id ?? name ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <FormField label={label} error={error} htmlFor={selectId}>
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${
          error ? "border-danger" : "border-gray-200"
        } ${className}`}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}
