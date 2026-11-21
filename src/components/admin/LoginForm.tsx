"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Не удалось войти");
      router.replace("/admin/orders");
      router.refresh();
    } catch (err) {
      setError((err as Error).message === "Failed to fetch" ? "Нет связи с сервером." : (err as Error).message);
      setBusy(false);
    }
  };
  return (
    <form className="stack" onSubmit={submit} style={{ ["--gap" as string]: "14px" }}>
      <div className="field" data-invalid={!!error}>
        <label htmlFor="pw">Пароль</label>
        <input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && (
          <span className="error-text" role="alert">
            {error}
          </span>
        )}
      </div>
      <button className="btn btn-primary btn-block" disabled={busy || !password}>
        {busy ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
