"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { themes, ThemeKey, defaultTheme } from "./themes";

type ThemeContextValue = {
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  setTheme: () => {},
});

function applyTheme(key: ThemeKey) {
  const root = document.documentElement;
  Object.entries(themes[key].variables).forEach(([prop, value]) => {
    root.style.setProperty(prop, value);
  });
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>(defaultTheme);

  useEffect(() => {
    const saved = localStorage.getItem("finpilot-theme") as ThemeKey | null;
    const initial = saved && themes[saved] ? saved : defaultTheme;
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = (t: ThemeKey) => {
    setThemeState(t);
    localStorage.setItem("finpilot-theme", t);
    applyTheme(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
