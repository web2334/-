import { getSettings } from "@/lib/settings";
import { q } from "@/lib/db";
import { GameForm } from "@/components/admin/GameForm";

export default async function GamePage() {
  const s = await getSettings();
  const codes = await q(
    `SELECT b.code, b.order_id, o.number, b.amount, b.min_order, b.expires_at, b.created_at, b.redeemed_at
     FROM bonus_codes b JOIN orders o ON o.id = b.order_id ORDER BY b.created_at DESC LIMIT 200`,
  );
  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      <h1 style={{ fontSize: 28 }}>Игра</h1>
      <p className="muted">После отправки заявки клиент может почистить 3D-модель пальцем. Это необязательное развлечение.</p>
      <GameForm initial={s.game} codes={JSON.parse(JSON.stringify(codes))} />
    </div>
  );
}
