<script setup lang="ts">
definePageMeta({ layout: false });
const { t } = useI18n();
const token = ref("");
const action = ref("product");
const busy = ref(false);
const pending = { fingerprint: "", key: "" };
useHead({ title: () => t("admin.title") });
const error = ref("");
const secret = ref("");
const catalog = ref<Record<string, unknown[]>>({});
const values = reactive<Record<string, string>>({});
const definitions: Record<string, string[]> = {
  route: ["provider", "model", "variant", "kind"],
  productRoute: ["productId", "routeId"],
  markup: ["productId", "version", "tiers", "minChargeMilli", "effectiveFrom"],
  limitPolicy: ["productId", "window", "meter", "max"],
  endVersion: ["id", "effectiveTo"],
  publish: ["target", "id", "effectiveFrom"],
  revokeVersion: ["id"],
  routePrice: ["routeId", "version", "effectiveFrom", "items"],
  price: ["featureId", "version", "creditsMilli", "unit", "per"],
  product: ["code", "name"],
  feature: ["productId", "key", "pricing"],
  rate: ["productId", "version", "creditValueMicros"],
  plan: ["code", "name", "productScope", "kind"],
  version: [
    "planId",
    "version",
    "creditGrants",
    "limits",
    "entitlements",
    "creditGrantInterval",
    "creditGrantIntervalCount",
  ],
  key: ["productId", "name", "scopes"],
  revokeKey: ["id"],
  credits: ["productId", "accountId", "amountMilli", "creditRateVersionId"],
};
const columns: Record<string, string[]> = {
  tasks: ["id", "kind", "accountId", "status", "details"],
  routes: ["id", "provider", "model", "variant", "kind"],
  markups: [
    "id",
    "productId",
    "version",
    "tiers",
    "minChargeMilli",
    "effectiveFrom",
    "publishedAt",
  ],
  productRoutes: ["productId", "routeId", "isActive"],
  margin: [
    "productId",
    "routeId",
    "provider",
    "model",
    "creditsChargedMilli",
    "costNanos",
    "requests",
  ],
  routePrices: [
    "id",
    "routeId",
    "version",
    "effectiveFrom",
    "items",
    "publishedAt",
  ],
  products: ["id", "code", "name", "status"],
  features: ["id", "productId", "key", "pricing", "status"],
  prices: ["id", "featureId", "version", "creditsMilli", "unit", "per"],
  rates: [
    "id",
    "productId",
    "version",
    "creditValueMicros",
    "publishedAt",
    "effectiveFrom",
  ],
  plans: ["id", "code", "name", "kind", "productScope"],
  versions: [
    "id",
    "planId",
    "version",
    "creditGrants",
    "entitlements",
    "limits",
    "publishedAt",
    "effectiveFrom",
    "effectiveTo",
    "revokedAt",
  ],
  keys: ["id", "productId", "name", "prefix", "scopes", "status"],
};
function cell(row: unknown, field: string) {
  const value = (row as Record<string, unknown>)[field];
  return typeof value === "object"
    ? JSON.stringify(value)
    : String(value ?? "");
}
const fields = computed(() => definitions[action.value] ?? []);
const options = computed(() =>
  Object.keys(definitions).map((value) => ({
    value,
    label: t(`admin.actions.${value}`),
  })),
);
async function request(path: string, body?: Record<string, unknown>) {
  if (body) {
    const fingerprint = JSON.stringify(body);
    if (pending.fingerprint !== fingerprint) {
      pending.fingerprint = fingerprint;
      pending.key = crypto.randomUUID();
    }
  }
  return $fetch<Record<string, unknown>>(`/api/v1/admin/${path}`, {
    method: body ? "POST" : "GET",
    body,
    headers: {
      Authorization: `Bearer ${token.value}`,
      ...(body ? { "Idempotency-Key": pending.key } : {}),
    },
  });
}
async function load() {
  busy.value = true;
  error.value = "";
  try {
    catalog.value = (await request("catalog")) as Record<string, unknown[]>;
    const rows = await $fetch<
      {
        productId: string;
        routeId: string | null;
        provider: string | null;
        model: string | null;
        _sum: { creditsChargedMilli: string | null; costNanos: string | null };
        _count: number;
      }[]
    >("/api/v1/admin/margin", {
      headers: { Authorization: `Bearer ${token.value}` },
    });
    catalog.value.margin = rows.map((row) => ({
      ...row,
      creditsChargedMilli: row._sum.creditsChargedMilli ?? "0",
      costNanos: row._sum.costNanos ?? "0",
      requests: row._count,
    }));
  } catch {
    error.value = t("admin.failed");
  } finally {
    busy.value = false;
  }
}
async function save() {
  busy.value = true;
  error.value = "";
  secret.value = "";
  try {
    const body: Record<string, unknown> = {};
    for (const field of fields.value) {
      const value = values[field] ?? "";
      body[field] = ["version", "creditGrantIntervalCount"].includes(field)
        ? Number(value)
        : ["scopes", "productScope"].includes(field)
          ? value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
          : [
                "creditGrants",
                "entitlements",
                "items",
                "limits",
                "tiers",
              ].includes(field)
            ? JSON.parse(value)
            : value;
    }
    if (action.value !== "credits") body.action = action.value;
    const result = await request(
      action.value === "credits" ? "credits" : "catalog",
      body,
    );
    pending.fingerprint = "";
    secret.value = typeof result.secret === "string" ? result.secret : "";
    await load();
  } catch {
    error.value = t("admin.failed");
  } finally {
    busy.value = false;
  }
}
function disconnect() {
  token.value = "";
  secret.value = "";
  catalog.value = {};
}
</script>

<template>
  <main class="mx-auto max-w-5xl space-y-6 p-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">{{ t("admin.title") }}</h1>
      <AppLanguageSwitcher />
    </header>
    <UCard>
      <div class="flex flex-wrap items-end gap-3">
        <UFormField :label="t('admin.token')"
          ><UInput v-model="token" type="password" autocomplete="off"
        /></UFormField>
        <UButton :loading="busy" :disabled="!token" @click="load">{{
          t("admin.load")
        }}</UButton>
        <UButton variant="outline" @click="disconnect">{{
          t("admin.disconnect")
        }}</UButton>
      </div>
      <p class="mt-2 text-sm text-muted">{{ t("admin.tokenHint") }}</p>
    </UCard>
    <UAlert v-if="error" color="error" :title="error" />
    <UAlert
      v-if="secret"
      color="warning"
      :title="t('admin.secret')"
      :description="secret"
    />
    <UCard v-if="Object.keys(catalog).length">
      <form class="space-y-4" @submit.prevent="save">
        <UFormField :label="t('admin.action')"
          ><USelect v-model="action" :items="options"
        /></UFormField>
        <UFormField
          v-for="field in fields"
          :key="field"
          :label="t(`admin.fields.${field}`)"
        >
          <UTextarea
            v-if="
              ['creditGrants', 'entitlements', 'items', 'limits'].includes(
                field,
              )
            "
            v-model="values[field]"
            class="w-full"
          />
          <UInput v-else v-model="values[field]" class="w-full" required />
        </UFormField>
        <UButton type="submit" :loading="busy">{{ t("admin.save") }}</UButton>
      </form>
    </UCard>
    <UCard v-for="(rows, section) in catalog" :key="section">
      <template #header
        ><h2 class="font-semibold">
          {{ t(`admin.sections.${section}`) }}
        </h2></template
      >
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr>
              <th v-for="column in columns[section]" :key="column" class="p-2">
                {{ t(`admin.fields.${column}`) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, index) in rows"
              :key="index"
              class="border-t border-default"
            >
              <td
                v-for="column in columns[section]"
                :key="column"
                class="max-w-xs break-words p-2"
              >
                {{ cell(row, column) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </main>
</template>
