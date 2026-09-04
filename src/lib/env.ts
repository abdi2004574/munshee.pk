const requiredEnvVars = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

const optionalEnvVars = {
  VITE_SCRAPER_URL: import.meta.env.VITE_SCRAPER_URL,
};

function validateEnv() {
  const missing: string[] = [];
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value || typeof value !== "string" || value.trim() === "") {
      missing.push(key);
      continue;
    }
    if (key === "VITE_SUPABASE_URL" && !value.startsWith("https://")) {
      missing.push(`${key} (must start with https://)`);
    }
  }
  return missing;
}

export function getEnv() {
  const missing = validateEnv();

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(", ")}`;
    if (import.meta.env.DEV) {
      console.warn(`[env] ${message}. The app may still work for unauthenticated views.`);
    } else {
      throw new Error(message);
    }
  }

  return Object.freeze({
    VITE_SUPABASE_URL: (requiredEnvVars.VITE_SUPABASE_URL || "").trim(),
    VITE_SUPABASE_ANON_KEY: (requiredEnvVars.VITE_SUPABASE_ANON_KEY || "").trim(),
    VITE_SCRAPER_URL: (optionalEnvVars.VITE_SCRAPER_URL || "http://localhost:3001").trim(),
  });
}

