<script setup lang="ts">
import {
  adminSectionColumns,
  formatAdminCell,
} from "~/utils/admin-definitions";

const props = withDefaults(
  defineProps<{
    section: string;
    rows?: unknown[];
    columns?: string[];
    title?: string;
  }>(),
  {
    rows: undefined,
    columns: undefined,
    title: undefined,
  },
);

const { t } = useI18n();
const admin = useAdminStore();

const effectiveRows = computed(() => {
  if (props.rows !== undefined) return props.rows;
  return admin.catalog[props.section] ?? [];
});

const effectiveColumns = computed(() => {
  if (props.columns !== undefined) return props.columns;
  return adminSectionColumns[props.section] ?? [];
});

const sectionTitle = computed(() => {
  if (props.title) return props.title;
  return t(`admin.sections.${props.section}`);
});
</script>

<template>
  <UCard :ui="{ body: 'p-0 overflow-x-auto' }">
    <template #header>
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <h2 class="font-semibold text-base">
            {{ sectionTitle }}
          </h2>
          <UBadge color="neutral" variant="subtle" size="sm">
            {{ effectiveRows.length }}
          </UBadge>
        </div>
        <slot name="actions" />
      </div>
    </template>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-muted/40 text-muted font-medium text-xs">
          <tr>
            <th
              v-for="col in effectiveColumns"
              :key="col"
              class="px-4 py-3 whitespace-nowrap"
            >
              {{ t(`admin.fields.${col}`) }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-if="effectiveRows.length === 0">
            <td
              :colspan="effectiveColumns.length || 1"
              class="px-4 py-8 text-center text-muted text-sm"
            >
              {{ t("common.noData") }}
            </td>
          </tr>
          <tr
            v-for="(row, idx) in effectiveRows"
            v-else
            :key="idx"
            class="hover:bg-muted/20 transition-colors"
          >
            <td
              v-for="col in effectiveColumns"
              :key="col"
              class="max-w-xs break-words px-4 py-2.5 font-mono text-xs"
            >
              <slot :name="`cell-${col}`" :row="row">
                <template v-if="col === 'isActive'">
                  <UBadge
                    :color="(row as any)[col] ? 'success' : 'neutral'"
                    variant="subtle"
                    size="xs"
                  >
                    {{ (row as any)[col] ? "active" : "inactive" }}
                  </UBadge>
                </template>
                <template v-else-if="col === 'status'">
                  <UBadge
                    :color="
                      (row as any)[col] === 'active' ||
                      (row as any)[col] === 'published'
                        ? 'success'
                        : (row as any)[col] === 'revoked'
                          ? 'error'
                          : 'neutral'
                    "
                    variant="subtle"
                    size="xs"
                  >
                    {{ (row as any)[col] }}
                  </UBadge>
                </template>
                <template
                  v-else-if="
                    [
                      'effectiveFrom',
                      'effectiveTo',
                      'publishedAt',
                      'revokedAt',
                      'createdAt',
                    ].includes(col) && (row as any)[col]
                  "
                >
                  <AppDateTime :value="String((row as any)[col])" />
                </template>
                <template v-else>
                  {{ formatAdminCell(row, col) }}
                </template>
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>
