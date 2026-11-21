"use client";
import { useState } from "react";
import type { Company } from "@/lib/settings-schema";
import { SaveBar, TextField } from "./Fields";
import { useSave } from "./useSave";

export function CompanyForm({ initial }: { initial: Company }) {
  const [c, setC] = useState(initial);
  const { save, saving, errors, msg } = useSave<Company>("company");
  const f = (k: keyof Company) => ({ id: k, value: c[k], error: errors[k], onChange: (v: string) => setC({ ...c, [k]: v }) });
  return (
    <form className="stack" style={{ ["--gap" as string]: "16px" }} onSubmit={(e) => { e.preventDefault(); save(c); }}>
      <section className="card card-pad stack" style={{ ["--gap" as string]: "14px" }}>
        <h2 style={{ fontSize: 19 }}>Бренд</h2>
        <TextField {...f("name")} label="Название" />
        <TextField {...f("tagline")} label="Короткое описание" area />
        <div className="field" data-invalid={!!errors.accent}>
          <label htmlFor="accent">Акцентный цвет</label>
          <div className="row">
            <input id="accent" type="color" value={c.accent} onChange={(e) => setC({ ...c, accent: e.target.value })} style={{ width: 56, height: 48, border: 0, background: "none", padding: 0 }} />
            <input className="input" value={c.accent} onChange={(e) => setC({ ...c, accent: e.target.value })} aria-label="Цвет в HEX" style={{ maxWidth: 140 }} />
            <span className="btn btn-primary btn-sm" style={{ background: c.accent, pointerEvents: "none" }}>
              Кнопка
            </span>
          </div>
          <span className="hint">Кнопки, переключатели и выделения. Выбирайте насыщенный цвет: на нём белый текст.</span>
          {errors.accent && <span className="error-text">{errors.accent}</span>}
        </div>
      </section>
      <section className="card card-pad stack" style={{ ["--gap" as string]: "14px" }}>
        <h2 style={{ fontSize: 19 }}>География</h2>
        <TextField {...f("city")} label="Город" placeholder="Например: Казань" />
        <TextField {...f("area")} label="Территория выезда" area />
        <TextField {...f("hours")} label="Часы работы" />
      </section>
      <section className="card card-pad stack" style={{ ["--gap" as string]: "14px" }}>
        <h2 style={{ fontSize: 19 }}>Контакты</h2>
        <p className="small muted">Показываются только заполненные. Пустые каналы на сайте не появятся.</p>
        <TextField {...f("phone")} label="Телефон" type="tel" placeholder="+7 900 000-00-00" />
        <TextField {...f("telegram")} label="Telegram" placeholder="@username" />
        <TextField {...f("whatsapp")} label="WhatsApp" placeholder="79000000000" />
        <TextField {...f("email")} label="E-mail" type="email" />
        <TextField {...f("legalName")} label="Юридическое лицо / ИП (для подвала и политики)" area />
      </section>
      <SaveBar saving={saving} msg={msg} />
    </form>
  );
}
