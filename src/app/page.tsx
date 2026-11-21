import { getSettings } from "@/lib/settings";
import { toPublic } from "@/lib/settings-schema";
import { contactLinks } from "@/lib/contacts";
import { siteUrl } from "@/lib/site";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Configurator } from "@/components/Configurator";
import { PriceList } from "@/components/PriceList";
import { CartBar } from "@/components/CartBar";

export const dynamic = "force-dynamic";

export default async function Home() {
  const s = await getSettings();
  const pub = toPublic(s);
  const contacts = contactLinks(s.company);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: s.company.name,
    description: s.company.tagline,
    url: siteUrl(),
    ...(s.company.city ? { areaServed: s.company.city } : {}),
    ...(s.company.phone ? { telephone: s.company.phone } : {}),
    ...(s.company.email ? { email: s.company.email } : {}),
    priceRange: "₽₽",
  };

  return (
    <>
      <SiteHeader company={s.company} />
      <main>
        <Configurator settings={pub} />

        <section className="section" id="how" aria-labelledby="how-title">
          <div className="container">
            <p className="eyebrow">Как это работает</p>
            <h2 className="section-title" id="how-title">
              Заявка за минуту, мастер — у вас дома
            </h2>
            <div className="steps" style={{ marginTop: 22 }}>
              {[
                ["Выберите мебель", "Соберите в заявку всё, что нужно почистить. Цена считается сразу."],
                ["Отправьте заявку", "Адрес, удобная дата и пара фото. Онлайн-оплаты нет."],
                ["Согласуем по телефону", "Мастер уточнит детали, назовёт итоговую цену и время."],
                ["Чистим на месте", "Приезжаем со своим оборудованием. Мебель сохнет 3–6 часов."],
              ].map(([t, d]) => (
                <div className="card step" key={t}>
                  <h3 style={{ fontSize: 18, marginBottom: 6 }}>{t}</h3>
                  <p className="small muted">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="prices" aria-labelledby="prices-title" style={{ paddingTop: 8 }}>
          <div className="container">
            <p className="eyebrow">Услуги и цены</p>
            <h2 className="section-title" id="prices-title">
              Прозрачный прайс
            </h2>
            <p className="lead" style={{ marginBottom: 22 }}>
              Базовые цены за одну единицу. Сложные предметы оцениваем по фото — мы не показываем неизвестную цену как бесплатную.
            </p>
            <PriceList pricing={s.pricing} />
          </div>
        </section>

        <section className="section" id="contacts" aria-labelledby="contacts-title" style={{ paddingTop: 8 }}>
          <div className="container">
            <div className="card card-pad grid-2">
              <div className="stack">
                <p className="eyebrow">Где работаем</p>
                <h2 className="section-title" id="contacts-title" style={{ margin: 0 }}>
                  {s.company.city ? `${s.company.city} и окрестности` : "Территория выезда"}
                </h2>
                <p className="muted">{s.company.area}</p>
                {s.company.hours && <p className="muted">{s.company.hours}</p>}
              </div>
              <div className="stack">
                <p className="eyebrow">Связаться</p>
                {contacts.length > 0 ? (
                  <div className="row wrap">
                    {contacts.map((c) => (
                      <a key={c.kind} className="btn btn-outline" href={c.href} target={c.kind === "telegram" || c.kind === "whatsapp" ? "_blank" : undefined} rel="noopener noreferrer">
                        {c.label}: {c.value}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Оставьте заявку — мастер сам перезвонит на указанный номер.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter company={s.company} />
      <CartBar pricing={s.pricing} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
