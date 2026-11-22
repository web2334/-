import "server-only";
import sharp, { type Metadata, type OutputInfo } from "sharp";
import { q } from "./db";

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_SIDE = 1600;
const ALLOWED = new Set(["jpeg", "png", "webp"]);

export type PhotoResult =
  | { ok: true; id: string; width: number; height: number; size: number }
  | { ok: false; error: string };

/**
 * Проверяем НАСТОЯЩИЙ формат по содержимому (sharp декодирует файл), а не по расширению
 * или Content-Type. Поворачиваем по EXIF, ужимаем до 1600 px, перекодируем в WebP —
 * это заодно удаляет метаданные (включая геолокацию).
 */
export async function storePhoto(buf: Buffer, draftId: string): Promise<PhotoResult> {
  if (buf.length === 0) return { ok: false, error: "Пустой файл." };
  if (buf.length > MAX_UPLOAD_BYTES) return { ok: false, error: "Файл больше 12 МБ." };
  let meta: Metadata;
  try {
    meta = await sharp(buf, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    return { ok: false, error: "Не удалось прочитать изображение. Подойдут JPEG, PNG или WebP." };
  }
  if (!meta.format || !ALLOWED.has(meta.format)) return { ok: false, error: "Подойдут только JPEG, PNG или WebP." };
  if ((meta.pages ?? 1) > 1) return { ok: false, error: "Анимированные изображения не подходят." };
  if (!meta.width || !meta.height || meta.width < 200 || meta.height < 200)
    return { ok: false, error: "Слишком маленькое фото — нужно хотя бы 200×200 px." };

  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(buf, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    return { ok: false, error: "Не удалось обработать изображение." };
  }

  const rows = await q<{ id: string }>(
    `INSERT INTO photos (draft_id, mime, width, height, size, data) VALUES ($1, 'image/webp', $2, $3, $4, $5) RETURNING id`,
    [draftId, out.info.width, out.info.height, out.data.length, out.data],
  );
  // Чистим брошенные загрузки старше суток.
  if (Math.random() < 0.1) q("DELETE FROM photos WHERE order_id IS NULL AND created_at < now() - interval '1 day'").catch(() => {});
  return { ok: true, id: rows[0].id, width: out.info.width, height: out.info.height, size: out.data.length };
}
