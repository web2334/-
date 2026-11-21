"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GameSettings } from "@/lib/settings-schema";
import { NumField, SaveBar } from "./Fields";
import { useSave } from "./useSave";
import { humanStamp } from "@/lib/format";
import { rub } from "@/lib/pricing";

interface Code {
  code: string;
  number: number;
  order_id: string;
  amount: number;
  min_order: number;
  expires_at: string;
  created_at: string;
  redeemed_at: string | null;
}

const MODES = [
  ["off", "Выключена", "Игра не показывается клиентам."],
  ["play", "Без скидки", "Просто развлечение после заявки."],
  ["bonus", "Бонус на следующий заказ", "За дочищенную модель — код. Применяете вручную."],
] as const;

export function GameForm({ initial, codes }: { initial: GameSettings; codes: Code[] }) {
  const router = useRouter();
  const [g, setG] = useState(initial);
  const { save, saving, errors, msg } = useSave<GameSettings>("game");
  const toggle = async (c: Code) => {
    await fetch(`/api/admin/bonus/${c.code}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ redeemed: !c.redeemed_at }) });
    router.refresh();
  };
  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      <form className="stack" style={{ ["--gap" as string]: "16px" }} onSubmit={(e) => { e.preventDefault(); save(g); }}>
        <section className="card card-pad stack" style={{ ["--gap" as string]: "10px" }}>
          <h2 style={{ fontSize: 19 }}>Режим</h2>
          {MODES.map(([k, t, d]) => (
            <label key={k} className="toggle">
              <input type="radio" name="mode" checked={g.mode === k} onChange={() => setG({ ...g, mode: k })} />
              <span className="switch" aria-hidden />
              <span className="grow">
                <span className="t-title">{t}</span>
                <br />
                <span className="t-sub">{d}</span>
              </span>
            </label>
          ))}
        </section>
        {g.mode === "bonus" && (
          <section className="card card-pad stack" style={{ ["--gap" as string]: "14px" }}>
            <h2 style={{ fontSize: 19 }}>Бонус</h2>
            <div className="grid-2" style={{ gap: 12 }}>
              <NumField id="ba" label="Сумма бонуса" suffix="₽" value={g.bonusAmount} error={errors.bonusAmount} onChange={(v) => setG({ ...g, bonusAmount: v })} />
              <NumField id="bm" label="Минимум следующей чистки" suffix="₽" value={g.bonusMinOrder} error={errors.bonusMinOrder} onChange={(v) => setG({ ...g, bonusMinOrder: v })} />
              <NumField id="bd" label="Срок действия" suffix="дн." value={g.bonusDays} error={errors.bonusDays} onChange={(v) => setG({ ...g, bonusDays: v })} />
            </div>
            <div className="notice notice-warn small">
              Один код на заявку, текущий заказ не дешевеет. Защиты от накрутки в игре нет — код подтверждает только, что клиент оставил заявку. Проверяйте код в списке ниже и
              отмечайте погашение вручную.
            </div>
          </section>
        )}
        <SaveBar saving={saving} msg={msg} />
      </form>
      <section className="card" style={{ overflow: "hidden" }}>
        <div className="card-pad" style={{ paddingBottom: 8 }}>
          <h2 style={{ fontSize: 19 }}>Выданные коды</h2>
        </div>
        {codes.length === 0 ? (
          <p className="card-pad muted" style={{ paddingTop: 0 }}>
            Пока ни одного.
          </p>
        ) : (
          codes.map((c) => {
            const expired = new Date(c.expires_at) < new Date();
            return (
              <div key={c.code} className="order-row" style={{ alignItems: "center" }}>
                <div>
                  <strong style={{ letterSpacing: "0.03em" }}>{c.code}</strong>{" "}
                  <span className={`badge ${c.redeemed_at ? "badge-done" : expired ? "badge-cancelled" : "badge-agreed"}`}>{c.redeemed_at ? "погашен" : expired ? "истёк" : "активен"}</span>
                  <div className="small muted">
                    заявка №{c.number} · {rub(c.amount)} от {rub(c.min_order)} · выдан {humanStamp(c.created_at)}
                  </div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => toggle(c)}>
                  {c.redeemed_at ? "Снять отметку" : "Погасить"}
                </button>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
