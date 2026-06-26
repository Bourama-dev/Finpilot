"use client";

import { useState } from "react";
import { themes, ThemeKey } from "@/lib/themes/themes";
import { useTheme } from "@/lib/themes/ThemeProvider";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-text-secondary hover:bg-bg-tertiary transition-colors text-sm w-full"
        aria-label="Changer de thème"
        aria-expanded={open}
      >
        <span className="text-base">{themes[theme].emoji}</span>
        <span className="flex-1 text-left">{themes[theme].name}</span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute bottom-full left-0 mb-2 z-20 bg-bg-secondary border border-border rounded-xl shadow-md p-3 w-64">
            <p className="text-text-muted text-xs font-medium mb-2 px-1">🎨 Apparence</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(themes) as [ThemeKey, typeof themes[ThemeKey]][]).map(
                ([key, t]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setTheme(key);
                      setOpen(false);
                    }}
                    title={t.name}
                    className={`relative flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                      theme === key
                        ? "border-accent bg-accent-light"
                        : "border-border hover:border-accent/50"
                    }`}
                    style={{ fontSize: "13px" }}
                  >
                    <ThemeSwatch vars={t.variables} />
                    <span className="text-text-primary font-medium truncate">{t.emoji} {t.name}</span>
                    {theme === key && (
                      <svg
                        className="w-3 h-3 text-accent absolute top-1.5 right-1.5 shrink-0"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    )}
                  </button>
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ThemeSwatch({
  vars,
}: {
  vars: Record<string, string>;
}) {
  return (
    <div className="flex gap-0.5 shrink-0">
      <div
        className="w-4 h-6 rounded-l"
        style={{ backgroundColor: vars["--bg-primary"] }}
      />
      <div
        className="w-2 h-6"
        style={{ backgroundColor: vars["--bg-sidebar"] }}
      />
      <div
        className="w-2 h-6 rounded-r"
        style={{ backgroundColor: vars["--accent"] }}
      />
    </div>
  );
}
