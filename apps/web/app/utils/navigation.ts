export interface NavItem {
  /** i18n key of the label. */
  label: string;
  icon: string;
  to: string;
}

export const MAIN_NAVIGATION: NavItem[] = [
  { label: "nav.dashboard", icon: "i-lucide-layout-dashboard", to: "/" },
  { label: "nav.operations", icon: "i-lucide-list", to: "/operations" },
];

export const FOOTER_NAVIGATION: NavItem[] = [
  { label: "nav.settings", icon: "i-lucide-settings", to: "/settings" },
];

export const SETTINGS_NAVIGATION: NavItem[] = [
  {
    label: "settings.appearance.title",
    icon: "i-lucide-palette",
    to: "/settings/appearance",
  },
  {
    label: "settings.account.title",
    icon: "i-lucide-user",
    to: "/settings/account",
  },
];

export function isNavActive(path: string, to: string): boolean {
  return to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`);
}
