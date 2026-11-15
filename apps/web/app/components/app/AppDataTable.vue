<script setup lang="ts" generic="Row extends { id?: string }">
export interface AppTableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  class?: string;
}

/**
 * Plain table with loading and empty states. Pages pass rows and columns and
 * override cells through `#cell-<key>` slots.
 */
withDefaults(
  defineProps<{
    columns: AppTableColumn[];
    rows: Row[];
    loading?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
  }>(),
  { loading: false, emptyTitle: undefined, emptyDescription: undefined },
);

const cellValue = (row: Row, key: string) => {
  const value = (row as Record<string, unknown>)[key];
  return value === null || value === undefined || value === ""
    ? "—"
    : String(value);
};

const cellClass = (column: AppTableColumn) =>
  [
    column.class,
    column.align === "right" ? "text-right tabular-nums" : "",
  ].join(" ");
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="text-left text-xs text-muted">
        <tr class="border-b border-default">
          <th
            v-for="column in columns"
            :key="column.key"
            class="px-4 py-2.5 font-medium whitespace-nowrap"
            :class="cellClass(column)"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-if="loading && rows.length === 0">
          <tr
            v-for="n in 5"
            :key="n"
            class="border-b border-default last:border-0"
          >
            <td v-for="column in columns" :key="column.key" class="px-4 py-3">
              <USkeleton class="h-4 w-full max-w-32" />
            </td>
          </tr>
        </template>
        <tr v-else-if="rows.length === 0">
          <td :colspan="columns.length">
            <AppEmptyState
              :title="emptyTitle"
              :description="emptyDescription"
            />
          </td>
        </tr>
        <tr
          v-for="(row, index) in rows"
          v-else
          :key="row.id ?? index"
          class="border-b border-default last:border-0 hover:bg-elevated/50"
        >
          <td
            v-for="column in columns"
            :key="column.key"
            class="px-4 py-2.5 whitespace-nowrap"
            :class="cellClass(column)"
          >
            <slot :name="`cell-${column.key}`" :row="row" :index="index">
              {{ cellValue(row, column.key) }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
