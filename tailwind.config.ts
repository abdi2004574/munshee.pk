import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#0d9488",
          600: "#0f766e",
          700: "#115e59",
          800: "#134e4a",
          900: "#042f2e",
        },
        accent: {
          DEFAULT: "#f59e0b",
          foreground: "#ffffff",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f9fafb",
          dark: "#111827",
        },
        ink: {
          DEFAULT: "#111827",
          muted: "#6b7280",
        },
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      borderRadius: {
        md: "6px",
        lg: "10px",
        xl: "14px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
