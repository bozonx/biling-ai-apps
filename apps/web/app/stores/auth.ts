import { defineStore } from "pinia";
import { accountContextSchema, type AccountContext } from "@billing/contracts";

export type SignInMethod = "dev";

const METHOD_KEY = "billing.signInMethod";

function readMethod(): SignInMethod | null {
  try {
    return localStorage.getItem(METHOD_KEY) === "dev" ? "dev" : null;
  } catch {
    return null;
  }
}

function writeMethod(method: SignInMethod | null) {
  try {
    if (method) localStorage.setItem(METHOD_KEY, method);
    else localStorage.removeItem(METHOD_KEY);
  } catch {
    // Storage may be unavailable (private mode); the session then lasts one tab.
  }
}

/**
 * Who is signed in. Until OIDC exists the only method is the developer
 * account, which the API exposes as GET /me when DEV_ACCOUNT_ENABLED=true.
 */
export const useAuthStore = defineStore("auth", () => {
  const account = ref<AccountContext | null>(null);
  const method = ref<SignInMethod | null>(null);
  const resolved = ref(false);
  let pending: Promise<AccountContext | null> | null = null;

  const isSignedIn = computed(() => account.value !== null);

  async function fetchAccount(): Promise<AccountContext> {
    try {
      return await useApi().get("/me", accountContextSchema);
    } catch (cause) {
      const error = toApiError(cause);
      // 404 means the API has the developer account switched off.
      throw error.status === 404
        ? new ApiError("DEV_LOGIN_UNAVAILABLE", 404)
        : error;
    }
  }

  /** Restores the session once per app load; later calls reuse the answer. */
  function resolve(force = false): Promise<AccountContext | null> {
    if (resolved.value && !force) return Promise.resolve(account.value);
    pending ??= (async () => {
      method.value = readMethod();
      try {
        account.value = method.value ? await fetchAccount() : null;
      } catch {
        account.value = null;
        method.value = null;
        writeMethod(null);
      } finally {
        resolved.value = true;
        pending = null;
      }
      return account.value;
    })();
    return pending;
  }

  async function signInDev() {
    account.value = await fetchAccount();
    method.value = "dev";
    resolved.value = true;
    writeMethod("dev");
  }

  async function signOut() {
    account.value = null;
    method.value = null;
    writeMethod(null);
    useWalletStore().$reset();
    await navigateTo("/login");
  }

  return { account, method, resolved, isSignedIn, resolve, signInDev, signOut };
});
