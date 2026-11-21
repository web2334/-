"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Сохранение раздела настроек с ошибками у полей. */
export function useSave<T>(section: string) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "danger"; text: string } | null>(null);
  const save = async (value: T) => {
    setSaving(true);
    setMsg(null);
    setErrors({});
    try {
      const r = await fetch(`/api/admin/settings/${section}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) {
        location.href = "/admin/login";
        return;
      }
      if (!r.ok) {
        if (d.fields) setErrors(d.fields);
        throw new Error(d.error ?? "Не удалось сохранить");
      }
      setMsg({ kind: "ok", text: "Сохранено. Изменения уже на сайте; отправленные заявки сохраняют свои условия." });
      router.refresh();
    } catch (e) {
      setMsg({ kind: "danger", text: (e as Error).message === "Failed to fetch" ? "Нет связи — не сохранено." : (e as Error).message });
    } finally {
      setSaving(false);
    }
  };
  return { save, saving, errors, msg };
}
