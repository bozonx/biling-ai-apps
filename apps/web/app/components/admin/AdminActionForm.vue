<script setup lang="ts">
import { adminActionDefinitions } from "~/utils/admin-definitions";

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

const options = computed(() =>
  availableActionKeys.value.map((value) => ({
    value,
    label: t(`admin.actions.${value}`),
  })),
);

const fields = computed(() => adminActionDefinitions[action.value] ?? []);
const values = reactive<Record<string, string>>({});

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
      <UFormField
        v-if="availableActionKeys.length > 1"
        :label="t('admin.action')"
      >
        <template #label>
          <span class="inline-flex items-center gap-1.5">
            <span>{{ t("admin.action") }}</span>
            <CommonInfoTooltip
              :text="t('admin.fieldHints.actionSelect')"
              wide
            />
          </span>
        </template>
        <USelect v-model="action" :items="options" class="w-full" />
      </UFormField>

      <UFormField
        v-for="field in fields"
        :key="field"
        :label="t(`admin.fields.${field}`)"
      >
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
        <UTextarea
          v-if="
            [
              'creditGrants',
              'entitlements',
              'items',
              'limits',
              'tiers',
            ].includes(field)
          "
          v-model="values[field]"
          class="w-full font-mono text-xs"
          :rows="3"
        />
        <UInput v-else v-model="values[field]" class="w-full" required />
      </UFormField>

      <div class="flex items-center gap-3 pt-2">
        <UButton type="submit" :loading="admin.busy">
          {{ t("admin.save") }}
        </UButton>
      </div>
    </form>
  </UCard>
</template>
