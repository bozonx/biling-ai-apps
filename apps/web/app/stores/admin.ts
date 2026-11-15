import { defineStore } from "pinia";

const TOKEN_KEY = "billing.adminToken";

function readStoredToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage may be unavailable (e.g. private browsing mode)
  }
}

export const useAdminStore = defineStore("admin", () => {
  const config = useRuntimeConfig();
  const devEnabled = computed(() => config.public.devLoginEnabled === true);

  const initialToken = readStoredToken();
  const token = ref(initialToken);
  const tokenInput = ref(initialToken);
  const busy = ref(false);
  const error = ref("");
  const secret = ref("");
  const catalog = ref<Record<string, unknown[]>>({});
  const resolved = ref(false);

  const isAuthenticated = computed(
    () => Boolean(token.value) && Object.keys(catalog.value).length > 0,
  );

  const pending = { fingerprint: "", key: "" };

  async function request(path: string, body?: Record<string, unknown>) {
    if (body) {
      const fingerprint = JSON.stringify(body);
      if (pending.fingerprint !== fingerprint) {
        pending.fingerprint = fingerprint;
        pending.key = crypto.randomUUID();
      }
    }
    return $fetch<Record<string, unknown>>(`/api/v1/admin/${path}`, {
      method: body ? "POST" : "GET",
      body,
      headers: {
        Authorization: `Bearer ${token.value}`,
        ...(body ? { "Idempotency-Key": pending.key } : {}),
      },
    });
  }

  async function load(): Promise<boolean> {
    if (!token.value) return false;
    busy.value = true;
    error.value = "";
    try {
      const cat = (await request("catalog")) as Record<string, unknown[]>;
      try {
        const rows = await $fetch<
          {
            productId: string;
            routeId: string | null;
            provider: string | null;
            model: string | null;
            _sum: {
              creditsChargedMilli: string | null;
              costNanos: string | null;
            };
            _count: number;
            valueNanos: string | null;
            marginNanos: string | null;
          }[]
        >("/api/v1/admin/margin", {
          headers: { Authorization: `Bearer ${token.value}` },
        });
        cat.margin = rows.map((row) => ({
          ...row,
          creditsChargedMilli: row._sum.creditsChargedMilli ?? "0",
          costNanos: row._sum.costNanos ?? "0",
          requests: row._count,
        }));
      } catch {
        // margin is optional in some configurations or test environments
      }
      catalog.value = cat;
      writeStoredToken(token.value);
      return true;
    } catch {
      error.value = "admin.failed";
      // Clear token on authorization failure
      writeStoredToken(null);
      token.value = "";
      catalog.value = {};
      return false;
    } finally {
      busy.value = false;
      resolved.value = true;
    }
  }

  async function signInWithToken(inputVal?: string) {
    const raw = inputVal !== undefined ? inputVal : tokenInput.value;
    token.value = raw.trim();
    if (!token.value) return false;
    return await load();
  }

  async function signInDev() {
    token.value = "dev-admin";
    tokenInput.value = "dev-admin";
    return await load();
  }

  function disconnect() {
    token.value = "";
    tokenInput.value = "";
    secret.value = "";
    catalog.value = {};
    error.value = "";
    writeStoredToken(null);
  }

  async function executeAction(
    actionName: string,
    fieldNames: string[],
    fieldValues: Record<string, string>,
  ): Promise<boolean> {
    busy.value = true;
    error.value = "";
    secret.value = "";
    try {
      const body: Record<string, unknown> = {};
      for (const field of fieldNames) {
        const val = fieldValues[field] ?? "";
        body[field] = ["version", "creditGrantIntervalCount"].includes(field)
          ? Number(val)
          : ["scopes", "productScope"].includes(field)
            ? val
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
            : [
                  "creditGrants",
                  "entitlements",
                  "items",
                  "limits",
                  "tiers",
                ].includes(field)
              ? JSON.parse(val)
              : val;
      }
      if (actionName !== "credits") body.action = actionName;
      const result = await request(
        actionName === "credits" ? "credits" : "catalog",
        body,
      );
      pending.fingerprint = "";
      secret.value = typeof result.secret === "string" ? result.secret : "";
      await load();
      return true;
    } catch {
      error.value = "admin.failed";
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function resolve(): Promise<void> {
    if (resolved.value) return;
    const stored = readStoredToken();
    if (stored) {
      token.value = stored;
      tokenInput.value = stored;
      await load();
    } else {
      resolved.value = true;
    }
  }

  return {
    token,
    tokenInput,
    busy,
    error,
    secret,
    catalog,
    resolved,
    devEnabled,
    isAuthenticated,
    load,
    signInWithToken,
    signInDev,
    disconnect,
    executeAction,
    resolve,
  };
});
