import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neutral ink scale. `text-ink` (DEFAULT) is the primary body colour;
        // the numbered steps stay for existing call sites.
        ink: {
          DEFAULT: "#14181d",
          900: "#14181d",
          700: "#2b3138",
          500: "#565e68", // secondary text — passes WCAG AA on surface/paper
          // tertiary text — darkened so `text-ink-300` also clears WCAG AA
          // (~4.9:1 on white / ~4.7:1 on paper) even at 10–13px.
          300: "#676d76",
          100: "#e5e7ea",
        },
        // Semantic aliases (preferred in new code).
        paper: "#faf9f7", // warm, very light page ground
        surface: "#ffffff", // cards / panels
        muted: "#565e68", // secondary text
        line: "#e4e5e8", // hairline borders
        accent: {
          DEFAULT: "#0f5ea8",
          soft: "#eaf1f8", // accent surface for selected states
          dark: "#0b4a86",
        },
        accentDark: "#0b4a86",
        // Status — used for meaning, never decoration.
        verified: { DEFAULT: "#1f7a4d", soft: "#e7f4ec" },
        disputed: { DEFAULT: "#b4432a", soft: "#fbeae5" },
        stale: { DEFAULT: "#9a6b16", soft: "#f7efdd" },
        warning: { DEFAULT: "#9a6b16", soft: "#f7efdd" },
      },
      borderRadius: {
        md: "0.5rem", // 8px — controls
        lg: "0.75rem", // 12px — cards
        xl: "1rem",
      },
      maxWidth: {
        content: "72rem", // 1152px — reading width for feeds / tables
        wide: "88rem", // 1408px — large visualisations
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        serif: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "page-title": ["2rem", { lineHeight: "1.15", letterSpacing: "-0.011em", fontWeight: "700" }],
        "entity-title": ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.006em", fontWeight: "700" }],
      },
      transitionDuration: { DEFAULT: "150ms" },
    },
  },
  plugins: [],
};

export default config;
