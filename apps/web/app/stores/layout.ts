import { defineStore } from "pinia";

const COLLAPSED_KEY = "billing.sidebarCollapsed";

/** Shell state: the mobile drawer and the collapsed desktop sidebar. */
export const useLayoutStore = defineStore("layout", () => {
  const mobileOpen = ref(false);
  const collapsed = ref(false);
  try {
    collapsed.value = localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    // Remembering the sidebar is a convenience only.
  }

  watch(collapsed, (value) => {
    try {
      localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
    } catch {
      // ignore
    }
  });

  return {
    mobileOpen,
    collapsed,
    toggleCollapsed: () => (collapsed.value = !collapsed.value),
    closeMobile: () => (mobileOpen.value = false),
  };
});
