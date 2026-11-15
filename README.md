# Billing AI Apps

Инфраструктурный каркас по [дизайну](dev_docs/billing-service-design.md). Реализованы базовое ядро биллинга и временный локальный кабинет. Авторизация через IdP, платежи и выполнение AI-запросов пока не подключены. `/health` проверяет доступность процесса.

Node.js 24+, pnpm 10, Docker с Compose. Версии зависимостей закреплены в catalog и lockfile; Prisma используется стабильной ветки 7.

```sh
pnpm install
cp .env.example .env
cp apps/web/.env.example apps/web/.env
docker compose up -d --wait postgres redis
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm exec turbo run build --filter="./packages/*"
pnpm dev
```

Web: localhost:3012, API: localhost:3010/health, gateway: localhost:3011/health. PostgreSQL: localhost:5433, Redis: localhost:6380. Внутри Docker используются стандартные порты 5432 и 6379. Dev-порт UI 3012 задан в `apps/web/package.json`. Команды выполняются из корня репозитория. `pnpm dev` запускает UI, API и gateway; API и gateway явно читают корневой `.env`, Nuxt — `apps/web/.env`. Worker запускается отдельно после сборки:

```sh
pnpm --filter @billing/api build
pnpm --filter @billing/api exec node --env-file=../../.env dist/worker.js
```

Seed создаёт продукт `tyco` и версию курса, а вне production — dev-аккаунт с однократным начислением 1000 кредитов. После выполнения перенесите напечатанные `DEV_ACCOUNT_ID` и `DEV_PRODUCT_ID` в корневой `.env`. С настройками по умолчанию страница входа открывается, но вход отключён. Для работы кабинета включите dev-режим по инструкции ниже и `NUXT_PUBLIC_DEV_LOGIN_ENABLED=true` в `apps/web/.env`. После изменения env перезапустите соответствующие процессы. Существующие `.env` сверяйте с примерами вручную, без перезаписи локальных значений.

```sh
pnpm check
pnpm test:unit
pnpm test:web
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

Integration smoke запускает изолированные PostgreSQL/Redis через Testcontainers, применяет миграции, проверяет Prisma и обработку BullMQ. Нужен работающий Docker. E2E сам запускает UI на порту 3012 и подменяет ответы API; API и Docker для этих тестов не нужны. Unit-тесты не требуют инфраструктуры. Не используйте production DATABASE_URL локально.

`apps/api` — NestJS/Fastify и отдельный worker; `apps/gateway` — отдельный HTTP-процесс; `apps/web` — Nuxt 4/UI/Pinia; `packages/core` — чистый домен, `contracts` — Zod, `client` — HTTP SDK. Prisma и миграции находятся в корне. Для новой миграции: `pnpm db:migrate --name description`.

### Первый срез ядра биллинга

API использует PostgreSQL из `DATABASE_URL`; перед запуском выполните
`pnpm db:generate`, `pnpm db:deploy`, `pnpm db:seed`.
Запуск API: `pnpm --filter @billing/api dev`.

S2S-запросы передают `Authorization: Bearer <key>`. В `ProductApiKey`
хранится SHA-256 ключа, продукт и явно разрешённые scopes. Ключи создаются
оператором в БД; открытого endpoint выдачи ключей нет. Scope `credits:grant`
давайте только доверенному оператору, не шлюзу.

| Метод и путь (префикс `/api/v1`)  | Scope           | Назначение        |
| --------------------------------- | --------------- | ----------------- |
| `GET /s2s/wallets/:accountId`     | `wallets:read`  | Баланс и резервы  |
| `POST /s2s/credits/grant`         | `credits:grant` | Ручное начисление |
| `POST /s2s/holds`                 | `holds:write`   | Резерв            |
| `POST /s2s/holds/:holdId/commit`  | `holds:write`   | Полное списание   |
| `POST /s2s/holds/:holdId/release` | `holds:write`   | Освобождение      |

Начисление принимает `{accountId, amountMilli, creditRateVersionId}`,
резерв — `{accountId, amountMilli, featureId}`. UUID передаются строками,
милли-кредиты — положительными десятичными строками. Оба POST требуют
`Idempotency-Key`. Повтор ключа с другим телом отклоняется. Закрытие резерва
идемпотентно по его id и действию. Продукт определяется только API-ключом.

Для проверки нужны аккаунт с Identity, активная ProductFeature с пустым
`requires` и опубликованная CreditRateVersion данного продукта. Сначала
начислите кредиты, затем создайте резерв и выполните commit либо release.
Записи журнала и материализованный баланс обновляются одной транзакцией;
конкурирующие операции сериализуются блокировкой кошелька.

Права читаются через `GET /s2s/entitlements/:accountId` со scope
`entitlements:read`: базовые подписки и гранты сливаются по `or`/`max`,
перечисления сравниваются по реестру, overrides побеждают. Для default-гранта
с `planId` выбирается текущая опубликованная версия. `read_only` сохраняет
только ключи `keepOnReadOnly`. Права проверяются перед каждым новым резервом.
Кэш пока не используется; изменения видны при следующем запросе.

Commit атомарно создаёт UsageEvent, его ключ идемпотентности и связи с журналом.
Повторный commit не создаёт второй usage. История доступна через
`GET /s2s/usage/:accountId` (scope `usage:read`, курсор `before` — id события,
до 50 событий). В этом срезе себестоимость неизвестна (`costSource=unknown`),
списывается полный резерв. Worker (отдельный запуск после сборки, см. выше) освобождает резервы каждые 5 секунд, устанавливая статус `expired`.

Ограничения среза: нет частичных и поздних списаний, получения фактической
себестоимости и лимитов частоты. Commit после срока отклоняется. Ручные партии
бессрочные. Начисление при долге отклоняется до реализации погашения долга.
Размер резерва задаёт доверенный S2S-клиент; публичным клиентам этот API не
предназначен. Автоматическая выдача бесплатного тарифа ещё не реализована.
`POST /billing/estimate` — отдельный арифметический калькулятор без изменения
баланса, а не источник окончательной цены операции.

Проверки: `pnpm check`, `pnpm test:unit`, `pnpm test:integration` (Docker).

### Временный локальный кабинет

До подключения OIDC можно включить фиксированный тестовый аккаунт:
`DEV_ACCOUNT_ENABLED=true`, `DEV_ACCOUNT_ID=<UUID существующего аккаунта>`,
`DEV_PRODUCT_ID=<UUID продукта>`. В production этот режим отключён независимо
от настройки. Используйте только локально: все посетители получают один аккаунт.
Endpoint `GET /api/v1/me` возвращает контекст, `/api/v1/me/wallet` — баланс,
`/api/v1/me/operations` — последние 50 операций. Секретный S2S-ключ браузеру
не нужен. Для локальной разработки аккаунт и начальные кредиты создаёт `pnpm db:seed` (вне production).

S2S-история: `GET /api/v1/s2s/wallets/:accountId/operations`, scope
`wallets:read`, до 50 записей по убыванию последовательности. Для следующей
страницы передайте `before=<walletSeq последней записи>`.
Worker освобождает истёкшие резервы каждые 5 секунд, пакетами до 100 записей.

### Веб-кабинет

`apps/web` — SPA на Nuxt. Запросы браузера идут на тот же origin в `/api/v1/**`,
Nitro проксирует их в API, поэтому CORS не нужен. Настройки — в
`apps/web/.env` (пример: `apps/web/.env.example`), читаются при запуске:

| Переменная                      | Назначение                                     |
| ------------------------------- | ---------------------------------------------- |
| `NUXT_API_URL`                  | Адрес API для прокси (`http://localhost:3010`) |
| `NUXT_PUBLIC_APP_NAME`          | Название продукта в интерфейсе                 |
| `NUXT_PUBLIC_DEV_LOGIN_ENABLED` | Кнопка «Войти как разработчик»                 |

Вход разработчика работает, только если в API включён временный кабинет
(`DEV_ACCOUNT_ENABLED=true`, см. выше). Вход через IdP показан, но пока
отключён. Тема (системная/светлая/тёмная) и язык (`ru`/`en-US`) сохраняются в
браузере. Страницы: вход, обзор кошелька, история операций, настройки
(внешний вид, аккаунт).
