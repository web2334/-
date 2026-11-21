"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { cartStore, useHydrated, useStore } from "@/lib/client-store";
import { estimate, rub } from "@/lib/pricing";
import type { Pricing } from "@/lib/settings-schema";
import { IconArrowRight } from "./Icons";

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function CartBar({ pricing }: { pricing: Pricing }) {
  const items = useStore(cartStore);
  const hydrated = useHydrated();
  const count = items.reduce((s, i) => s + i.qty, 0);
  const est = estimate(items, pricing, false);
  const show = hydrated && items.length > 0;

  useEffect(() => {
    document.body.classList.toggle("has-cart-bar", show);
    return () => document.body.classList.remove("has-cart-bar");
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div className="cart-bar" initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 90, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
          <div className="cart-bar-inner">
            <div className="grow" style={{ lineHeight: 1.25 }}>
              <div style={{ fontWeight: 700 }}>
                {count} {plural(count, "предмет", "предмета", "предметов")}
              </div>
              <div className="small" style={{ opacity: 0.75 }}>
                {est.total != null ? `≈ ${rub(est.total)}` : est.hasKnown ? `${rub(est.knownSubtotal)} + по фото` : "Цена по фото"}
              </div>
            </div>
            <Link href="/checkout" className="btn btn-primary">
              Оформить <IconArrowRight size={18} />
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
