// Заранее написанные реплики персонажей. Без нейросети: выбираем случайную из набора.
import type { CategoryId } from "./catalog";

export type Preset = "calm" | "cheerful" | "business";
export type Moment = "hello" | "added" | "merged" | "dirty" | "secondSide" | "idle";

export const PRESET_LABELS: Record<Preset, { title: string; sub: string }> = {
  calm: { title: "Спокойный", sub: "Мягко и по делу, без восклицаний" },
  cheerful: { title: "Весёлый", sub: "Тёплые шутки и эмоции" },
  business: { title: "Деловой", sub: "Коротко: что, сколько и как" },
};

export const CHARACTER_NAMES: Record<CategoryId, string> = {
  sofa: "Боря",
  armchair: "Кира",
  mattress: "Мотя",
  chair: "Сеня",
  other: "Пуф",
};

type Lines = Partial<Record<Moment, string[]>>;

const CALM: Record<CategoryId, Lines> = {
  sofa: {
    hello: ["Привет, я Боря. Покрутите меня — я не против.", "Здравствуйте. Посмотрим, сколько стоит освежить диван?"],
    idle: ["Сиденья, спинка, подлокотники — всё почистим на месте."],
  },
  armchair: {
    hello: ["Я Кира. Любимое кресло заслуживает заботы.", "Привет. Кресло после чистки как будто легче дышит."],
    idle: ["Реклайнер чистим вместе с подножкой."],
  },
  mattress: {
    hello: ["Я Мотя. Посмотрите на мою стёжку — узнаёте?", "Привет. Матрас стоит освежать хотя бы раз в год."],
    idle: ["Вторую сторону можно добавить одним переключателем."],
  },
  chair: {
    hello: ["Я Сеня. Нас, стульев, обычно несколько — укажите сколько.", "Привет. Сиденье или со спинкой — выберите ниже."],
    idle: ["Модель у меня одна, вариант меняет только цену."],
  },
  other: {
    hello: ["Я Пуф. Не нашли свой предмет? Опишите и приложите фото.", "Привет. Банкетка, изголовье, пуф — оценим по фото."],
    idle: ["Стоимость таких предметов мастер скажет по фото."],
  },
};

const COMMON_CALM: Lines = {
  added: ["Добавил в заявку.", "Готово, позиция в заявке."],
  merged: ["Такая позиция уже была — увеличил количество."],
  dirty: ["Сильные пятна учтём — работы чуть больше."],
  secondSide: ["Перевернём и почистим с двух сторон."],
};

const CHEERFUL: Record<CategoryId, Lines> = {
  sofa: { hello: ["Привет! Я Боря, и я обожаю, когда меня крутят!", "О, гости! Давайте сделаем меня снова пушистым?"] },
  armchair: { hello: ["Хэй! Я Кира — самое уютное место в доме.", "Привет-привет! Садитесь… то есть выбирайте!"] },
  mattress: { hello: ["Мотя на связи! Мне снятся только чистые сны.", "Привет! Я мягкий, честный и стёганый."] },
  chair: { hello: ["Сеня! Нас много, и все хотят чистоты!", "Привет! Даже стулу приятно быть свежим."] },
  other: { hello: ["Я Пуф! Покажите фото — придумаем, как вас порадовать.", "Пуф-пуф! Расскажите, что у вас за предмет."] },
};
const COMMON_CHEERFUL: Lines = {
  added: ["Ура, я в заявке!", "Есть! Ещё кого-нибудь позовём?"],
  merged: ["О, нас уже двое! Количество увеличил."],
  dirty: ["Пятна? Не беда, справимся!"],
  secondSide: ["Кувырок — и обе стороны сияют!"],
};

const BUSINESS: Record<CategoryId, Lines> = {
  sofa: { hello: ["Диван: выберите размер и опции.", "Чистка дивана на месте, 2–4 часа сушки."] },
  armchair: { hello: ["Кресло: обычное или реклайнер.", "Кресло: цена за штуку, выберите тип."] },
  mattress: { hello: ["Матрас: размер и число сторон.", "Матрас: вторая сторона — опция."] },
  chair: { hello: ["Стул: сиденье или со спинкой, укажите количество.", "Стулья: цена за штуку."] },
  other: { hello: ["Другое: описание и фото — оценка вручную.", "Нестандартный предмет — цена по фото."] },
};
const COMMON_BUSINESS: Lines = {
  added: ["Добавлено.", "Позиция в заявке."],
  merged: ["Количество увеличено."],
  dirty: ["Надбавка за сильные загрязнения учтена."],
  secondSide: ["Вторая сторона учтена."],
};

const BY_PRESET = {
  calm: [CALM, COMMON_CALM],
  cheerful: [CHEERFUL, COMMON_CHEERFUL],
  business: [BUSINESS, COMMON_BUSINESS],
} as const;

export function pickLine(preset: Preset, cat: CategoryId, moment: Moment, seed = Math.random()): string | null {
  const [byCat, common] = BY_PRESET[preset];
  const list = byCat[cat]?.[moment] ?? common[moment] ?? CALM[cat]?.[moment] ?? COMMON_CALM[moment];
  if (!list || list.length === 0) return null;
  return list[Math.floor(seed * list.length) % list.length];
}
