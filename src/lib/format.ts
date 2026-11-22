const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

/** «25 ноября, ср» из YYYY-MM-DD без сдвига часовых поясов. */
export function humanDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${d} ${MONTHS[m - 1]}, ${WD[wd]}`;
}

/** «25 ноября, ср, 14:30» из локального YYYY-MM-DDTHH:MM. */
export function humanDateTime(local: string): string {
  return `${humanDate(local)}, ${local.slice(11, 16)}`;
}

export function humanStamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
