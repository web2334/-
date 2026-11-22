"use client";
import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "./Icons";

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setDark(t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("vors.theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button className="btn btn-ghost icon-btn" onClick={toggle} aria-label={dark ? "Светлая тема" : "Тёмная тема"} title="Сменить тему">
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  );
}
