import { ownerGuard } from "@/lib/admin-api";
import { listOrders, orderCounts } from "@/lib/admin-orders";
import { json } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = await ownerGuard(req);
  if (denied) return denied;
  const u = new URL(req.url);
  const status = (u.searchParams.get("status") ?? "active") as "all";
  const [orders, counts] = await Promise.all([listOrders({ q: u.searchParams.get("q") ?? "", status }), orderCounts()]);
  return json({ orders, counts });
}
