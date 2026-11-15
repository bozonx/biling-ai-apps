<script setup lang="ts">
/**
 * Icon button that reveals an explanation on hover or touch toggle.
 * Modeled after Blogger Dog's CommonInfoTooltip component.
 */
type Placement =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-start"
  | "top-end"
  | "bottom-start"
  | "bottom-end";

interface Props {
  /** Explanation to reveal. Multi-line and long text are both supported. */
  text?: string;
  placement?: Placement;
  /** Widen the panel for text that needs extra space. */
  wide?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  text: undefined,
  placement: "top",
  wide: false,
});

const { t } = useI18n();

const content = computed(() => {
  const [side, align = "center"] = props.placement.split("-") as [
    "top" | "bottom" | "left" | "right",
    ("start" | "end" | "center") | undefined,
  ];

  return { side, align, sideOffset: 6, collisionPadding: 12 };
});
</script>

<template>
  <UPopover
    mode="hover"
    enable-touch
    :open-delay="120"
    :close-delay="120"
    :content="content"
    class="inline-flex align-middle"
  >
    <button
      type="button"
      :aria-label="t('common.moreInfo')"
      class="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-dimmed transition-colors hover:text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-help"
      @mousedown.stop
      @click.stop.prevent
    >
      <UIcon name="i-lucide-info" class="size-3.5" />
    </button>

    <template #content>
      <div
        class="p-2.5 text-xs/5 whitespace-pre-line text-default"
        :class="wide ? 'max-w-sm' : 'max-w-72'"
      >
        <slot>{{ text }}</slot>
      </div>
    </template>
  </UPopover>
</template>
