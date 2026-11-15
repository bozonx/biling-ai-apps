<script setup lang="ts">
import CommonInfoTooltip from "~/components/common/CommonInfoTooltip.vue";

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
  text?: string;
  placement?: Placement;
  wide?: boolean;
}

defineProps<Props>();
</script>

<template>
  <CommonInfoTooltip :text="text" :placement="placement" :wide="wide">
    <slot />
  </CommonInfoTooltip>
</template>
