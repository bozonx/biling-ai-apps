<script setup lang="ts">
import type { ModalProps } from "@nuxt/ui";

/**
 * Unified Modal Component
 *
 * Adapted from bloggerdog app/components/AppModal.vue
 * Provides a consistent layout with header, body, and footer across the application.
 * Wraps @nuxt/ui's UModal and provides standard padding and styling.
 */

interface Props {
  /** Title of the modal */
  title?: string;
  /** Optional description text below the title */
  description?: string;
  /** Whether to show the close button in the top right corner */
  closeButton?: boolean;
  /** Whether to prevent closing when clicking outside or pressing ESC */
  preventClose?: boolean;
  /** Nuxt UI modal configuration */
  ui?: ModalProps["ui"];
}

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
  description: undefined,
  closeButton: true,
  preventClose: false,
  ui: () => ({}),
});

const emit = defineEmits<{
  (e: "close:prevent"): void;
}>();

const isOpen = defineModel<boolean>("open", { default: false });
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :dismissible="!props.preventClose"
    :close="props.closeButton"
    :title="props.title"
    :description="props.description"
    :ui="props.ui"
    @close:prevent="emit('close:prevent')"
  >
    <!-- Custom title slot if provided -->
    <template v-if="$slots.title" #title="slotProps">
      <slot name="title" v-bind="slotProps" />
    </template>

    <!-- Custom description slot if provided -->
    <template v-if="$slots.description" #description="slotProps">
      <slot name="description" v-bind="slotProps" />
    </template>

    <!-- Custom header slot if provided -->
    <template v-if="$slots.header" #header="slotProps">
      <slot name="header" v-bind="slotProps" />
    </template>

    <!-- Custom actions slot if provided -->
    <template v-if="$slots.actions" #actions="slotProps">
      <slot name="actions" v-bind="slotProps" />
    </template>

    <!-- Custom close slot if provided -->
    <template v-if="$slots.close" #close="slotProps">
      <slot name="close" v-bind="slotProps" />
    </template>

    <!-- Body content -->
    <template #body="slotProps">
      <slot v-bind="slotProps" />
    </template>

    <!-- Footer content -->
    <template v-if="$slots.footer" #footer="slotProps">
      <slot name="footer" v-bind="slotProps" />
    </template>
  </UModal>
</template>
