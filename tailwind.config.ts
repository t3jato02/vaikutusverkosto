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
        ink: {
          900: "#101418",
          700: "#23282e",
          500: "#4a525c",
          300: "#9aa1ab",
          100: "#e6e9ec",
        },
        paper: "#f7f7f5",
        accent: "#0f5ea8",
        accentDark: "#0b4a86",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;