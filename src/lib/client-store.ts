"use client";
// Небольшие внешние хранилища на useSyncExternalStore с сохранением в localStorage.
// Всё чтение/запись обёрнуто в try/catch: приватный режим или запрет хранилища не ломают страницу.
import { useSyncExternalStore } from "react";
import type { CategoryId, PriceKey } from "./catalog";
import { itemKey } from "./pricing";
import { MAX_QTY, MAX_ITEMS, type TIME_SLOTS } from "./order-schema";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* хранилище недоступно — работаем в памяти */
  }
}

export function createStore<T>(key: string, initial: T, validate?: (v: unknown) => T) {
  let state: T = initial;
  let hydrated = false;
  const subs = new Set<() => void>();
  const hydrate = () => {
    if (hydrated || typeof window === "undefined") return;
    if (!key) {
      hydrated = true;
      return;
    }
    hydrated = true;
    const raw = load<unknown>(key, initial);
    try {
      state = validate ? validate(raw) : (raw as T);
    } catch {
      state = initial;
    }
  };
  const emit = () => subs.forEach((f) => f());
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === key) {
        hydrated = false;
        hydrate();
        emit();
      }
    });
  }
  return {
    get: () => {
      hydrate();
      return state;
    },
    set: (next: T | ((s: T) => T)) => {
      hydrate();
      state = typeof next === "function" ? (next as (s: T) => T)(state) : next;
      if (key) save(key, state);
      emit();
    },
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    initial,
  };
}

export function useStore<T>(store: ReturnType<typeof createStore<T>>): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.initial);
}

/** true после гидрации — чтобы не мигать «пустой корзиной» на сервере. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

// --- Корзина ---------------------------------------------------------------------
export interface CartItem {
  id: string;
  category: CategoryId;
  variant: PriceKey | null;
  qty: number;
  dirty: boolean;
  secondSide: boolean;
  description?: string;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now();

export const cartStore = createStore<CartItem[]>("vors.cart.v1", [], (v) =>
  Array.isArray(v)
    ? (v as CartItem[]).filter((i) => i && typeof i.id === "string" && typeof i.category === "string" && i.qty >= 1).slice(0, MAX_ITEMS)
    : [],
);

const keyOf = (i: CartItem) => itemKey(i, i.id);

/** Добавить позицию. Действительно одинаковые (категория+вариант+опции) объединяются. */
export function addToCart(item: Omit<CartItem, "id">): "merged" | "added" {
  let result: "merged" | "added" = "added";
  cartStore.set((items) => {
    const probe = { ...item, id: uid() } as CartItem;
    const k = keyOf(probe);
    const same = item.category !== "other" ? items.find((i) => keyOf(i) === k) : undefined;
    if (same) {
      result = "merged";
      return items.map((i) => (i === same ? { ...i, qty: Math.min(MAX_QTY, i.qty + item.qty) } : i));
    }
    return [...items, probe].slice(0, MAX_ITEMS);
  });
  return result;
}

/** Изменить позицию; если после правки она совпала с другой — объединить. */
export function updateCartItem(id: string, patch: Partial<Omit<CartItem, "id">>) {
  cartStore.set((items) => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return items;
    const updated = { ...items[idx], ...patch, qty: Math.max(1, Math.min(MAX_QTY, patch.qty ?? items[idx].qty)) };
    const rest = items.filter((i) => i.id !== id);
    if (updated.category !== "other") {
      const twin = rest.find((i) => keyOf(i) === keyOf(updated));
      if (twin) return rest.map((i) => (i === twin ? { ...i, qty: Math.min(MAX_QTY, i.qty + updated.qty) } : i));
    }
    const out = [...items];
    out[idx] = updated;
    return out;
  });
}

export function removeCartItem(id: string): { item: CartItem; index: number } | null {
  const items = cartStore.get();
  const index = items.findIndex((i) => i.id === id);
  if (index < 0) return null;
  const item = items[index];
  cartStore.set(items.filter((i) => i.id !== id));
  return { item, index };
}

export function restoreCartItem(item: CartItem, index: number) {
  cartStore.set((items) => {
    if (items.some((i) => i.id === item.id)) return items;
    const out = [...items];
    out.splice(Math.min(index, out.length), 0, item);
    return out;
  });
}

// --- Черновик формы --------------------------------------------------------------
export interface DraftPhoto {
  id: string;
  thumb: string; // маленькое превью (data URL), чтобы пережить перезагрузку
  name: string;
  size: number;
}

export interface Draft {
  draftId: string;
  idempotencyKey: string;
  name: string;
  phone: string;
  address: string;
  outOfCity: boolean;
  wishDate: string;
  wishTime: "" | (typeof TIME_SLOTS)[number];
  comment: string;
  consent: boolean;
  photos: DraftPhoto[];
}

const randomId = (n = 24) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export function freshDraft(): Draft {
  return {
    draftId: typeof window === "undefined" ? "" : randomId(),
    idempotencyKey: typeof window === "undefined" ? "" : uid(),
    name: "",
    phone: "",
    address: "",
    outOfCity: false,
    wishDate: "",
    wishTime: "",
    comment: "",
    consent: false,
    photos: [],
  };
}

export const draftStore = createStore<Draft>("vors.draft.v1", freshDraft(), (v) => {
  const d = { ...freshDraft(), ...(v as Partial<Draft>) };
  if (!d.draftId || d.draftId.length < 20) d.draftId = randomId();
  if (!d.idempotencyKey) d.idempotencyKey = uid();
  d.photos = Array.isArray(d.photos) ? d.photos.slice(0, 3) : [];
  return d;
});

// --- Мои заявки (ссылки в этом браузере) -----------------------------------------
export interface MyOrder {
  token: string;
  number: number;
  at: string;
}
export const myOrdersStore = createStore<MyOrder[]>("vors.orders.v1", [], (v) => (Array.isArray(v) ? (v as MyOrder[]).slice(0, 20) : []));

// --- Выбор в конфигураторе (не сохраняется) --------------------------------------
export interface Selection {
  category: CategoryId;
  variant: Record<CategoryId, PriceKey | null>;
  dirty: boolean;
  secondSide: boolean;
  qty: number;
  description: string;
}
// Пустой ключ — хранится только в памяти: переживает переходы по сайту, но не перезагрузку.
export const selectionStore = createStore<Selection>("", {
  category: "sofa",
  variant: { sofa: "sofa_3", armchair: "armchair_standard", mattress: "mattress_double", chair: "chair_seatback", other: null },
  dirty: false,
  secondSide: false,
  qty: 1,
  description: "",
});

export { uid };
