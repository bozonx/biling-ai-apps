<script setup lang="ts">
import { adminActionDefinitions } from "~/utils/admin-definitions";
import { getFieldConfig, type SelectOption } from "~/utils/admin-field-config";

const props = withDefaults(
  defineProps<{
    allowedActions?: string[];
    defaultAction?: string;
  }>(),
  {
    allowedActions: undefined,
    defaultAction: undefined,
  },
);

const { t, te } = useI18n();
const admin = useAdminStore();

const availableActionKeys = computed(() => {
  if (props.allowedActions && props.allowedActions.length > 0) {
    return props.allowedActions;
  }
  return Object.keys(adminActionDefinitions);
});

const action = ref(
  props.defaultAction ?? availableActionKeys.value[0] ?? "product",
);

watch(
  () => props.defaultAction,
  (newVal) => {
    if (newVal) action.value = newVal;
  },
);

const actionOptions = computed(() =>
  availableActionKeys.value.map((value) => ({
    value,
    label: t(`admin.actions.${value}`),
  })),
);

const fields = computed(() => adminActionDefinitions[action.value] ?? []);
const values = reactive<Record<string, any>>({});

function initFieldDefaults(act: string) {
  const currentFields = adminActionDefinitions[act] ?? [];
  for (const field of currentFields) {
    const config = getFieldConfig(act, field);
    if (config.control === "multiselect") {
      values[field] = [];
    } else if (config.control === "json") {
      values[field] = config.template
        ? JSON.stringify(config.template, null, 2)
        : "";
    } else if (config.control === "number") {
      if (values[field] === undefined) {
        values[field] = config.min ?? 1;
      }
    } else if (config.control === "select") {
      if (config.options && config.options.length > 0) {
        values[field] = config.options[0];
      } else if (config.getCatalogOptions) {
        const opts = config.getCatalogOptions(admin.catalog, values);
        if (opts.length > 0 && !values[field]) {
          values[field] = opts[0]?.value ?? "";
        }
      }
    } else if (config.control === "datetime") {
      if (!values[field]) {
        values[field] = "";
      }
    } else {
      if (values[field] === undefined) {
        values[field] = "";
      }
    }
  }
}

watch(
  () => action.value,
  (newAct) => {
    // Clear old values when action changes
    for (const key of Object.keys(values)) {
      delete values[key];
    }
    initFieldDefaults(newAct);
  },
  { immediate: true },
);

// Reset target ID when publish target changes
watch(
  () => values.target,
  () => {
    if (action.value === "publish") {
      const config = getFieldConfig("publish", "id");
      const opts = config.getCatalogOptions
        ? config.getCatalogOptions(admin.catalog, values)
        : [];
      values.id = opts[0]?.value ?? "";
    }
  },
);

function getSelectOptions(field: string): SelectOption[] {
  const config = getFieldConfig(action.value, field);
  if (config.getCatalogOptions) {
    return config.getCatalogOptions(admin.catalog, values);
  }
  if (config.options && config.enumKey) {
    return config.options.map((opt) => ({
      value: opt,
      label: te(`admin.enums.${config.enumKey}.${opt}`)
        ? t(`admin.enums.${config.enumKey}.${opt}`)
        : opt,
    }));
  }
  return [];
}

function getMultiselectOptions(field: string): SelectOption[] {
  const config = getFieldConfig(action.value, field);
  if (config.getCatalogOptions) {
    return config.getCatalogOptions(admin.catalog, values);
  }
  if (config.options && config.enumKey) {
    return config.options.map((opt) => ({
      value: opt,
      label: te(`admin.enums.${config.enumKey}.${opt}`)
        ? t(`admin.enums.${config.enumKey}.${opt}`)
        : opt,
    }));
  }
  return [];
}

function toggleMultiselectValue(field: string, val: string) {
  if (!Array.isArray(values[field])) {
    values[field] = [];
  }
  const current = values[field] as string[];
  const idx = current.indexOf(val);
  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(val);
  }
}

function selectAllMultiselect(field: string) {
  const opts = getMultiselectOptions(field);
  values[field] = opts.map((o) => o.value);
}

function clearMultiselect(field: string) {
  values[field] = [];
}

function isMultiselected(field: string, val: string): boolean {
  if (!Array.isArray(values[field])) return false;
  return (values[field] as string[]).includes(val);
}

function hasFieldHint(field: string): boolean {
  return te(`admin.fieldHints.${field}`);
}

async function onSubmit() {
  await admin.executeAction(action.value, fields.value, values);
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <h2 class="font-semibold text-base">{{ t("admin.action") }}</h2>
          <CommonInfoTooltip :text="t('admin.hints.actionHeader')" wide />
        </div>
      </div>
    </template>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <!-- Action selector -->
      <UFormField v-if="availableActionKeys.length > 1">
        <template #label>
          <span class="inline-flex items-center gap-1.5">
            <span>{{ t("admin.action") }}</span>
            <CommonInfoTooltip
              :text="t('admin.fieldHints.actionSelect')"
              wide
            />
          </span>
        </template>
        <USelect v-model="action" :items="actionOptions" class="w-full" />
      </UFormField>

      <!-- Dynamic fields -->
      <UFormField v-for="field in fields" :key="field">
        <template #label>
          <span class="inline-flex items-center gap-1.5">
            <span>{{ t(`admin.fields.${field}`) }}</span>
            <CommonInfoTooltip
              v-if="hasFieldHint(field)"
              :text="t(`admin.fieldHints.${field}`)"
              wide
            />
          </span>
        </template>

        <!-- 1. Select Control (Enums & Catalog Entities) -->
        <template v-if="getFieldConfig(action, field).control === 'select'">
          <div v-if="getSelectOptions(field).length > 0" class="w-full">
            <USelect
              v-model="values[field]"
              :items="getSelectOptions(field)"
              class="w-full"
              :placeholder="t('admin.selectPlaceholder')"
            />
          </div>
          <div
            v-else
            class="flex items-center justify-between rounded-lg border border-dashed border-default px-3 py-2 text-xs text-muted"
          >
            <span>{{ t("admin.noItemsInCatalog") }}</span>
            <UInput
              v-model="values[field]"
              placeholder="UUID"
              class="w-64 font-mono text-xs"
            />
          </div>
        </template>

        <!-- 2. Multiselect / Checkboxes Control (Scopes & Product scopes) -->
        <template
          v-else-if="getFieldConfig(action, field).control === 'multiselect'"
        >
          <div
            class="space-y-2 rounded-lg border border-default p-3 bg-muted/10"
          >
            <div
              class="flex items-center justify-between pb-1 border-b border-default text-xs"
            >
              <span class="text-muted font-medium">
                {{ values[field]?.length || 0 }}
                {{ t("common.viewAll").toLowerCase() }}
              </span>
              <div class="flex items-center gap-3">
                <UButton
                  variant="link"
                  color="neutral"
                  size="xs"
                  class="p-0 text-xs"
                  @click.prevent="selectAllMultiselect(field)"
                >
                  {{ t("admin.selectAll") }}
                </UButton>
                <UButton
                  variant="link"
                  color="neutral"
                  size="xs"
                  class="p-0 text-xs"
                  @click.prevent="clearMultiselect(field)"
                >
                  {{ t("admin.clearAll") }}
                </UButton>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <label
                v-for="opt in getMultiselectOptions(field)"
                :key="opt.value"
                class="flex items-center gap-2 cursor-pointer select-none rounded p-1.5 hover:bg-muted/30 transition-colors"
              >
                <UCheckbox
                  :model-value="isMultiselected(field, opt.value)"
                  @update:model-value="toggleMultiselectValue(field, opt.value)"
                />
                <span class="text-xs font-medium">{{ opt.label }}</span>
              </label>
            </div>
          </div>
        </template>

        <!-- 3. Number Control (AppNumberInput with wheel support) -->
        <template
          v-else-if="getFieldConfig(action, field).control === 'number'"
        >
          <AppNumberInput
            v-model="values[field]"
            :min="getFieldConfig(action, field).min"
            :max="getFieldConfig(action, field).max"
            :step="getFieldConfig(action, field).step"
            :placeholder="t(`admin.fields.${field}`)"
            required
          />
        </template>

        <!-- 4. Datetime Control (AppDateTimeInput) -->
        <template
          v-else-if="getFieldConfig(action, field).control === 'datetime'"
        >
          <AppDateTimeInput
            v-model="values[field]"
            :placeholder="t(`admin.fields.${field}`)"
            required
          />
        </template>

        <!-- 5. JSON Control (AppJsonTextarea with template & validation) -->
        <template v-else-if="getFieldConfig(action, field).control === 'json'">
          <AppJsonTextarea
            v-model="values[field]"
            :template="getFieldConfig(action, field).template"
          />
        </template>

        <!-- 6. Default Text Control -->
        <template v-else>
          <UInput
            v-model="values[field]"
            :placeholder="getFieldConfig(action, field).placeholder"
            class="w-full"
            required
          />
        </template>
      </UFormField>

      <div class="flex items-center gap-3 pt-2">
        <UButton type="submit" :loading="admin.busy">
          {{ t("admin.save") }}
        </UButton>
      </div>
    </form>
  </UCard>
</template>
