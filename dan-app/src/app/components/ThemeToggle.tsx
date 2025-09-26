"use client";

import { useEffect, useMemo, useState } from "react";

type ThemeOverride = "light" | "dark" | null;

const STORAGE_KEY = "themeOverride";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [override, setOverride] = useState<ThemeOverride>(null);

  useEffect(() => {
    setMounted(true);
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const parsed: ThemeOverride = saved === "light" || saved === "dark" ? (saved as ThemeOverride) : null;
    setOverride(parsed);
    applyTheme(parsed);
    // If following system, keep icon in sync with system changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!parsed) {
        applyTheme(null);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const isDark = useMemo(() => {
    if (!mounted) return false;
    if (override) return override === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, [mounted, override]);

  function applyTheme(next: ThemeOverride) {
    const root = document.documentElement;
    if (!next) {
      root.removeAttribute("data-theme");
      return;
    }
    root.setAttribute("data-theme", next);
  }

  function onToggle() {
    const next: ThemeOverride = (() => {
      if (override === "dark") return "light";
      if (override === "light") return "dark";
      // No override yet: toggle opposite of system
      const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      return systemDark ? "light" : "dark";
    })();
    setOverride(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    applyTheme(next);
  }

  // Simple icon-only button
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition"
    >
      {isDark ? (
        // Moon icon
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M21.752 15.002A9 9 0 1112.998 2.25a.75.75 0 01.823.982 7.5 7.5 0 008.948 9.448.75.75 0 01-.017 1.322z" />
        </svg>
      ) : (
        // Sun icon
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M12 18a6 6 0 100-12 6 6 0 000 12zm0 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm0-22a1 1 0 01-1-1V-2a1 1 0 112 0v1a1 1 0 01-1 1zm10 10a1 1 0 011 1 1 1 0 11-2 0 1 1 0 011-1zM3 12a1 1 0 011-1 1 1 0 110 2 1 1 0 01-1-1zm15.657 7.071a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM3.222 3.222a1 1 0 010 1.414l-.707.707A1 1 0 01.1 3.929l.707-.707a1 1 0 011.414 0zM3.222 20.778a1 1 0 011.414 0l.707.707A1 1 0 013.93 22.9l-.707-.707a1 1 0 010-1.414zM19.778 3.222a1 1 0 011.414 0l.707.707A1 1 0 0120.9 5.071l-.707-.707a1 1 0 010-1.414z" />
        </svg>
      )}
    </button>
  );
}


