import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { contactLinks } from "@/lib/contacts";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Политика обработки персональных данных", alternates: { canonical: "/privacy" } };

export default async function Privacy() {
  const s = await getSettings();
  const c = s.company;
  const operator = c.legalName || `${c.name} (реквизиты оператора указываются владельцем в кабинете → «Компания»)`;
  const contacts = contactLinks(c).map((l) => `${l.label}: ${l.value}`).join(", ");
  return (
    <>
      <SiteHeader company={c} minimal />
      <main className="container section prose">
        <h1 style={{ fontSize: 34, marginBottom: 12 }}>Политика обработки персональных данных</h1>
        <p className="notice notice-warn small" style={{ color: "var(--warn)" }}>
          Это шаблон для MVP. Перед запуском владелец должен проверить его с юристом, указать реквизиты оператора и при необходимости уведомить Роскомнадзор (152-ФЗ).
        </p>
        <h2>Оператор</h2>
        <p>{operator}.</p>
        <h2>Какие данные мы получаем</h2>
        <p>Имя, телефон, адрес выезда, желаемые дата и время, комментарий, фотографии мебели и состав заявки.</p>
        <h2>Зачем</h2>
        <p>Чтобы связаться с вами, согласовать стоимость и время выезда и выполнить чистку. Мы не используем данные для рассылок без отдельного согласия.</p>
        <h2>Как храним</h2>
        <p>
          Данные хранятся в базе данных сервиса. Фотографии доступны только владельцу через защищённый кабинет; при загрузке из них удаляются метаданные (включая геолокацию).
          Страница заявки открывается только по личной ссылке с непредсказуемым токеном.
        </p>
        <h2>Сколько храним</h2>
        <p>До выполнения заявки и далее не дольше, чем нужно для учёта, — либо до отзыва согласия. Удалить заявку можно, написав нам.</p>
        <h2>Ваши права</h2>
        <p>Вы можете запросить сведения о своих данных, их уточнение или удаление и отозвать согласие{contacts ? `: ${contacts}` : ", связавшись с нами по телефону, указанному мастером"}.</p>
        <h2>Cookie и локальное хранилище</h2>
        <p>
          Сайт не использует рекламные и аналитические cookie. В браузере сохраняются корзина, черновик формы и выбранная тема — только на вашем устройстве. Cookie сеанса
          используется лишь в кабинете владельца.
        </p>
      </main>
      <SiteFooter company={c} />
    </>
  );
}
