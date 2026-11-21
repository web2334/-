import { ownerGuard } from "@/lib/admin-api";
import { q } from "@/lib/db";
import { apiError } from "@/lib/security";

export const runtime = "nodejs";

/** Фото доступны только владельцу с действующим сеансом. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await ownerGuard(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return apiError(404, "Нет такого фото.");
  const rows = await q<{ data: Buffer; mime: string }>("SELECT data, mime FROM photos WHERE id = $1 AND order_id IS NOT NULL", [id]);
  if (!rows[0]) return apiError(404, "Нет такого фото.");
  return new Response(new Uint8Array(rows[0].data), {
    headers: {
      "Content-Type": rows[0].mime,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
