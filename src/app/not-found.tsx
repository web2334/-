import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "70dvh", display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>
      <div className="stack" style={{ alignItems: "center" }}>
        <p className="eyebrow">404</p>
        <h1 style={{ fontSize: 30 }}>Страница не найдена</h1>
        <p className="muted" style={{ maxWidth: 380 }}>
          Если вы открыли ссылку на заявку — проверьте, что она скопирована целиком. Заявку также могли удалить.
        </p>
        <Link className="btn btn-primary" href="/">
          На главную
        </Link>
      </div>
    </main>
  );
}
