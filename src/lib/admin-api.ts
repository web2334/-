import "server-only";
import { currentSession } from "./auth";
import { apiError, checkOrigin } from "./security";

/** Проверка владельца для API: сеанс + (для изменяющих методов) Origin. */
export async function ownerGuard(req: Request) {
  if (req.method !== "GET" && req.method !== "HEAD" && !checkOrigin(req)) return apiError(403, "Запрос отклонён: неизвестный источник.");
  const s = await currentSession();
  if (!s) return apiError(401, "Нужно войти в кабинет.");
  return null;
}
