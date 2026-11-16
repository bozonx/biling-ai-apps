<script setup lang="ts">
import {
  adminActionDefinitions,
  adminEditFieldDefinitions,
} from "~/utils/admin-definitions";
import { getFieldConfig, type SelectOption } from "~/utils/admin-field-config";

const props = withDefaults(
  defineProps<{
    action: string;
    mode?: "create" | "edit";
    initialData?: Record<string, any>;
  }>(),
  {
    mode: "create",
    initialData: () => ({}),
  },
);

const emit = defineEmits<{
  (e: "success"): void;
}>();

const isOpen = defineModel<boolean>("open", { default: false });

const { t, te } = useI18n();
const admin = useAdminStore();

const createdSecret = ref("");
const formError = ref("");
const values = reactive<Record<string, any>>({});

const fields = computed(() => {
  if (props.mode === "edit") {
    return (
      adminEditFieldDefinitions[props.action] ??
      adminActionDefinitions[props.action] ??
      []
    );
  }
  return adminActionDefinitions[props.action] ?? [];
});

const modalTitle = computed(() => {
  const entityLabel = te(`admin.actions.${props.action}`)
    ? t(`admin.actions.${props.action}`)
    : props.action;
  if (props.mode === "edit") {
    const identifier =
      props.initialData?.name ||
      props.initialData?.code ||
      props.initialData?.key ||
      (props.initialData?.id
        ? `${String(props.initialData.id).slice(0, 8)}...`
        : entityLabel);
    return t("admin.modal.editTitle", { name: identifier });
  }
  return t("admin.modal.createTitle", { entity: entityLabel });
});

function initValues() {
  createdSecret.value = "";
  formError.value = "";

  for (const key of Object.keys(values)) {
    delete values[key];
  }

  const currentFields = fields.value;

  for (const field of currentFields) {
    const config = getFieldConfig(props.action, field);

    const existing = props.initialData?.[field];
    if (existing !== undefined && existing !== null) {
      if (config.control === "json") {
        values[field] =
          typeof existing === "object"
            ? JSON.stringify(existing, null, 2)
            : String(existing);
      } else if (config.control === "multiselect") {
        values[field] = Array.isArray(existing) ? [...existing] : [existing];
      } else if (field === "isActive") {
        values[field] = existing ? "true" : "false";
      } else {
        values[field] = existing;
      }
      continue;
    }

    // Default initialization for create mode
    if (config.control === "multiselect") {
      values[field] = [];
    } else if (config.control === "json") {
      values[field] = config.template
        ? JSON.stringify(config.template, null, 2)
        : "";
    } else if (config.control === "number") {
      values[field] = config.min ?? 1;
    } else if (config.control === "select") {
      if (config.options && config.options.length > 0) {
        values[field] = config.options[0];
      } else if (config.getCatalogOptions) {
        const opts = config.getCatalogOptions(admin.catalog, values);
        values[field] = opts[0]?.value ?? "";
      } else {
        values[field] = "";
      }
    } else {
      values[field] = "";
    }
  }
}

watch(
  [() => isOpen.value, () => props.action, () => props.mode],
  ([newOpen]) => {
    if (newOpen) {
      initValues();
    }
  },
  { immediate: true },
);

watch(
  () => values.kind,
  (newKind) => {
    if (
      props.action === "route" &&
      newKind &&
      isOpen.value &&
      props.mode === "create"
    ) {
      const availableProviders = getSelectOptions("provider").map(
        (o) => o.value,
      );
      if (
        availableProviders.length > 0 &&
        !availableProviders.includes(values.provider)
      ) {
        values.provider = availableProviders[0];
      }
    }
  },
);

watch(
  () => values.provider,
  (newProvider) => {
    if (
      props.action === "route" &&
      newProvider &&
      isOpen.value &&
      props.mode === "create"
    ) {
      const availableModels = getSelectOptions("model").map((o) => o.value);
      if (
        availableModels.length > 0 &&
        (!values.model || !availableModels.includes(values.model))
      ) {
        values.model = availableModels[0];
      }
    }
  },
);

function getSelectOptions(field: string): SelectOption[] {
  const config = getFieldConfig(props.action, field);
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
  if (config.options) {
    return config.options.map((opt) => ({
      value: opt,
      label: opt,
    }));
  }
  return [];
}

function getMultiselectOptions(field: string): SelectOption[] {
  const config = getFieldConfig(props.action, field);
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
  formError.value = "";
  if (props.mode === "create") {
    const success = await admin.executeAction(
      props.action,
      fields.value,
      values,
    );
    if (success) {
      if (admin.secret) {
        createdSecret.value = admin.secret;
      } else {
        isOpen.value = false;
        emit("success");
      }
    } else {
      formError.value = admin.error ? t(admin.error) : t("admin.failed");
    }
  } else {
    const id = props.initialData?.id;
    const extra: Record<string, unknown> = {};
    if (props.action === "productRoute") {
      extra.productId = props.initialData?.productId;
      extra.routeId = props.initialData?.routeId;
    }
    const success = await admin.updateEntity(
      props.action,
      id,
      fields.value,
      values,
      extra,
    );
    if (success) {
      isOpen.value = false;
      emit("success");
    } else {
      formError.value = admin.error ? t(admin.error) : t("admin.failed");
    }
  }
}

function handleClose() {
  isOpen.value = false;
}
</script>

<template>
  <AppModal
    v-model:open="isOpen"
    :title="modalTitle"
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <div class="space-y-4">
      <!-- Entity context badge when editing -->
      <div
        v-if="mode === 'edit' && initialData?.id"
        class="flex flex-wrap items-center gap-2 rounded-lg border border-default p-2.5 bg-muted/15 text-xs text-muted"
      >
        <span class="font-medium">{{ t("admin.modal.entityId") }}:</span>
        <span class="font-mono">{{ initialData.id }}</span>
        <UBadge
          v-if="initialData.code"
          color="neutral"
          variant="subtle"
          size="xs"
        >
          {{ initialData.code }}
        </UBadge>
      </div>

      <!-- Secret notification after API key creation -->
      <div
        v-if="createdSecret"
        class="space-y-3 rounded-lg border border-warning-500/30 bg-warning-500/10 p-4"
      >
        <div
          class="flex items-center gap-2 text-warning-500 font-semibold text-sm"
        >
          <UIcon name="i-lucide-key" class="w-5 h-5" />
          <span>{{ t("admin.modal.keySecretNotice") }}</span>
        </div>
        <AppCopyValue :value="createdSecret" />
        <div class="flex justify-end pt-2">
          <UButton color="primary" size="sm" @click="isOpen = false">
            {{ t("common.close") }}
          </UButton>
        </div>
      </div>

      <!-- Form for editing / creating -->
      <form v-else class="space-y-4" @submit.prevent="onSubmit">
        <UAlert
          v-if="formError"
          color="error"
          variant="subtle"
          :title="formError"
          icon="i-lucide-alert-circle"
        />

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

          <!-- 1. Select Control -->
          <template v-if="getFieldConfig(action, field).control === 'select'">
            <div
              v-if="action === 'route' && field === 'model'"
              class="space-y-2 w-full"
            >
              <UInput
                v-model="values[field]"
                placeholder="gpt-4o, claude-3-5-sonnet, ..."
                class="w-full font-mono text-xs"
              />
              <div
                v-if="getSelectOptions(field).length > 0"
                class="flex flex-wrap items-center gap-1.5 pt-0.5"
              >
                <span class="text-xs text-muted">
                  {{ t("admin.popularModels") }}:
                </span>
                <button
                  v-for="opt in getSelectOptions(field)"
                  :key="opt.value"
                  type="button"
                  class="text-xs px-2 py-0.5 rounded-full border border-default bg-muted/20 hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-colors font-mono cursor-pointer"
                  @click="values[field] = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
            <div v-else-if="getSelectOptions(field).length > 0" class="w-full">
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

          <!-- 2. Multiselect Control -->
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
                    @update:model-value="
                      toggleMultiselectValue(field, opt.value)
                    "
                  />
                  <span class="text-xs font-medium">{{ opt.label }}</span>
                </label>
              </div>
            </div>
          </template>

          <!-- 3. Number Control -->
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

          <!-- 4. Datetime Control -->
          <template
            v-else-if="getFieldConfig(action, field).control === 'datetime'"
          >
            <AppDateTimeInput
              v-model="values[field]"
              :placeholder="t(`admin.fields.${field}`)"
              required
            />
          </template>

          <!-- 5. JSON Control -->
          <template
            v-else-if="getFieldConfig(action, field).control === 'json'"
          >
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

        <div class="flex items-center justify-end gap-3 pt-4">
          <UButton color="neutral" variant="ghost" @click="handleClose">
            {{ t("common.cancel") }}
          </UButton>
          <UButton type="submit" color="primary" :loading="admin.busy">
            {{ mode === "create" ? t("common.create") : t("common.save") }}
          </UButton>
        </div>
      </form>
    </div>
  </AppModal>
</template>
