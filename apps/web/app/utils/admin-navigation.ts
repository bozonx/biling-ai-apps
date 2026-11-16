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
    ],
  },
  {
    labelKey: "admin.nav.groups.operations",
    icon: "i-lucide-wrench",
    items: [
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
];

export function findAdminNavItem(path: string): {
  group: AdminNavGroup;
  item: AdminNavItem;
} | null {
  if (path === "/admin/settings" || path.startsWith("/admin/settings/")) {
    return {
      group: {
        labelKey: "admin.nav.groups.system",
        icon: "i-lucide-settings",
        items: [],
      },
      item: {
        labelKey: "admin.nav.settings",
        to: "/admin/settings",
        icon: "i-lucide-settings",
      },
    };
  }

  // Scoped subpages map to Products group item
  if (
    path.startsWith("/admin/pricing") ||
    path.startsWith("/admin/margins") ||
    path.startsWith("/admin/keys")
  ) {
    const catalogGroup = ADMIN_NAVIGATION.find(
      (g) => g.labelKey === "admin.nav.groups.catalog",
    );
    const productsItem = catalogGroup?.items.find(
      (i) => i.to === "/admin/products",
    );
    if (catalogGroup && productsItem) {
      return { group: catalogGroup, item: productsItem };
    }
  }

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
  if (targetPath === "/admin/products") {
    return (
      currentPath === "/admin/products" ||
      currentPath.startsWith("/admin/products/") ||
      currentPath.startsWith("/admin/pricing") ||
      currentPath.startsWith("/admin/margins") ||
      currentPath.startsWith("/admin/keys")
    );
  }
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}
