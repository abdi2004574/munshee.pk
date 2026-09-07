#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, "../src/i18n/locales");
const locales = ["en", "ur", "en-PK"];

function flattenKeys(obj, prefix = "") {
  const keys = new Set();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const subKey of flattenKeys(value, fullKey)) {
        keys.add(subKey);
      }
    } else {
      keys.add(fullKey);
    }
  }
  return keys;
}

function loadLocale(name) {
  const content = readFileSync(resolve(localesDir, `${name}.json`), "utf-8");
  return JSON.parse(content);
}

const allKeys = new Set();
const localeKeys = {};

for (const locale of locales) {
  const data = loadLocale(locale);
  const keys = flattenKeys(data);
  localeKeys[locale] = keys;
  for (const key of keys) allKeys.add(key);
}

let hasErrors = false;

for (const locale of locales) {
  const missing = new Set();
  for (const key of allKeys) {
    if (!localeKeys[locale].has(key)) {
      missing.add(key);
    }
  }
  if (missing.size > 0) {
    hasErrors = true;
    console.error(`[${locale}] Missing ${missing.size} keys:`);
    for (const key of Array.from(missing).sort()) {
      console.error(`  - ${key}`);
    }
  } else {
    console.log(`[${locale}] All ${localeKeys[locale].size} keys present.`);
  }
}

if (hasErrors) {
  console.error("\n❌ i18n check failed: missing translation keys.");
  process.exit(1);
} else {
  console.log("\n✅ All locales have matching keys.");
  process.exit(0);
}