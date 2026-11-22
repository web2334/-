"use client";
import { useEffect, useRef, useState } from "react";
import { draftStore, type DraftPhoto } from "@/lib/client-store";
import { MAX_PHOTOS } from "@/lib/order-schema";
import { IconCamera, IconRefresh, IconX } from "./Icons";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 12 * 1024 * 1024;
/** Максимум, который реально уходит на сервер после сжатия в браузере. */
const UPLOAD_LIMIT = 4.2 * 1024 * 1024;

interface Pending {
  key: string;
  file: File;
  preview: string;
  progress: number;
  error: string | null;
}

/** Маленькое превью в data URL — переживает перезагрузку (хранится в черновике). */
async function makeThumb(file: Blob, max = 240): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c.toDataURL("image/jpeg", 0.7);
}

/** Большие фото ужимаем ещё в браузере, чтобы загрузка с телефона была быстрой. Сервер всё равно проверяет и сжимает. */
async function shrink(file: File): Promise<Blob> {
  if (file.size < 2 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.86));
    return blob ?? file;
  } catch {
    return file;
  }
}

function upload(blob: Blob, name: string, draftId: string, onProgress: (p: number) => void): Promise<{ id: string; size: number }> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("draftId", draftId);
    fd.append("file", blob, name);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.timeout = 60_000;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body: { id?: string; size?: number; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && body.id) resolve({ id: body.id, size: body.size ?? blob.size });
      else reject(new Error(body.error ?? "Не удалось загрузить фото."));
    };
    xhr.onerror = () => reject(new Error("Нет связи. Проверьте интернет и повторите."));
    xhr.ontimeout = () => reject(new Error("Загрузка слишком долгая. Повторите."));
    xhr.send(fd);
  });
}

export function PhotoUploader({
  photos,
  draftId,
  error,
  required,
  onBusyChange,
}: {
  photos: DraftPhoto[];
  draftId: string;
  error?: string;
  required: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const previews = useRef(new Set<string>());

  useEffect(() => {
    const set = previews.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const busy = pending.some((p) => !p.error);
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  const slots = MAX_PHOTOS - photos.length - pending.length;

  const start = async (p: Pending) => {
    setPending((list) => list.map((x) => (x.key === p.key ? { ...x, error: null, progress: 0 } : x)));
    try {
      const blob = await shrink(p.file);
      // Serverless-платформы ограничивают тело запроса (~4,5 МБ на Vercel)
      if (blob.size > UPLOAD_LIMIT) throw new Error("Фото слишком большое — сохраните его в меньшем размере.");
      const [{ id, size }, thumb] = await Promise.all([
        upload(blob, p.file.name, draftId, (progress) => setPending((list) => list.map((x) => (x.key === p.key ? { ...x, progress } : x)))),
        makeThumb(blob).catch(() => ""),
      ]);
      draftStore.set((d) => ({ ...d, photos: [...d.photos, { id, thumb, name: p.file.name, size }].slice(0, MAX_PHOTOS) }));
      setPending((list) => list.filter((x) => x.key !== p.key));
      URL.revokeObjectURL(p.preview);
      previews.current.delete(p.preview);
    } catch (e) {
      setPending((list) => list.map((x) => (x.key === p.key ? { ...x, error: (e as Error).message } : x)));
    }
  };

  const onFiles = (files: FileList | null) => {
    setLocalError(null);
    if (!files) return;
    const list = Array.from(files);
    if (list.length > slots) setLocalError(`Можно приложить не больше ${MAX_PHOTOS} фото.`);
    for (const file of list.slice(0, Math.max(0, slots))) {
      if (!ACCEPT.includes(file.type)) {
        setLocalError("Подойдут только JPEG, PNG или WebP.");
        continue;
      }
      if (file.size > MAX_BYTES) {
        setLocalError("Файл больше 12 МБ.");
        continue;
      }
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      const p: Pending = { key: Math.random().toString(36).slice(2), file, preview, progress: 0, error: null };
      setPending((l) => [...l, p]);
      void start(p);
    }
    if (input.current) input.current.value = "";
  };

  const removeUploaded = async (id: string) => {
    draftStore.set((d) => ({ ...d, photos: d.photos.filter((p) => p.id !== id) }));
    fetch(`/api/uploads/${id}?draftId=${encodeURIComponent(draftId)}`, { method: "DELETE" }).catch(() => {});
  };
  const removePending = (key: string) => {
    setPending((l) => {
      const p = l.find((x) => x.key === key);
      if (p) {
        URL.revokeObjectURL(p.preview);
        previews.current.delete(p.preview);
      }
      return l.filter((x) => x.key !== key);
    });
  };

  const shownError = error ?? localError;
  return (
    <div className="field" data-invalid={!!shownError}>
      <span className="field-label" id="photos-label">
        Фото {required ? <span className="error-text">· обязательно для «Другое»</span> : <span className="faint">· по желанию</span>}
      </span>
      <span className="hint">До {MAX_PHOTOS} фото: общий вид и пятна крупно. JPEG, PNG или WebP до 12 МБ.</span>
      <div className="photos" aria-labelledby="photos-label">
        {photos.map((p) => (
          <div className="photo-tile" key={p.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.thumb ? <img src={p.thumb} alt={`Фото: ${p.name}`} /> : <div className="tile-state">Загружено</div>}
            <button type="button" className="tile-del" aria-label={`Удалить фото ${p.name}`} onClick={() => removeUploaded(p.id)}>
              <IconX size={16} />
            </button>
          </div>
        ))}
        {pending.map((p) => (
          <div className="photo-tile" key={p.key}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" />
            <div className="tile-state" role={p.error ? "alert" : "status"}>
              {p.error ? (
                <div className="stack" style={{ alignItems: "center", ["--gap" as string]: "6px" }}>
                  <span>{p.error}</span>
                  <button type="button" className="btn btn-sm" style={{ background: "#fff", color: "#111" }} onClick={() => start(p)}>
                    <IconRefresh size={16} /> Повторить
                  </button>
                </div>
              ) : (
                <span>Загрузка {Math.round(p.progress * 100)}%</span>
              )}
            </div>
            <button type="button" className="tile-del" aria-label="Отменить" onClick={() => removePending(p.key)}>
              <IconX size={16} />
            </button>
          </div>
        ))}
        {slots > 0 && (
          <label className="photo-add">
            <input
              ref={input}
              type="file"
              accept={ACCEPT.join(",")}
              multiple
              className="sr-only"
              onChange={(e) => onFiles(e.target.files)}
              aria-describedby="photos-label"
            />
            <span className="stack" style={{ alignItems: "center", ["--gap" as string]: "4px" }}>
              <IconCamera size={26} />
              Добавить фото
            </span>
          </label>
        )}
      </div>
      {shownError && (
        <span className="error-text" role="alert" id="err-photoIds">
          {shownError}
        </span>
      )}
    </div>
  );
}

