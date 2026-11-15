# Биллинг-сервис для AI-продуктов — дизайн

Статус: черновик v3 · 2026-11-15

Отдельный сервис подписок, кредитов, квот и рефералов для продуктов **TyCo**,
**FastCat**, **BloggerDog** и будущих. Первый и пока единственный потребитель —
**TyCo**: сервис доводим до рабочего состояния на нём, остальные продукты
подключаем после.

Сервис — самостоятельный продукт автора. Идеи и часть кода берём из биллинга
BloggerDog (`apps/api/src/modules/billing`, `ai-usage`, `referrals`,
Prisma-модели `Plan…PartnerPayout`), но совместимость с ним не цель.
BloggerDog позже подключается к сервису как обычный клиент и покупает на него
лицензию (§21).

---

## 1. Цели и не-цели

### Цели

1. Один сервис обслуживает любое число продуктов. Новый продукт подключается
   конфигурацией (продукт, тарифы, реестр прав, ключи API), без изменения кода
   ядра и без продуктовых веток в коде.
2. Продаём **подписки**, **пакеты кредитов** и **квоты** (диск, места и т. п.).
   Тарифы гибкие: версии, акционные и скрытые тарифы, архив.
3. Точный учёт себестоимости AI (LLM, STT, изображения, видео, перевод) и
   перевод её в кредиты по формуле, с возможностью фиксированной цены за
   действие.
4. Деньги принимает Merchant of Record (Polar; для `bloggerdog`, возможно,
   Paddle), в мобильных
   приложениях — App Store и Google Play через RevenueCat. Все источники оплаты
   дают одни и те же права.
5. Реферальная программа: сначала награда кредитами и подписками, денежные
   выплаты позже, но модель данных готова к ним с первого дня.
6. Изоляция: BloggerDog работает на своём экземпляре (своя БД, свой аккаунт
   MoR); TyCo и FastCat — на общем.

### Не-цели

- Выставление счетов, расчёт налогов, хранение карт — это делает MoR или магазин.
- **Аутентификация пользователей.** Свой OIDC-провайдер не пишем. Логин — у
  внешнего IdP (§5.1); биллинг знает только `subject` пользователя.
- **Работа с квитанциями магазинов напрямую.** Это делает RevenueCat (§11.3).
- Маршрутизация запросов к моделям и их выполнение внутри `billing-api`. Это
  делает AI-шлюз на `@bozonx/ai-kit` — отдельное приложение этого же
  репозитория (§9). Биллинг только оценивает, резервирует и списывает.
- Денежные выплаты партнёрам в v1 (только учёт начислений, §13.4).
- Внешние биллинг-движки (Lago, Orb, OpenMeter, Flexprice) и LiteLLM не
  используем: они считают потребление постфактум под счёт, а нам нужен
  предоплаченный баланс с резервами в реальном времени. Метеринг и цены уже
  есть в `ai-kit` и в моделях BloggerDog. Метры и кредиты Polar проверяем как
  возможную замену части учёта, но резервов у Polar нет — ядро остаётся у нас.

---

## 2. Ключевые правила (инварианты)

1. **MoR и магазины — источник правды по деньгам и статусу оплаты.** Сервис
   никогда сам не считает, сколько клиент заплатил; он реагирует на
   идемпотентные вебхуки и периодически сверяется с API провайдера.
2. **Сервис — источник правды по правам, балансам и квотам.** Продукты не
   хранят собственных копий прав дольше кэша с TTL и никогда не пишут в журнал
   кредитов.
3. **Журнал кредитов только дописывается.** Баланс — сумма записей. Исправление —
   новая запись, никогда не правка старой.
4. **Деньги — целые числа в микроединицах** (`1_000_000 = 1 USD`), `BigInt`.
   Каждая денежная запись хранит исходную валюту и сумму **и** эквивалент в
   USD-микро на момент события (§12.1).
5. **Кредиты в журнале — целые милли-кредиты** (`1000 = 1 кредит`). Клиенту
   показываем кредиты с округлением вниз. Так дешёвые вызовы стоят столько,
   сколько стоят, без минимума «1 кредит».
6. **Каждая операция, меняющая состояние, идемпотентна** по ключу, который
   передаёт вызывающая сторона (`Idempotency-Key`).
7. **Версии неизменяемы.** Версия тарифа, цены модели, курса кредита, политики
   наценки, условий реферальной программы после публикации не редактируются;
   изменение — новая версия. Записи ссылаются на версию, по которой созданы.
8. **Бизнес-логика читает права, а не коды тарифов.** Никаких `if plan === 'pro'`.
   И никаких `if product === 'tyco'` в ядре: всё различие продуктов — в данных.
9. **Учёт потребления — только на сервере.** Клиентские приложения (Tauri,
   браузер, мобильные) никогда не сообщают о расходе сами.

---

## 3. Термины

| Термин | Значение |
| --- | --- |
| **Deployment** (экземпляр) | Отдельный запуск сервиса со своей БД и своими аккаунтами MoR. `ivan-apps` (TyCo + FastCat), позже `bloggerdog`. |
| **Product** | Продукт внутри экземпляра: `tyco`, `fastcat`. Свои тарифы, кошельки, права, квоты. |
| **Subject** | Внешний идентификатор пользователя: `sub` из IdP или id пользователя в продукте. Биллинг не хранит паролей и профилей. |
| **BillingAccount** | Тот, кто платит и чьи балансы. Личный (одному subject) или командный (сущность продукта). |
| **Plan / PlanVersion** | Тариф и его неизменяемая версия: период, права, начисления. |
| **Offer** | Как версия тарифа продаётся через конкретный источник: price id в Paddle/Polar, product id в RevenueCat. |
| **Entitlement** | Право: ключ → значение (`int`, `bool`, `enum`). Реестр свой у каждого продукта. |
| **Quota** | Измеряемый лимит: расходуемый с периодом или уровень (§14). |
| **Subscription** | Оплаченная подписка на версию тарифа через источник оплаты. |
| **PlanGrant** | Тариф, выданный без оплаты: бесплатный уровень, акция, реферал, бета. |
| **Credit bucket** | Партия кредитов одного происхождения и срока жизни. |
| **Hold** | Резерв кредитов под операцию, которая ещё выполняется. |
| **Lease** | Пачка кредитов, выданная шлюзу на пользователя для локального расчёта (§8.7). |
| **Meter** | Единица потребления: `input_tokens`, `audio_seconds`, `images`… |

---

## 4. Архитектура

```
              ┌───────────── экземпляр ivan-apps ─────────────┐
TyCo (Tauri) ─┤                                               │
FastCat ──────┤  billing-api (NestJS/Fastify) ←→ Postgres     │
              │      │   ▲                    ▲               │
AI-шлюз ──────┼──────┘   │ S2S API             │               │
 (ai-kit)     │      billing-worker (BullMQ) ──┘  Redis        │
              │      web (Nuxt): портал клиента, checkout      │
              │      admin (Nuxt): бэк-офис                    │
              └──────▲───────────────────▲─────────────────────┘
                     │ JWT (JWKS)        │ вебхуки
              внешний IdP          Polar · RevenueCat
```

AI-шлюз — приложение `apps/gateway` в этом же репозитории и compose, но
отдельный процесс; с биллингом говорит только по S2S API (§9).

### 4.1. Стек

Берём набор BloggerDog — то, что нужно биллингу:

| Слой | Технологии |
| --- | --- |
| Рантайм и сборка | Node.js ≥ 24, TypeScript 6, pnpm 10 workspaces с `catalog:` для общих версий, turbo |
| API и воркер | NestJS 11 на Fastify (`@nestjs/platform-fastify`, `@fastify/helmet`, `@fastify/cookie`), `@nestjs/config`, `@nestjs/schedule`, `@nestjs/throttler` (rate limits), `@nestjs/jwt` (проверка токенов IdP и выпуск токена прав) |
| Валидация и контракты | zod 4 (DTO и контракты в `packages/contracts`, общие с SDK); `class-validator` — только если понадобится Nest-pipe |
| БД | PostgreSQL, **Prisma 7 как в BloggerDog**: одна схема `prisma/schema.prisma` в корне, `prisma.config.ts` (`defineConfig`, `DATABASE_URL`, seed через `node --import tsx prisma/seed.ts`), `@prisma/adapter-pg` + `pg`, клиент генерируется в `apps/api/src/generated/prisma`, миграции `prisma migrate` в `prisma/migrations`. Сырой SQL (`$queryRaw`) — только для `SELECT … FOR UPDATE` и триггеров/материализаций балансов |
| Очереди и кэш | BullMQ + `@nestjs/bullmq`, Redis через `ioredis`, `cache-manager` + `cache-manager-redis-yet`, `@bull-board` для просмотра очередей в админке |
| Наблюдаемость | `nestjs-pino`/`pino`, `prom-client` (метрики, дашборды из `docker/metrics` BloggerDog), Sentry |
| Почта | outbox (`MailOutbox`) + Resend / nodemailer — только служебные письма (низкий баланс, продление, over-quota) |
| Веб и админка | Nuxt 4, Vue 3, `@nuxt/ui` 4, Tailwind 4, Pinia, `@nuxtjs/i18n`, `@nuxt/icon` |
| Тесты | Jest 30 + ts-jest для API и `packages/core`, `@testcontainers/postgresql` и `@testcontainers/redis` для интеграционных, `nock` для HTTP провайдеров; Vitest + `@nuxt/test-utils` для веба, Playwright для e2e |
| Качество | ESLint 10 + typescript-eslint, Prettier, `pnpm check` (lint + typecheck + format + env-docs) как в BloggerDog |
| Деплой | Docker Compose (api, worker, Postgres, Redis); веб и админка — статикой (`nuxt generate`) на Cloudflare через wrangler, как в BloggerDog |

Не берём: socket.io, grammy, tiptap, `@ai-sdk/*`, social-posting, S3 — биллингу
не нужны. `@node-rs/argon2` не нужен: паролей нет, ключи продуктов хэшируем
SHA-256 (у них высокая энтропия).

### 4.2. Структура репозитория

```
apps/
  api/        NestJS: HTTP API (публичный, S2S, вебхуки)
  worker/     NestJS без HTTP: очереди, cron, сверки
  gateway/    AI-шлюз на ai-kit: вызовы моделей, ключи провайдеров, outbox commit
  web/        Nuxt: портал клиента, checkout, страницы тарифов
  admin/      Nuxt: бэк-офис
packages/
  core/       чистый домен: правила кредитов, тарифов, статусов, прав (без IO)
  contracts/  zod-схемы и типы API, коды ошибок, события — общие с SDK
  client/     SDK для продуктов (@billing/client): S2S-клиент, кэш прав,
              проверка подписи событий, lease-клиент для шлюза
  client-vue/ Vue-компоненты: баланс, апгрейд, paywall
  pricing-sync/ обновление цен провайдеров (§10.4) — этап 5
prisma/
  schema.prisma, migrations/, seed.ts
prisma.config.ts
dev_docs/
```

Домен в `packages/core` — чистые функции, как `domain/*.rules.ts` в BloggerDog
(`credit-spending.rules.ts`, `credit-pricing.rules.ts`,
`subscription-state.rules.ts`, `downgrade.rules.ts`). Переносим, обобщив под
продукты, партии и милли-кредиты.

### 4.3. Почему отдельный сервис, а не библиотека

- Продукты разнородны: Tauri-приложение, Nuxt-сайт, мобильные приложения,
  NestJS-монолит. Общий для всех — только HTTP.
- Вебхуки MoR и RevenueCat приходят в одно место на экземпляр.
- Кросс-продуктовые вещи (бандлы, рефералы) требуют одной БД.

Задержка `reserve` — один запрос к сервису в том же регионе плюс одна
транзакция Postgres. Для частых вызовов шлюз использует lease (§8.7), для
чтения прав SDK держит кэш (§16.3).

---

## 5. Пользователи, аккаунты, команды

### 5.1. Аутентификация — внешний IdP

- В `ivan-apps` логин для TyCo и FastCat даёт **внешний OIDC-провайдер**
  (кандидаты: Zitadel, Logto, Keycloak, Ory — выбор в §24). Он же делает
  email/пароль, magic link, Google/Apple OAuth, подтверждение email, PKCE и
  loopback/deep link для Tauri.
- Биллинг проверяет access token IdP по JWKS и берёт из него `sub`, email,
  `email_verified`. Падение биллинга не мешает входу, и наоборот.
- В экземплярах без общего IdP (позже `bloggerdog`) продукт сам аутентифицирует
  пользователя и обращается к биллингу по S2S, передавая свой `subject`.
- Админка — вход через тот же IdP, роли сотрудников (`StaffRole`) хранятся в
  биллинге.

### 5.2. BillingAccount

```
BillingAccount
  id
  ownerType: 'subject' | 'external'
  ownerSubject?                        -- для личных: sub из IdP
  productId?, externalRef?             -- для командных: продукт и id команды в нём
  country, email
  status: 'active' | 'suspended' | 'deleted'
```

- У пользователя в экземпляре один личный `BillingAccount` на все продукты:
  одна история платежей, один клиент в MoR. Создаётся лениво при первом
  обращении.
- Командные аккаунты — отдельные `BillingAccount` с местами.
- Покупатель в MoR (`providerCustomerId`) привязан к `BillingAccount`.

### 5.3. Команды

**Членство и роли команды живут в продукте**, не в биллинге. Биллинг знает:
число мест (право/квота `seats`, §14) и `subject` того, кто делает вызов, —
этого хватает для лимитов участника (§8.6). Продукт сообщает биллингу
занятые места (`PUT /v1/quotas/usage`, квота-уровень `seats`).

### 5.4. Кошельки и права — по продуктам

Балансы и права разделены по `(billingAccountId, productId)`. Себестоимость в
продуктах разная, а объединить кошельки позже легко, разделить — тяжело.
Объединение — только бандл-тарифом (§7.4) и перекрёстными грантами (§8.5).

---

## 6. Права (entitlements)

### 6.1. Реестр

Каждый продукт объявляет реестр прав в БД (`ProductEntitlementKey`, редактируется
из админки, экспортируется в `contracts` для типизации): ключ, тип, правило
слияния, флаг `keepOnReadOnly`.

```ts
// пример для tyco
{
  'ai.enabled':          { type: 'bool', merge: 'or' },
  'ai.model_tier':       { type: 'enum', values: ['basic','pro','top'], merge: 'max' },
  'sync.enabled':        { type: 'bool', merge: 'or' },
  'stt.live':            { type: 'bool', merge: 'or' },
  'byok.allowed':        { type: 'bool', merge: 'or' },
}
```

Количественные лимиты (диск, места, «N расшифровок в месяц») — не права, а
квоты (§14). Число начисляемых кредитов — в `PlanVersion.creditGrants`, не в
правах.

### 6.2. Бесплатный уровень

Бесплатный уровень — **обычный тариф** (`Plan.code='free'`, `visibility='unlisted'`)
и бессрочный `PlanGrant` (`source='default'`), который выдаётся при создании
кошелька продукта. Поэтому у бесплатных пользователей работают начисление
кредитов, квоты и права тем же кодом, без особого случая «default».

### 6.3. Вычисление эффективных прав

Источники делятся на два слоя:

```
базовый слой  = слияние по правилу ключа (max / or) между:
                 активными базовыми подписками и бандлами, покрывающими продукт,
                 активными PlanGrant (free, акция, реферал)
дополнения    = add-on подписки (только для квот, §14)
переопределение = EntitlementOverride из админки (побеждает всегда)
```

Правило `sum` между базовыми источниками **запрещено**: тариф продукта + бандл
не удваивают права. Суммируются только дополнения поверх базового слоя (§14.2).

Статус подписки влияет на вклад: `past_due` — полный, `read_only` — только
ключи с `keepOnReadOnly`, `expired` — ничего (логика `entitlement.rules.ts`).

Результат кэшируется в Redis на `(account, product)` и сбрасывается при любом
изменении источников.

---

## 7. Каталог: тарифы, офферы, пакеты

### 7.1. Модель

```
Product            id, code, name, status, settings (грейсы, лимиты, флаги)
CreditRateVersion  id, productId, version, creditValueMicros, effectiveFrom
MarkupPolicyVersion id, productId, version, tiers (jsonb), effectiveFrom
Plan               id, productScope[], code, name,
                   kind: 'base' | 'addon' | 'bundle',
                   visibility: 'public' | 'unlisted' | 'archived', sortOrder
PlanVersion        id, planId, version, interval: 'month' | 'year',
                   trialDays,
                   entitlements  (по продуктам: { tyco: {...} }),
                   quotas        (по продуктам: { tyco: { 'storage.bytes': … } }),
                   creditGrants  (по продуктам, милли-кредиты за месяц),
                   requiresBasePlanId? (для addon),
                   effectiveFrom, effectiveTo, publishedAt
Offer              id, planVersionId, source: 'paddle'|'polar'|'revenuecat'|'manual',
                   externalPriceId, amountMicros, currency, region?, isActive
CreditPack         id, productId, code, credits, validityDays, visibility
CreditPackOffer    id, creditPackId, source, externalPriceId, amountMicros, currency
FeaturePrice       id, productId, feature, version, credits (фикс. цена действия, §10.5)
Promotion          id, code, kind, rules, startsAt, endsAt, maxRedemptions
```

- Цена вынесена в `Offer`: одна версия продаётся по разной цене в Paddle, в
  магазинах (комиссия 15–30 %) и по регионам (PPP). Права у всех офферов одной
  версии одинаковые.
- Курс кредита и наценка версионируются: смена курса не переоценивает уже
  выданные партии (у партии фиксирован `creditRateVersionId` для аналитики
  маржи).
- **`lifetime` в v1 нет.** Пожизненный тариф с ежемесячными кредитами —
  бессрочное обязательство по себестоимости, и у MoR это разовый заказ, а не
  подписка. Если понадобится — отдельный вид покупки: права без ежемесячных
  кредитов, начисление как у пакета.

### 7.2. Жизненный цикл тарифа

- **public** — в прайс-листе, можно купить.
- **unlisted** — по прямой ссылке или выдаётся вручную: акции, early bird,
  награды за рефералов, бесплатный уровень.
- **archived** — купить нельзя; действующие подписки работают на своей версии
  до отмены (grandfathering без миграций).
- Перевод подписчиков на новую версию — только явной операцией из админки с
  уведомлением клиентов (если меняется цена — через смену цены у MoR).

### 7.3. Акции

Два независимых механизма:

- **Скидка на цену** — купон на стороне MoR (`Promotion.kind='discount'` хранит
  ссылку на discount id); в магазинах — промо-офферы через RevenueCat.
- **Другое содержимое** — unlisted-версия тарифа или грант:
  `Promotion.kind='grant'`, правило «при оплате X выдать Y».

### 7.4. Бандлы

`Plan.kind='bundle'`, `productScope=['tyco','fastcat']`. Одна подписка у MoR,
права, квоты и кредиты прописаны по каждому продукту. Если у клиента есть и
бандл, и подписка на продукт, права сливаются по `max` (§6.3) — двойных прав
нет; при покупке бандла сервис предлагает отменить пересекающуюся подписку.

### 7.5. Дополнения (add-ons)

- Дополнение — **отдельная подписка** у источника оплаты на `Plan.kind='addon'`.
  `SubscriptionItem` не используем: в магазинах вложенных позиций нет, а одна
  модель для всех источников проще.
- Требует активной базовой подписки (`requiresBasePlanId` или любой платный
  базовый тариф продукта — правило в версии).
- **Отмена или истечение базовой подписки** → сервис ставит дополнению
  `cancelAtPeriodEnd` у источника; до конца оплаченного периода дополнение
  продолжает давать квоту.
- Дисковая квота продаётся только регулярным дополнением, не разовым пакетом.

---

## 8. Кредиты

### 8.1. Что продаём

Клиент видит **кредиты**, журнал хранит милли-кредиты. Курс и наценка — на
продукт, версионно. Кредиты одного продукта нельзя потратить в другом.

Все цены задаются в админке и хранятся в БД: курс кредита
(`CreditRateVersion`), наценка (`MarkupPolicyVersion`), фиксированные цены
действий (`FeaturePrice`), состав и цены пакетов и тарифов (`CreditPack`,
`Offer`), цены моделей (§10.2). В коде и переменных окружения цен нет; seed
только заводит начальные значения. Изменение — новая версия с
`effectiveFrom`, со сравнением со старой перед публикацией. Денежную цену
оффера при публикации сервис создаёт в Polar через API; сумма из вебхука
сверяется с `Offer.amountMicros`.

### 8.2. Модель

```
CreditWallet       accountId, productId, debtMilli (≥ 0), version   -- строка для блокировки
CreditBucket       id, accountId, productId,
                   kind: 'plan' | 'pack' | 'promo' | 'referral' | 'compensation' | 'trial',
                   grantedMilli, expiresAt?, creditRateVersionId,
                   sourceType, sourceId, createdAt
CreditLedgerEntry  id, accountId, productId, bucketId?, amountMilli (+/-),
                   reason: 'accrual'|'purchase'|'consumption'|'expiry'|'refund'|
                           'revoke'|'adjustment'|'referral_reward'|'promo'|'debt',
                   operationKey, subject?, usageEventId?, paymentId?, holdId?,
                   meta, createdAt
                   UNIQUE (operationKey, bucketId)
CreditHold         id, accountId, productId, subject?, feature, amountMilli,
                   allocations (jsonb: bucketId → milli),
                   status: 'open'|'committed'|'released'|'expired',
                   expiresAt, idempotencyKey (unique), createdAt
```

- Остаток партии — сумма журнала по ней; материализуется в `bucket_balances`
  в той же транзакции для скорости чтения. Источник правды — журнал.
- **Идемпотентность журнала** — по паре `(operationKey, bucketId)`: одно
  списание из двух партий даёт две записи с одним `operationKey`.
- **Долг** живёт на кошельке (`debtMilli`), а не в партии. Перерасход (§8.6)
  увеличивает долг записью `reason='debt'` без партии. Любое новое начисление
  сначала гасит долг, остаток идёт в партию. Сгорание партий долг не трогает.

### 8.3. Начисление

- **По тарифу и PlanGrant** — в начале каждого периода (по
  `currentPeriodStart`, не по календарю). Годовые — ежемесячными порциями.
  Партия `plan` сгорает в конце порции.
- **Пакеты** — при подтверждённой оплате. Партия `pack`, срок `validityDays`
  (по умолчанию 365 дней). Срок — коммерческое решение, а не требование
  закона: он ограничивает бессрочное обязательство по себестоимости. Он
  показывается до оплаты, `expiresAt` фиксируется в партии при покупке и
  позже не меняется; новое значение `validityDays` действует только на новые
  покупки. Напоминания — за 30 и 7 дней до сгорания.
- **Гранты** — акции, рефералы, компенсации: партия соответствующего вида со
  сроком из правила.

### 8.4. Порядок списания и сгорание

- Списание: сначала партии, которые сгорают раньше; при равенстве — `plan` →
  `trial` → `promo` → `referral` → `compensation` → `pack`.
- Резерв распределяется по партиям сразу (`allocations`), commit списывает из
  тех же партий.
- **Сгорание при открытом резерве:** воркер сжигает только свободный остаток
  партии; зарезервированная часть сгорает при release или по истечении резерва.
  Commit по партии, истёкшей во время операции, разрешён.

### 8.5. Перекрёстные гранты

«Купил TyCo Pro — получил 500 кредитов FastCat» — правило `Promotion`, которое
по событию оплаты создаёт партию `promo` в кошельке другого продукта.
Переводов между кошельками нет.

### 8.6. Протокол reserve → commit/release

```
POST /v1/credits/holds          { accountId, productId, subject, feature,
                                  estimate: { meters | costMicros }, ttlSec }
  → 201 { holdId, credits }   |  402 CREDITS_EXHAUSTED  |  403 ENTITLEMENT_DENIED
                              |  429 LIMIT_EXCEEDED
POST /v1/credits/holds/:id/commit   { meters, providerCostMicros?, usageEventId, partial? }
  → { charged, refunded }
POST /v1/credits/holds/:id/extend   { meters, addEstimate }    -- стриминг
POST /v1/credits/holds/:id/release  { reason }
```

- Резерв — верхняя оценка; после commit разница возвращается.
- Резерв и проверка лимитов (§8.8) и предохранителей — в одной транзакции с
  `SELECT … FOR UPDATE` по `CreditWallet`.
- **Commit больше резерва** списывает фактическое; нехватка уходит в долг
  кошелька (§8.2). Пока долг > 0, новые резервы отклоняются.
- **Поздний commit.** Commit по резерву в статусе `expired`/`released`
  принимается в течение окна (настройка продукта, по умолчанию 7 дней) и
  списывает фактическое, при нехватке — в долг. После окна commit тоже
  принимается, но только как `UsageEvent` с себестоимостью, без списания, и
  с алертом. Шлюз пишет commit в свой локальный outbox до ответа
  клиенту и досылает при сбоях — падение шлюза не даёт бесплатного потребления.
- **Ошибка провайдера** — release; `UsageEvent` со статусом `error` и нашей
  себестоимостью пишется всегда.
- **Обрыв клиентом** (закрыл стрим, отменил запрос) — не release, а commit
  того, что провайдер успел посчитать (`partial: true`): деньги он уже взял.
- Незакрытые резервы воркер переводит в `expired` по `expiresAt`.

### 8.7. Lease для частых вызовов

Для командных аккаунтов и параллельных агентов блокировка кошелька на каждый
вызов станет узким местом. Шлюз может взять **lease** — резерв на
`(account, product, subject)` размером N кредитов на T секунд — и расходовать
его локально, отправляя в биллинг пачки `UsageEvent` (commit по lease). Остаток
возвращается по истечении. Протокол тот же, что у hold; lease — это hold с
`kind='lease'` и множественными commit. В SDK шлюза — готовый клиент.

В v1 достаточно обычных hold; lease включаем, если p95 reserve или конфликт
блокировок станет заметным (метрика в §18).

Параметры по умолчанию (настройка продукта): срок 60 с; размер — удвоенный
расход этого `subject` за последнюю минуту, не меньше 20 кредитов и не больше
10 % свободного баланса; продление — когда израсходовано 70 %. Если свободный
баланс меньше пяти минимальных lease, шлюз работает обычными hold, чтобы
остаток не лежал в резерве.

### 8.8. Лимиты (обобщённо)

Вместо зашитых «дневной лимит пользователя» и «лимит участника команды» —
политики в настройках продукта:

```
LimitPolicy  productId, scope: 'subject'|'account'|'product'|'deployment',
             window: 'minute'|'hour'|'day'|'month', meter: 'credits'|'cost_micros'|'requests',
             max, appliesTo (права/тарифы, jsonb), action: 'deny'|'alert'
```

Счётчики окон — в Redis, проверка — при reserve. Глобальные предохранители
(дневной потолок себестоимости на продукт и экземпляр) — это те же политики со
`scope='product'|'deployment'`.

### 8.9. Автопополнение

Из `auto-top-up.service.ts`: выключено по умолчанию, обязательный месячный
потолок. Только для источников со списанием без участия клиента (MoR с
сохранённым методом); в магазинах недоступно. Этап после v1.

### 8.10. Возвраты и chargeback

- **Пакет:** отрицательная запись (`refund`) на непотраченный остаток партии.
  Потраченная часть в минус не уводится, сумма пишется в `meta` для антифрода и
  решения в админке.
- **Подписка (возврат или chargeback):** непотраченный остаток партии `plan`
  текущего периода отзывается (`revoke`), права снимаются по событию
  (немедленно для chargeback, по правилу MoR для возврата). Chargeback, кроме
  того, ставит аккаунту флаг на проверку; повторный — `suspended`.

---

## 9. Связь с AI-шлюзом

AI-шлюз — часть этой системы: приложение `apps/gateway` на `@bozonx/ai-kit` в
том же репозитории и compose, но отдельный процесс. Он выбирает модель и
выполняет вызов; ключи провайдеров живут только в нём. С биллингом шлюз
говорит только через S2S API и `@billing/client`, как любой внешний шлюз
(например, `ai-gateway` BloggerDog), и в БД биллинга напрямую не ходит.
Процесс отдельный, потому что у шлюза долгие стримы и другая нагрузка:
выкладка и сбои `billing-api` не должны рвать вызовы моделей.

Поток одного вызова:

1. Продукт → шлюз: запрос с токеном пользователя.
2. Шлюз → биллинг: права и `reserve` по оценке (входные токены известны,
   выход — `max_tokens`).
3. Шлюз → провайдер.
4. Шлюз → локальный outbox → биллинг: `commit` с вектором потребления и
   `routeId`. Биллинг сам считает стоимость по своей таблице цен и пишет
   `UsageEvent`.
5. При ошибке провайдера — `release`; при обрыве клиентом — частичный commit
   (§8.6).

**Таблица цен в биллинге — источник правды по деньгам.** Каталог `ai-kit` —
для маршрутизации и оценки; цены в нём синхронизируются из биллинга.

---

## 10. Себестоимость и метеринг

### 10.1. Вектор потребления

```
meters: {
  input_tokens, output_tokens, cached_input_tokens, cache_write_tokens,
  reasoning_tokens, audio_input_tokens, audio_seconds, audio_seconds_realtime,
  diarization_seconds, characters, images, image_megapixels, video_seconds,
  web_searches, requests, neurons
}
```

`UsageEvent` хранит вектор (`jsonb`) и основные счётчики отдельными колонками.
Плюс `costMicros`, `priceVersionId`, `markupPolicyVersionId`,
`creditRateVersionId`, `creditsChargedMilli`, `provider`, `model`, `routeId`,
`feature`, `subject`, `status`, `traceId`, `rawUsage`.

### 10.2. Таблица цен

```
ModelRoute         id, provider, model, kind: 'llm'|'stt'|'tts'|'image'|'video'|'mt'|'embed'
RoutePriceVersion  id, routeId, version, effectiveFrom, effectiveTo,
                   source: 'manual'|'seed'|'sync'|'provider-api', approvedBy
RoutePriceItem     priceVersionId, meter, unitMicros, per (1 | 1e6 …),
                   tier? { fromContextTokens, … }, minBillableUnits?
```

Цена — набор строк «счётчик → цена за единицу», с тирами (Gemini дороже при
контексте свыше 200k) и минимальной тарификацией (Groq STT — минимум 10 с).
Новый тип модели не требует миграции схемы.

### 10.3. Правила расчёта

- Токены — **только из ответа провайдера** (`usage`). Свой токенизатор — только
  для оценки резерва.
- **OpenRouter** — фактическая стоимость из ответа (`usage.cost`); цена в
  таблице нужна только для резерва.
- **Gemini** — размышления по цене выхода; аудиовход по своей цене; Live API —
  по токенам аудио; контекстный кэш — отдельные счётчики чтения и хранения.
- **Deepgram / Groq** — по секундам аудио с учётом минимума.
- **Cloudflare Workers AI** — в нейронах.
- **Изображения / видео** — по штукам, мегапикселям, секундам.
- **Батч-API** — отдельный маршрут со своей ценой.

### 10.4. Обновление цен (`packages/pricing-sync`, этап 5)

В v1 цены вводятся вручную в админке (seed для моделей TyCo). Затем — cron раз
в сутки: тянет цены из OpenRouter API, файла `model_prices_and_context_window.json`
LiteLLM (как данные), models.dev; сравнивает с действующими версиями; при
расхождении создаёт **черновик** версии и уведомление в админку. Публикация —
вручную, автопубликация только для OpenRouter.

### 10.5. Цена операции в кредитах

Два способа, выбор — по `feature`:

1. **Фиксированная цена** — если для `feature` есть `FeaturePrice` («экспорт
   видео = 50 кредитов»). Себестоимость всё равно пишется в `UsageEvent` для
   маржи.
2. **По формуле** (из `credit-pricing.rules.ts`), в милли-кредитах:

```
creditsMilli = ceil(costMicros × markup × 1000 / creditValueMicros)
```

`markup` — по ступеням стоимости модели (выше на дешёвых, ниже на топовых),
политика на продукт, версия пишется в событие. Минимума «1 кредит» нет; при
необходимости — `minChargeMilli` в политике.

### 10.6. Сверка с провайдерами (этап 5)

Ежемесячно воркер сравнивает сумму `costMicros` по провайдеру со счётом
провайдера (billing/usage API: OpenAI, Anthropic, OpenRouter, Google Cloud
Billing export; иначе — ввод суммы в админке). Расхождение больше порога
(3 %) — алерт.

---

## 11. Источники оплаты

### 11.1. Порт источника

По образцу `billing-provider.port.ts`:

```ts
interface PaymentSource {
  id: 'paddle' | 'polar' | 'revenuecat' | 'manual';
  capabilities: { checkout, customerPortal, offSessionCharge, proration, refundsApi };
  createCheckout?(input): Promise<{ url }>;
  verifyWebhook(req): Promise<RawEvent>;
  normalize(event): Promise<NormalizedEvent[]>;     // §11.4
  fetchSubscription(externalId): Promise<NormalizedSubscription>; // сверка
  cancel? / changePlan? / pause?                     // где поддерживается
}
```

### 11.2. Merchant of Record

- `ivan-apps` — **Polar**. Для `bloggerdog`, возможно, **Paddle** (зрелее в
  B2B); адаптер Paddle пишем, только когда дойдём до BloggerDog, — порт
  `PaymentSource` это позволяет.
- **Один аккаунт MoR — одно юрлицо.** TyCo и FastCat — два продукта в одном
  аккаунте.
- Checkout — хостовая страница или оверлей MoR; `billingAccountId` передаётся
  в `custom_data`/`metadata` и проверяется в вебхуке.

### 11.3. App Store и Google Play — через RevenueCat

- Квитанции, App Store Server Notifications, Google RTDN, billing retry и
  grace period обрабатывает **RevenueCat**. Биллинг получает его нормализованные
  вебхуки и подключает его как ещё один `PaymentSource` (`source='revenuecat'`,
  в событии — исходный магазин).
- Офферы: `externalPriceId` = product id в RevenueCat/магазине. Подписки —
  auto-renewable; пакеты кредитов — consumables.
- Покупка только после входа. `app_user_id` в RevenueCat = `billingAccountId`.
- Начисление кредитов за consumable — по вебхуку `NON_RENEWING_PURCHASE`,
  идемпотентно по `transaction_id`.
- RevenueCat **не** источник правды по нашим правам: его entitlements не
  используем, только события покупок.
- Внешние ссылки на оплату из приложения (где позволяют правила магазина) —
  флаг на продукт и регион, по умолчанию выключен.

### 11.4. Конфликт источников

- **До покупки:** paywall в приложении спрашивает
  `GET /v1/accounts/me/subscriptions` и блокирует покупку того же тарифа через
  другой источник; checkout MoR проверяет то же на сервере.
- **Если двойная оплата всё же случилась** (покупка в магазине при активной
  подписке MoR): сервис фиксирует `SOURCE_CONFLICT`, оставляет обе подписки
  активными, отменяет у MoR ту, которой можно управлять (`cancelAtPeriodEnd`),
  с возвратом по правилу, уведомляет клиента и создаёт задачу в админке.
  Магазинную подписку сервис отменить не может — только клиент.

### 11.5. Нормализованные события

```
subscription.created | renewed | plan_changed | past_due | recovered |
  cancel_scheduled | expired | paused | resumed | refunded
payment.succeeded | refunded (cumulative) | chargeback
purchase.succeeded (pack/consumable) | refunded
```

Обработка: `BillingWebhookEvent` (уникальность `(source, externalEventId)`) →
очередь → нормализация → доменные действия в транзакции. События не по
порядку: каждая операция сравнивает `occurredAt`/версию и не откатывает более
новое состояние. Ежесуточная сверка (`fetchSubscription` по активным и
`past_due`) чинит пропущенные вебхуки.

---

## 12. Подписки и платежи

### 12.1. Модель

```
Subscription   id, accountId, planVersionId, offerId, source,
               externalSubscriptionId (unique per source), externalCustomerId,
               status, currentPeriodStart, currentPeriodEnd, trialEndsAt,
               cancelAtPeriodEnd, pausedAt?, seats, version
Payment        id, accountId, subscriptionId?, purchaseId?, source, externalId, kind,
               status, currency,
               grossMicros, taxMicros, feeMicros, discountMicros, netMicros,  -- в валюте платежа
               grossUsdMicros, netUsdMicros, fxRate, fxSource, netIsEstimated,
               refundedAmountMicros (накопительно), occurredAt
```

- У аккаунта может быть несколько подписок: базовая на продукт, бандлы,
  дополнения (каждое — отдельная подписка, §7.5).
- **Валюта.** USD-эквивалент считается на момент платежа: курс — из данных MoR,
  если он отдаёт сумму в валюте выплаты, иначе — из курса дня (`fxSource`).
  Для магазинов чистая выручка по транзакции неточна (комиссия 15/30 %,
  налоги по странам) — `netIsEstimated=true`, уточняется при сверке выплат.
  Маржа и комиссии рефералов считаются от `netUsdMicros`.

### 12.2. Статусы

`trialing → active → past_due → read_only → expired`, плюс `paused`. Отмена —
не статус, а флаг `cancelAtPeriodEnd` (подписка остаётся `active` до конца
периода, затем `expired`). Грейс `past_due` — в настройках продукта (7 дней).
Повторные списания делает MoR или магазин; их статусы маппятся на наши.

### 12.3. Даунгрейд и превышение лимитов

`downgrade.rules.ts`: смена тарифа вниз — в конце периода. Ресурсы сверх новых
квот не удаляются, а переходят в «только чтение» (§14.3).

---

## 13. Рефералы (этап 4, конец MVP)

В v1 награды — только кредиты и повышение тарифа, без денег. Управление
программой (админка) и профиль реферера (портал, §17) делаем сразу в полном
виде; денежные выплаты добавляем позже (§13.4).

### 13.1. Модель

Из BloggerDog `Partner`, `ReferralCode`, `ReferralClick`, `Referral`,
`ReferralCommission`, `PartnerPayout`, с изменениями:

- `Referral` привязан к `BillingAccount` и к продукту атрибуции; реферер —
  любой пользователь (`Partner.tier='user'`).
- Добавлена `ReferralReward` — награда нефинансового вида.

```
ReferralProgram     id, productScope, termsVersion, rules (jsonb), status
ReferralReward      id, referralId, referrerAccountId,
                    kind: 'credits' | 'plan_grant' | 'commission',
                    productId, creditsMilli?, planVersionId?, durationDays?,
                    trigger: 'signup'|'first_payment'|'milestone'|'renewal',
                    status: 'pending'|'review'|'granted'|'void',
                    availableAt (холд против возвратов), idempotencyKey
```

### 13.2. Награды v1

- **Кредиты** — партия `referral` реферера; приглашённому — приветственная.
- **Подписка** — `PlanGrant` на N дней («3 оплатившихся — месяц Pro»).
- Награда — после первой оплаты приглашённого и холда (14 дней). Возврат или
  chargeback в период холда — `void`; после выдачи не отзывается.

### 13.3. Гранты тарифа

```
PlanGrant   id, accountId, productId, planVersionId,
            source: 'default'|'referral'|'promo'|'manual'|'beta',
            sourceId, startsAt, endsAt? (null = бессрочно), status
```

Грант даёт права, квоты и ежемесячные кредиты, как подписка, без оплаты. Если
есть платная подписка, права сливаются по `max` (§6.3). Грант на тариф не выше
текущего платного автоматически конвертируется в кредиты
(`rules.fallbackCredits`), чтобы награда не пропадала.

### 13.4. Денежные выплаты (позже)

Таблицы `ReferralCommission` и `PartnerPayout` создаются сразу, комиссии
пишутся `pending` при включённом флаге программы, выплаты в v1 выключены.
Правила из BloggerDog: комиссия от `netUsdMicros`, отмена — только
отрицательной записью, ставка фиксируется на момент платежа, версия условий на
реферале. Альтернатива — партнёрка самого MoR.

### 13.5. Антифрод

- Атрибуция по коду при регистрации; самоприглашение запрещено (совпадение
  email-домена + устройства, платёжного метода по данным MoR, IP-подсети).
- Награда только после реальной оплаты, с холдом.
- Лимит наград на реферера в месяц; превышение — `review`.

---

## 14. Квоты

Диск — частный случай. Обобщаем, чтобы новый лимит («проекты», «места»,
«расшифровки в месяц») добавлялся конфигурацией, а не эндпоинтами.

### 14.1. Реестр квот продукта

```
ProductQuotaKey   productId, key, kind: 'level' | 'consumable',
                  unit ('bytes'|'count'|'seconds'…), period? ('month' для consumable),
                  overPolicy: { mode: 'deny'|'read_only', graceDays, retentionEvent? }
QuotaUsage        accountId, productId, key, value, measuredAt        -- level
QuotaCounter      accountId, productId, key, periodStart, used        -- consumable
QuotaReservation  id, accountId, productId, key, amount, status, expiresAt
```

- **level** — измеряемый уровень: `storage.bytes`, `seats`, `projects`. Продукт
  сообщает текущее значение (`PUT /v1/quotas/usage`) после изменений и раз в
  сутки полным пересчётом.
- **consumable** — расход в периоде, сбрасывается по периоду подписки:
  «100 расшифровок в месяц». Списывается так же, как кредиты: reserve/commit.

### 14.2. Лимит

`лимит = max(базовые источники) + Σ дополнения + override` (§6.3).

### 14.3. Резерв и превышение

- Перед загрузкой/созданием продукт вызывает `POST /v1/quotas/reservations`,
  после — commit фактического значения. Параллельные загрузки не превышают
  квоту.
- Превышение (после даунгрейда или неоплаты) — по `overPolicy` ключа: например,
  для диска `read_only` → грейс 30 дней с уведомлениями → событие
  `quota.retention_due`. Удаляет данные продукт, не сервис.
- История уровней (`QuotaUsageSnapshot`, ежедневно) — для аналитики и будущей
  оплаты по пику.

---

## 15. Онлайн-требование для TyCo

- Платные функции (облачные модели, синхронизация, облачный STT) требуют сети:
  все они идут через AI-шлюз и биллинг. Офлайн платные права не действуют.
- Токен прав — короткоживущий JWT (15 минут), подписан ключом экземпляра (JWKS
  по `/.well-known/jwks.json`), обновляется в фоне. Только для UI; решения о
  списании принимает сервер.
- Без сети TyCo работает с локальными моделями. Локальные функции не требуют
  аккаунта.

---

## 16. API

### 16.1. Типы клиентов

| Клиент | Аутентификация | Что может |
| --- | --- | --- |
| Сервер продукта / AI-шлюз | API-ключ продукта (`Authorization: Bearer`), привязан к `productId`, scopes | права, holds/leases, usage, квоты, внешние аккаунты, checkout-ссылки |
| Приложение пользователя | access token внешнего IdP | свой баланс, подписки, история, checkout |
| Админка | вход через IdP + `StaffRole` + аудит | всё, с записью в `AdminAuditLog` |
| MoR / RevenueCat | подпись / секрет вебхука | вебхуки |

Ключ продукта не читает и не меняет данные другого продукта, кроме явно
разрешённых кросс-продуктовых операций (гранты по правилу акции).

### 16.2. Основные эндпоинты

```
GET    /v1/accounts/:id/entitlements?product=tyco
GET    /v1/accounts/:id/balance?product=tyco
GET    /v1/accounts/me/subscriptions
POST   /v1/credits/holds                 · /:id/commit · /:id/extend · /:id/release
POST   /v1/usage                         (событие без резерва: бесплатные/системные вызовы)
PUT    /v1/quotas/usage                  · POST /v1/quotas/reservations · /:id/commit
POST   /v1/checkout                      { accountId, offerId | packOfferId, returnUrl } → { url }
GET    /v1/catalog?product=tyco&source=paddle&country=AR
POST   /v1/accounts/external             (командные и экземпляры без общего IdP)
POST   /v1/referrals/attribution
POST   /webhooks/:source
```

Ошибки — коды из `BILLING_ERROR_CODES`, плюс `QUOTA_EXCEEDED`,
`LIMIT_EXCEEDED`, `SOURCE_CONFLICT`, `ACCOUNT_IN_DEBT`. Отказ из-за баланса —
HTTP 402, из-за лимита частоты — 429.

### 16.3. События продуктам и кэш

Подписанные вебхуки продукту (outbox, повторы с экспоненциальной задержкой):
`entitlements.changed`, `balance.low`, `subscription.*`, `quota.over_limit`,
`quota.retention_due`. SDK проверяет подпись и сбрасывает кэш прав. Кэш прав в
SDK — 60 секунд плюс сброс по событию.

---

## 17. Веб: портал клиента и админка

**web** (Nuxt, `account.<бренд>`):

- страница тарифов продукта и checkout;
- баланс по продуктам, история списаний по функциям (из журнала), платежи
  (ссылки MoR), управление подпиской (портал MoR), профиль реферера (этап 4:
  ссылка и код, приглашённые, награды в ожидании и выданные),
  квоты.

Вход — через IdP. Продукты открывают нужную страницу по ссылке с `product` и
`returnUrl`; для встраивания — `@billing/client-vue`.

**admin** (Nuxt): переносим разделы BloggerDog `money/*` (plans, credits,
subscriptions, payments, partners, overrides), `PlanVersionDiff`, impersonation,
аудит. Новое: каталог продуктов, реестры прав и квот, офферы по источникам,
цены моделей, курс кредита, наценка и цены действий, политики лимитов,
конфликты источников, дашборд маржи, управление рефералами (программы и
версии условий, рефереры, награды на проверке, ручная выдача и отмена); позже —
черновики `pricing-sync` и сверка с провайдерами.

---

## 18. Надёжность и эксплуатация

- **Транзакции:** изменения журнала, резервов и подписок — в транзакции
  Postgres; конкурентный доступ к кошельку — блокировка строки `CreditWallet`.
- **Outbox** для исходящих событий и писем; **inbox** (`BillingWebhookEvent`)
  для входящих. Шлюз держит свой outbox для commit (§8.6).
- **Воркер (BullMQ):** вебхуки, истечение резервов, сгорание партий,
  начисление по периодам, сверка с MoR/RevenueCat; позже — `pricing-sync`,
  сверка с провайдерами AI, снимки квот, холды рефералов.
- **Метрики:** списания, отказы 402/429, задержка и ожидание блокировок
  reserve/commit (порог для включения lease), поздние commit, долг по
  кошелькам, отставание очереди вебхуков, **маржа по продукту/тарифу/модели**.
- **Предохранители:** политики лимитов `scope='product'|'deployment'` (§8.8);
  срабатывание — отказ в резервах и алерт.
- **Резервное копирование:** PITR для Postgres; журнал кредитов — критичные
  данные.

---

## 19. Безопасность и защита от злоупотреблений

- Ключи продуктов хранятся хэшем, ротация без простоя (два активных ключа).
- Подпись всех вебхуков (входящих и исходящих), защита от replay по времени.
- Бесплатный уровень: `email_verified` из IdP до любых AI-трат, приветственные
  кредиты — после подтверждения; лимит регистраций на устройство/IP — на
  стороне IdP и продукта.
- Лимиты частоты — отдельно от кредитов (§8.8): кредиты — про деньги, лимиты —
  про злоупотребления и зацикленных агентов.
- BYOK — право `byok.allowed`; вызовы с BYOK пишут `UsageEvent` с
  `costMicros=0` и не списывают кредиты (плата за платформу — правило продукта).

---

## 20. Персональные данные и удаление

- Удаление из одного продукта и удаление аккаунта целиком — разные операции.
- Профиль пользователя хранится в IdP; биллинг хранит минимум (`subject`,
  email для писем, страна).
- При полном удалении: обезличивание `BillingAccount`; финансовые записи
  храним обезличенными столько, сколько требует закон; у MoR и RevenueCat —
  запрос на удаление через API.
- `ReferralClick` — только хэш посетителя.

---

## 21. Экземпляры и юридическая сторона

- `ivan-apps`: TyCo (сейчас), FastCat (позже), внешний IdP, один аккаунт MoR.
- `bloggerdog` (позже): своя БД, свой аккаунт MoR, свой auth — подключается
  через S2S API как внешний продукт.
- **Права на код.** Сервис — отдельный репозиторий и собственность автора.
  BloggerDog его не владеет, а покупает лицензию. Код, переносимый из
  BloggerDog, должен принадлежать автору (а не будущей компании BloggerDog) —
  зафиксировать это в договоре до появления совладельцев или инвесторов
  BloggerDog, иначе сервис окажется производным от их кода.

---

## 22. Что берём из BloggerDog

| Откуда | Что | Как |
| --- | --- | --- |
| корень репозитория | pnpm-workspace с `catalog:`, turbo, eslint/prettier, `prisma.config.ts`, `pnpm check`, docker-compose | скопировать каркас |
| `billing/domain/*.rules.ts` | начисление, цена кредитов, порядок списания, статусы, даунгрейд, места | в `packages/core`, обобщить на продукты, партии, милли-кредиты |
| `credits.service.ts` | reserve/commit/release, лимиты | переписать под `CreditBucket`, долг, поздний commit, `LimitPolicy` |
| `subscriptions.service.ts`, `billing.processor.ts`, `billing-webhook.controller.ts` | вебхуки, inbox, идемпотентность | переписать под `PaymentSource` и несколько подписок |
| `providers/billing-provider.port.ts` | порт провайдера | расширить (§11.1); Lemon Squeezy не переносим |
| `auto-top-up.service.ts`, `seats.service.ts` | автопополнение, места | перенести (места — как квота `seats`) |
| `entitlements.contracts.ts`, `entitlements.service.ts` | реестр и вычисление прав | реестр в БД, двухслойное слияние |
| Prisma: `Plan`, `PlanVersion`, `CreditPack`, `Payment`, `BillingWebhookEvent` | модели | основа; цена — в `Offer`, USD-эквиваленты в `Payment` |
| Prisma: `AiUsageEvent`, `AiModelRoute`, `AiModelRoutePricing` | метеринг и цены | обобщить в вектор и `RoutePriceItem` |
| Prisma и `referrals.contracts.ts` | рефералы и комиссии | основа + `ReferralReward`, `PlanGrant` |
| `ai-usage.config.ts` | предохранители | в `LimitPolicy` |
| `apps/admin/pages/money/*`, `PlanVersionDiff.vue` | админка | перенести |
| `MailOutbox` | исходящие письма | перенести |
| `docker/metrics` | дашборды | адаптировать |

Не берём: `auth`, `UserSession`, `AuthIdentity`, `VerificationToken` — логин у
внешнего IdP.

---

## 23. Этапы

**v1 — всё, что нужно TyCo, и ничего больше.** В модели данных сразу есть
бандлы, дополнения, рефералы, RevenueCat и второй экземпляр, но в коде v1 их
нет.

1. **Ядро.** Каркас монорепо из BloggerDog, `packages/core` с перенесёнными
   правилами и тестами, Prisma-схема: продукты, каталог, кошельки, партии,
   журнал, резервы, права, квоты, лимиты. S2S API: права, holds, usage.
   Админка: продукт TyCo, тарифы, ручные кредиты, ручная таблица цен.
2. **Метеринг для TyCo.** Таблица цен для моделей TyCo, интеграция с
   AI-шлюзом на `ai-kit` (outbox commit, частичный commit), дашборд маржи.
3. **Оплата и вход.** Выбор IdP, адаптер Polar, checkout, вебхуки, сверка,
   портал клиента. Бесплатный уровень. **Запуск TyCo.**
4. **Рефералы v1 — конец MVP.** Награды кредитами и грантами тарифа, антифрод,
   холды, управление программой в админке, профиль реферера в портале. Без
   денежных выплат.
5. **Доработка после запуска TyCo.** `pricing-sync`, сверка с провайдерами,
   автопополнение, lease — по метрикам.
6. **FastCat.** Второй продукт в `ivan-apps`, квоты диска, дополнения, бандл
   TyCo + FastCat.
7. **Магазины.** RevenueCat как `PaymentSource`, конфликт источников.
8. **BloggerDog.** Отдельный экземпляр; BloggerDog ещё не запущен, поэтому
   переноса боевых данных нет: переключаем его `ai-gateway` и checkout на S2S
   API и удаляем старый модуль биллинга из BloggerDog. Лицензионный договор.
9. **Позже.** Денежные выплаты партнёрам, оплата диска по пику, внешние ссылки
   на оплату из мобильных приложений, `lifetime`.

---

## 24. Открытые вопросы

1. Polar для `ivan-apps`: проверить условия для AI-продуктов и стран клиентов
   и может ли Polar meters закрыть часть учёта. Paddle для `bloggerdog` —
   решаем на этапе 8.
2. Какой IdP: Zitadel, Logto, Keycloak, Ory (self-hosted или облако).
   Требования: OIDC + PKCE, loopback для Tauri, Google/Apple, magic link.
3. Значения курса кредита и ступеней наценки для TyCo (вводятся в админке).
4. Формулировки срока пакетов и невозвратности для ЕС — сверить с условиями
   Polar как продавца.
5. Правила реферальной программы v1 (размер наград, пороги, холд).
6. Юрлицо для `ivan-apps`; договор о правах на перенесённый из BloggerDog код
   и лицензия для BloggerDog.
