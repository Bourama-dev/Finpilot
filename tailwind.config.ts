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
        bg: {
          primary:   "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          tertiary:  "var(--bg-tertiary)",
          sidebar:   "var(--bg-sidebar)",
        },
        border:       "var(--border)",
        text: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted:     "var(--text-muted)",
        },
        accent: {
          DEFAULT:   "var(--accent)",
          hover:     "var(--accent-hover)",
          light:     "var(--accent-light)",
        },
        success: {
          DEFAULT:   "var(--success)",
          light:     "var(--success-light)",
        },
        danger: {
          DEFAULT:   "var(--danger)",
          light:     "var(--danger-light)",
        },
        warning: {
          DEFAULT:   "var(--warning)",
          light:     "var(--warning-light)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      boxShadow: {
        theme:    "var(--shadow)",
        "theme-md": "var(--shadow-md)",
      },
      borderRadius: {
        theme: "var(--radius)",
      },
    },
  },
  plugins: [],
};

export default config;
