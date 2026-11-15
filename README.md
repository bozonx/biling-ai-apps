# Billing AI Apps

Инфраструктурный каркас по [дизайну](dev_docs/billing-service-design.md). Бизнес-логика биллинга, авторизация, платежи и выполнение AI-запросов пока не реализованы. `/health` проверяет доступность процесса.

Node.js 24+, pnpm 10, Docker с Compose. Версии зависимостей закреплены в catalog и lockfile; Prisma используется стабильной ветки 7.

```sh
pnpm install
cp .env.example .env
docker compose up -d --wait
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Web: localhost:3000, API: localhost:3001/health, gateway: localhost:3002/health. Worker: `pnpm --filter @billing/api worker`.

```sh
pnpm check
pnpm test:unit
pnpm test:web
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

Integration smoke запускает изолированные PostgreSQL/Redis через Testcontainers, применяет миграции, проверяет Prisma и обработку BullMQ. Нужен работающий Docker. E2E сам запускает web/API. Unit-тесты не требуют инфраструктуры. Не используйте production DATABASE_URL локально.

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

Ограничения среза: нет разрешения прав, usage, частичных списаний и фонового
освобождения истёкших резервов. Истёкший резерв можно явно освободить через
release; commit после срока отклоняется. Ручные партии бессрочные. Начисление
при долге отклоняется до реализации погашения долга. Размер резерва задаёт
доверенный S2S-клиент; публичным клиентам этот API не предназначен.
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
не нужен. Аккаунт и начальные кредиты предварительно создаёт оператор.

S2S-история: `GET /api/v1/s2s/wallets/:accountId/operations`, scope
`wallets:read`, до 50 записей по убыванию последовательности. Для следующей
страницы передайте `before=<walletSeq последней записи>`.
Worker освобождает истёкшие резервы каждые 5 секунд, пакетами до 100 записей.
