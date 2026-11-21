"use client";
import { useState } from "react";
import type { CharacterSettings } from "@/lib/settings-schema";
import { CATEGORIES } from "@/lib/catalog";
import { CHARACTER_NAMES, PRESET_LABELS, pickLine, type Preset } from "@/lib/phrases";
import { SaveBar } from "./Fields";
import { useSave } from "./useSave";

export function CharactersForm({ initial }: { initial: CharacterSettings }) {
  const [c, setC] = useState(initial);
  const { save, saving, msg } = useSave<CharacterSettings>("characters");
  return (
    <form className="stack" style={{ ["--gap" as string]: "16px" }} onSubmit={(e) => { e.preventDefault(); save(c); }}>
      <section className="card card-pad stack" style={{ ["--gap" as string]: "10px" }}>
        <h2 style={{ fontSize: 19 }}>Характер</h2>
        {(Object.keys(PRESET_LABELS) as Preset[]).map((k) => (
          <label key={k} className="toggle">
            <input type="radio" name="preset" checked={c.preset === k} onChange={() => setC({ ...c, preset: k })} />
            <span className="switch" aria-hidden />
            <span className="grow">
              <span className="t-title">{PRESET_LABELS[k].title}</span>
              <br />
              <span className="t-sub">{PRESET_LABELS[k].sub}</span>
            </span>
          </label>
        ))}
      </section>
      <section className="card card-pad stack" style={{ ["--gap" as string]: "10px" }}>
        <h2 style={{ fontSize: 19 }}>Отображение</h2>
        <label className="toggle">
          <input type="checkbox" checked={c.faces} onChange={(e) => setC({ ...c, faces: e.target.checked })} />
          <span className="switch" aria-hidden />
          <span className="grow">
            <span className="t-title">Лица и руки</span>
            <br />
            <span className="t-sub">Выключите для строгого стиля — останется просто мебель.</span>
          </span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={c.phrases} onChange={(e) => setC({ ...c, phrases: e.target.checked })} disabled={!c.faces} />
          <span className="switch" aria-hidden />
          <span className="grow">
            <span className="t-title">Реплики</span>
            <br />
            <span className="t-sub">Короткие фразы при выборе и добавлении. Работают только с лицами.</span>
          </span>
        </label>
      </section>
      <section className="card card-pad stack" style={{ ["--gap" as string]: "8px" }}>
        <h2 style={{ fontSize: 19 }}>Как звучит</h2>
        {CATEGORIES.map((cat) => (
          <div key={cat.id} className="small">
            <strong>{CHARACTER_NAMES[cat.id]}</strong> <span className="muted">({cat.title.toLowerCase()}):</span> {pickLine(c.preset, cat.id, "hello", 0)}
          </div>
        ))}
        <p className="tiny faint">Тексты реплик и имена персонажей меняются в src/lib/phrases.ts.</p>
      </section>
      <SaveBar saving={saving} msg={msg} />
    </form>
  );
}
