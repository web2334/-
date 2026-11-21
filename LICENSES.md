# Лицензии и источники

## 3D-модели и текстуры

| Ассет | Источник | Права |
|---|---|---|
| `public/models/*.glb` (9 моделей: диваны на 2 и 3 места, угловой диван, кресло, реклайнер, матрасы, стул, пуф) | созданы процедурно скриптом `scripts/build-models.mjs` специально для проекта | принадлежат правообладателю исходников, передаются вместе с ними; сторонних ассетов нет |
| Нормал-карта плетения ткани (внутри GLB) | сгенерирована `scripts/optimize-models.mjs` | то же |
| Иконки PWA, OG-картинка | сгенерированы `scripts/build-icons.mjs` | то же |
| Иконки интерфейса (`src/components/Icons.tsx`) | нарисованы вручную в SVG для проекта | то же |

Если захотите заменить модели готовыми: бесплатные модели с правом коммерческого использования и
распространения есть, например, в CC0-библиотеках Kenney (kenney.nl), Quaternius (quaternius.com) и
Poly Haven (polyhaven.com). Сохраняйте ссылку на источник и текст лицензии рядом с файлом.

## Библиотеки (npm)

| Пакет | Лицензия |
|---|---|
| next, react, react-dom | MIT |
| three | MIT |
| @react-three/fiber, @react-three/drei | MIT |
| motion | MIT |
| pg | MIT |
| zod | MIT |
| sharp | Apache-2.0; поставляемый libvips — LGPL-3.0-or-later (динамическая связь, исходники доступны у проекта libvips) |
| @gltf-transform/*, meshoptimizer (dev) | MIT |
| embedded-postgres (dev, только для локальной БД) | MIT; бинарники PostgreSQL — PostgreSQL License |
| vitest, typescript (dev) | MIT / Apache-2.0 |

Полные тексты лицензий лежат в `node_modules/<пакет>/LICENSE` после `npm install`.

## Шрифт

Manrope — SIL Open Font License 1.1. Подключается через `next/font/google` и при сборке скачивается и раздаётся с вашего домена.
