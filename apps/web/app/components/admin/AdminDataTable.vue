<script setup lang="ts">
import {
  adminSectionColumns,
  adminEditFieldDefinitions,
  sectionToActionMap,
  formatAdminCell,
} from "~/utils/admin-definitions";

const props = withDefaults(
  defineProps<{
    section: string;
    rows?: unknown[];
    columns?: string[];
    title?: string;
    createAction?: string;
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
  }>(),
  {
    rows: undefined,
    columns: undefined,
    title: undefined,
    createAction: undefined,
    canCreate: undefined,
    canEdit: undefined,
    canDelete: undefined,
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

const effectiveAction = computed(() => {
  return props.createAction ?? sectionToActionMap[props.section];
});

const hasCreate = computed(() => {
  if (props.canCreate !== undefined) return props.canCreate;
  return Boolean(effectiveAction.value);
});

const hasEdit = computed(() => {
  if (props.canEdit !== undefined) return props.canEdit;
  return Boolean(
    effectiveAction.value && adminEditFieldDefinitions[effectiveAction.value],
  );
});

const hasDelete = computed(() => {
  if (props.canDelete !== undefined) return props.canDelete;
  return Boolean(effectiveAction.value);
});

const hasRowActions = computed(() => hasEdit.value || hasDelete.value);

// Modal states
const isEntityModalOpen = ref(false);
const modalMode = ref<"create" | "edit">("create");
const selectedRow = ref<Record<string, any>>({});

const isDeleteConfirmOpen = ref(false);
const rowToDelete = ref<Record<string, any> | null>(null);

function openCreateModal() {
  selectedRow.value = {};
  modalMode.value = "create";
  isEntityModalOpen.value = true;
}

function openEditModal(row: unknown) {
  selectedRow.value = (row as Record<string, any>) ?? {};
  modalMode.value = "edit";
  isEntityModalOpen.value = true;
}

function openDeleteConfirm(row: unknown) {
  rowToDelete.value = (row as Record<string, any>) ?? null;
  isDeleteConfirmOpen.value = true;
}

async function confirmDelete() {
  if (!rowToDelete.value || !effectiveAction.value) return;

  const row = rowToDelete.value;
  let success = false;

  if (props.section === "productRoutes") {
    success = await admin.deleteEntity("productRoute", undefined, {
      productId: row.productId,
      routeId: row.routeId,
    });
  } else {
    success = await admin.deleteEntity(effectiveAction.value, row.id);
  }

  if (success) {
    isDeleteConfirmOpen.value = false;
    rowToDelete.value = null;
  }
}
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
        <div class="flex items-center gap-2">
          <slot name="actions" />
          <UButton
            v-if="hasCreate"
            color="primary"
            size="xs"
            icon="i-lucide-plus"
            @click="openCreateModal"
          >
            {{ t("common.create") }}
          </UButton>
        </div>
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
            <th
              v-if="hasRowActions"
              class="px-4 py-3 text-right whitespace-nowrap"
            >
              {{ t("admin.actionsColumn") }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-if="effectiveRows.length === 0">
            <td
              :colspan="effectiveColumns.length + (hasRowActions ? 1 : 0)"
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

            <!-- Row actions -->
            <td
              v-if="hasRowActions"
              class="px-4 py-2 text-right whitespace-nowrap"
            >
              <div class="flex items-center justify-end gap-1">
                <UButton
                  v-if="hasEdit"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-pencil"
                  :title="t('common.edit')"
                  @click="openEditModal(row)"
                />
                <UButton
                  v-if="hasDelete"
                  color="error"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-trash-2"
                  :title="t('common.delete')"
                  @click="openDeleteConfirm(row)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>

  <!-- Create / Edit Entity Modal -->
  <AdminEntityModal
    v-if="effectiveAction"
    v-model:open="isEntityModalOpen"
    :action="effectiveAction"
    :mode="modalMode"
    :initial-data="selectedRow"
  />

  <!-- Delete Confirmation Modal -->
  <AppConfirmModal
    v-model:open="isDeleteConfirmOpen"
    :title="t('admin.deleteConfirmTitle')"
    :description="t('admin.deleteConfirmDesc')"
    color="error"
    icon="i-lucide-triangle-alert"
    :confirm-text="t('common.delete')"
    :loading="admin.busy"
    @confirm="confirmDelete"
  />
</template>
