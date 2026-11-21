"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AccessForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const errs: Record<string, string> = {};
    if (next.length < 10) errs.next = "Минимум 10 символов";
    if (next !== repeat) errs.repeat = "Пароли не совпадают";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current, next }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (d.fields) setErrors(d.fields);
        throw new Error(d.error ?? "Не удалось сменить пароль");
      }
      setCurrent("");
      setNext("");
      setRepeat("");
      setMsg({ kind: "ok", text: "Пароль изменён. Все прежние сеансы на других устройствах закрыты." });
    } catch (err) {
      setMsg({ kind: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      <form className="card card-pad stack" onSubmit={submit} style={{ ["--gap" as string]: "14px" }}>
        <h2 style={{ fontSize: 19 }}>Смена пароля</h2>
        <input type="text" name="username" autoComplete="username" value="owner" readOnly hidden />
        <div className="field" data-invalid={!!errors.current}>
          <label htmlFor="cur">Текущий пароль</label>
          <input id="cur" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          {errors.current && <span className="error-text">{errors.current}</span>}
        </div>
        <div className="field" data-invalid={!!errors.next}>
          <label htmlFor="nx">Новый пароль</label>
          <input id="nx" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          {errors.next ? <span className="error-text">{errors.next}</span> : <span className="hint">От 10 символов. Лучше фраза из нескольких слов.</span>}
        </div>
        <div className="field" data-invalid={!!errors.repeat}>
          <label htmlFor="rp">Повторите новый пароль</label>
          <input id="rp" className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          {errors.repeat && <span className="error-text">{errors.repeat}</span>}
        </div>
        {msg && (
          <div className={`notice notice-${msg.kind}`} role="status">
            {msg.text}
          </div>
        )}
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={busy || !current || !next}>
          {busy ? "Меняем…" : "Сменить пароль"}
        </button>
      </form>
      <section className="card card-pad stack">
        <h2 style={{ fontSize: 19 }}>Сеанс</h2>
        <p className="small muted">Сеанс действует 14 дней. После смены пароля остальные устройства выходят автоматически.</p>
        <button className="btn btn-outline" style={{ alignSelf: "flex-start" }} onClick={logout}>
          Выйти
        </button>
      </section>
    </div>
  );
}
