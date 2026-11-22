import "server-only";
import { cache } from "react";
import { q } from "./db";
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from "./settings-schema";

/** Глубокое слияние сохранённого JSON с текущими значениями по умолчанию (на случай новых полей). */
function merge<T>(base: T, over: unknown): T {
  if (typeof base !== "object" || base === null || Array.isArray(base)) return (over ?? base) as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  if (over && typeof over === "object") {
    for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
      if (k in out) out[k] = merge(out[k], v);
    }
  }
  return out as T;
}

export const getSettings = cache(async (): Promise<Settings> => {
  let rows: { data: unknown }[];
  try {
    rows = await q<{ data: unknown }>("SELECT data FROM settings WHERE id = 1");
  } catch (e) {
    // БД недоступна (например, при сборке статической 404): показываем значения по умолчанию.
    // Создание заявок при этом всё равно невозможно — запись в БД вернёт ошибку.
    console.error("[settings] БД недоступна, используются значения по умолчанию:", (e as Error).message);
    return DEFAULT_SETTINGS;
  }
  if (rows.length === 0) {
    await q("INSERT INTO settings (id, data) VALUES (1, $1) ON CONFLICT (id) DO NOTHING", [DEFAULT_SETTINGS]);
    return DEFAULT_SETTINGS;
  }
  const merged = merge(DEFAULT_SETTINGS, rows[0].data);
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
});

export async function saveSettingsSection<K extends keyof Settings>(key: K, value: Settings[K]): Promise<Settings> {
  const current = await getSettings();
  const next = settingsSchema.parse({ ...current, [key]: value });
  await q(
    `INSERT INTO settings (id, data, updated_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [next],
  );
  return next;
}
