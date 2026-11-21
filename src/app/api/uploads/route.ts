import { apiError, guard, json } from "@/lib/security";
import { MAX_UPLOAD_BYTES, storePhoto } from "@/lib/photos";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const blocked = await guard(req, "upload", 40, 3600);
  if (blocked) return blocked;

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) return apiError(413, "Файл больше 12 МБ.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(400, "Не удалось прочитать загрузку.");
  }
  const draftId = String(form.get("draftId") ?? "");
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(draftId)) return apiError(400, "Некорректный черновик. Обновите страницу.");
  const file = form.get("file");
  if (!(file instanceof File)) return apiError(400, "Файл не получен.");
  if (file.size > MAX_UPLOAD_BYTES) return apiError(413, "Файл больше 12 МБ.");

  const res = await storePhoto(Buffer.from(await file.arrayBuffer()), draftId);
  if (!res.ok) return apiError(422, res.error);
  return json({ id: res.id, width: res.width, height: res.height, size: res.size }, 201);
}
