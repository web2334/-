"use client";
import Link from "next/link";
import { myOrdersStore, useHydrated, useStore } from "@/lib/client-store";
import { humanStamp } from "@/lib/format";

export function MyOrders() {
  const list = useStore(myOrdersStore);
  const hydrated = useHydrated();
  if (!hydrated) return <div className="skeleton" style={{ height: 80 }} />;
  if (list.length === 0)
    return (
      <div className="card card-pad stack" style={{ alignItems: "flex-start" }}>
        <p className="muted">В этом браузере заявок пока нет.</p>
        <Link href="/#choose" className="btn btn-primary">
          Выбрать мебель
        </Link>
      </div>
    );
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {list.map((o) => (
        <Link key={o.token} href={`/z/${o.token}`} className="order-row">
          <strong>Заявка №{o.number}</strong>
          <span className="small muted">{humanStamp(o.at)}</span>
        </Link>
      ))}
    </div>
  );
}
