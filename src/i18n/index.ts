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
import romanUr from "./locales/roman_ur.json";

export type { Locale, TranslationMessages };

const messages: Record<Locale, Record<string, string>> = {
  en: flatten(en as Record<string, unknown>),
  ur: flatten(ur as Record<string, unknown>),
  "en-PK": flatten(enPK as Record<string, unknown>),
  roman_ur: flatten(romanUr as Record<string, unknown>),
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

export function t(key: string, fallback?: string, vars?: Record<string, string | number>): string {
  const msg = messages[currentLocale] || messages.en;
  let result: string;
  if (key in msg) result = msg[key]!;
  else if (fallback) result = fallback;
  else result = key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return result;
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

  const tWithLocale = (key: string, fallback?: string, vars?: Record<string, string | number>): string => {
    const msg = messages[locale] || messages.en;
    let result: string;
    if (key in msg) result = msg[key]!;
    else if (fallback) result = fallback;
    else result = key;

    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return result;
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
