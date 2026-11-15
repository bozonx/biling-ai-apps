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
