import { ownerGuard } from "@/lib/admin-api";
import { apiError, json } from "@/lib/security";
import { saveSettingsSection } from "@/lib/settings";
import { charactersSchema, companySchema, gameSchema, pricingSchema } from "@/lib/settings-schema";
import { zodFieldErrors } from "@/lib/order-schema";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

const SCHEMAS = { pricing: pricingSchema, company: companySchema, game: gameSchema, characters: charactersSchema } as const;

export async function PUT(req: Request, ctx: { params: Promise<{ section: string }> }) {
  const denied = await ownerGuard(req);
  if (denied) return denied;
  const { section } = await ctx.params;
  if (!(section in SCHEMAS)) return apiError(404, "Нет такого раздела.");
  const key = section as keyof typeof SCHEMAS;
  const parsed = SCHEMAS[key].safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(422, "Проверьте поля.", zodFieldErrors(parsed.error));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saved = await saveSettingsSection(key, parsed.data as any);
  revalidatePath("/", "layout");
  return json({ ok: true, settings: saved[key] });
}
