export interface AdminNavItem {
  labelKey: string;
  to: string;
  icon: string;
  sectionKey?: string;
}

export interface AdminNavGroup {
  labelKey: string;
  icon: string;
  items: AdminNavItem[];
}

export const ADMIN_NAVIGATION: AdminNavGroup[] = [
  {
    labelKey: "admin.nav.groups.catalog",
    icon: "i-lucide-folder",
    items: [
      {
        labelKey: "admin.nav.overview",
        to: "/admin",
        icon: "i-lucide-layout-dashboard",
      },
      {
        labelKey: "admin.nav.products",
        to: "/admin/products",
        icon: "i-lucide-package",
        sectionKey: "products",
      },
      {
        labelKey: "admin.nav.plans",
        to: "/admin/plans",
        icon: "i-lucide-layers",
        sectionKey: "plans",
      },
      {
        labelKey: "admin.nav.pricing",
        to: "/admin/pricing",
        icon: "i-lucide-tag",
        sectionKey: "features",
      },
    ],
  },
  {
    labelKey: "admin.nav.groups.ai",
    icon: "i-lucide-cpu",
    items: [
      {
        labelKey: "admin.nav.routes",
        to: "/admin/routes",
        icon: "i-lucide-git-branch",
        sectionKey: "routes",
      },
      {
        labelKey: "admin.nav.margins",
        to: "/admin/margins",
        icon: "i-lucide-trending-up",
        sectionKey: "margin",
      },
    ],
  },
  {
    labelKey: "admin.nav.groups.operations",
    icon: "i-lucide-wrench",
    items: [
      {
        labelKey: "admin.nav.keys",
        to: "/admin/keys",
        icon: "i-lucide-key",
        sectionKey: "keys",
      },
      {
        labelKey: "admin.nav.tasks",
        to: "/admin/tasks",
        icon: "i-lucide-check-square",
        sectionKey: "tasks",
      },
      {
        labelKey: "admin.nav.actions",
        to: "/admin/actions",
        icon: "i-lucide-play-circle",
      },
    ],
  },
  {
    labelKey: "admin.nav.groups.system",
    icon: "i-lucide-settings",
    items: [
      {
        labelKey: "admin.nav.settings",
        to: "/admin/settings",
        icon: "i-lucide-settings",
      },
    ],
  },
];

export function findAdminNavItem(path: string): {
  group: AdminNavGroup;
  item: AdminNavItem;
} | null {
  for (const group of ADMIN_NAVIGATION) {
    for (const item of group.items) {
      if (item.to === "/admin" ? path === "/admin" : path.startsWith(item.to)) {
        return { group, item };
      }
    }
  }
  return null;
}

export function isAdminNavActive(
  currentPath: string,
  targetPath: string,
): boolean {
  if (targetPath === "/admin") {
    return currentPath === "/admin" || currentPath === "/admin/";
  }
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}
