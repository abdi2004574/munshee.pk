import {
  createElement,
  Fragment,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "@/features/auth/useSession";
import type { Locale, TranslationMessages } from "./types";
import en from "./locales/en.json";
import ur from "./locales/ur.json";
import enPK from "./locales/en-PK.json";

export type { Locale, TranslationMessages };

const messages: Record<Locale, Record<string, string>> = {
  en: flatten(en as Record<string, unknown>),
  ur: flatten(ur as Record<string, unknown>),
  "en-PK": flatten(enPK as Record<string, unknown>),
};

let currentLocale: Locale = "en";

function flatten(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flatten(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      result[fullKey] = value.map(String).join("\n");
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

export function setLocale(locale: Locale) {
  currentLocale = locale;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("munshee-locale", locale);
  }
}

export function getCurrentLocale(): Locale {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("munshee-locale") as Locale | null;
    if (stored && stored in messages) {
      return stored;
    }
  }
  return currentLocale;
}

export function t(key: string, fallback?: string): string {
  const msg = messages[currentLocale] || messages.en;
  if (key in msg) return msg[key]!;
  if (fallback) return fallback;
  return key;
}

export function useI18n() {
  const { data: settings } = useSession();
  const [locale, setLocaleState] = useState<Locale>(getCurrentLocale);

  useEffect(() => {
    if (settings?.session?.user) {
      // Could fetch locale from app_settings in the future
    }
  }, [settings]);

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    setLocaleState(newLocale);
  };

  const tWithLocale = (key: string, fallback?: string): string => {
    const msg = messages[locale] || messages.en;
    if (key in msg) return msg[key]!;
    if (fallback) return fallback;
    return key;
  };

  return { t: tWithLocale, locale, setLocale: changeLocale };
}

export function I18nProvider({ children }: { children: ReactNode }) {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("munshee-locale") as Locale | null;
    if (stored && stored in messages) {
      currentLocale = stored as Locale;
    }
  }
  return createElement(Fragment, null, children);
}