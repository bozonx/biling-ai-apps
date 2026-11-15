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
  const restoreError = ref<unknown>(null);
  const generation = ref(0);
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
    pending ??= Promise.resolve().then(async () => {
      const version = generation.value;
      restoreError.value = null;
      method.value = readMethod();
      try {
        const result = method.value ? await fetchAccount() : null;
        if (version === generation.value) account.value = result;
      } catch (cause) {
        if (version !== generation.value) return null;
        account.value = null;
        const error = toApiError(cause);
        if ([401, 403, 404].includes(error.status ?? 0)) {
          method.value = null;
          writeMethod(null);
        } else {
          restoreError.value = error;
        }
      } finally {
        resolved.value = true;
        pending = null;
      }
      return account.value;
    });
    return pending;
  }

  async function signInDev() {
    account.value = await fetchAccount();
    method.value = "dev";
    resolved.value = true;
    writeMethod("dev");
  }

  async function signOut() {
    generation.value++;
    restoreError.value = null;
    account.value = null;
    method.value = null;
    writeMethod(null);
    useWalletStore().$reset();
    await navigateTo("/login");
  }

  return {
    account,
    method,
    resolved,
    restoreError,
    generation,
    isSignedIn,
    resolve,
    signInDev,
    signOut,
  };
});
