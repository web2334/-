"use client";
export function NumField({ id, label, value, onChange, suffix, error, hint }: { id: string; label: string; value: number; onChange: (v: number) => void; suffix: string; error?: string; hint?: string }) {
  return (
    <div className="field" data-invalid={!!error}>
      <label htmlFor={id}>{label}</label>
      <div className="row" style={{ ["--gap" as string]: "8px" }}>
        <input id={id} className="input num" inputMode="numeric" value={String(value)} onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "") || 0))} />
        <span className="muted" style={{ minWidth: 20 }}>
          {suffix}
        </span>
      </div>
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}

export function TextField({ id, label, value, onChange, error, hint, placeholder, area, type }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; placeholder?: string; area?: boolean; type?: string }) {
  return (
    <div className="field" data-invalid={!!error}>
      <label htmlFor={id}>{label}</label>
      {area ? (
        <textarea id={id} className="textarea" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="input" type={type ?? "text"} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}

export function SaveBar({ saving, msg }: { saving: boolean; msg: { kind: "ok" | "danger"; text: string } | null }) {
  return (
    <div className="stack" style={{ ["--gap" as string]: "10px" }}>
      {msg && (
        <div className={`notice notice-${msg.kind}`} role="status">
          {msg.text}
        </div>
      )}
      <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={saving}>
        {saving ? "Сохраняем…" : "Сохранить"}
      </button>
    </div>
  );
}
