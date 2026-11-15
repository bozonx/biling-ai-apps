import { defineStore } from "pinia";
import {
  operationsSchema,
  walletSchema,
  type Operation,
  type Wallet,
} from "@billing/contracts";

/** Wallet balance and operation history of the signed-in account. */
export const useWalletStore = defineStore("wallet", {
  state: () => ({
    wallet: null as Wallet | null,
    walletLoading: false,
    walletError: null as unknown,
    operations: [] as Operation[],
    operationsLoading: false,
    operationsError: null as unknown,
    operationsLoaded: false,
  }),
  getters: {
    available: (state) =>
      state.wallet
        ? availableMilli(state.wallet.balanceMilli, state.wallet.heldMilli)
        : null,
    recentOperations: (state) => state.operations.slice(0, 5),
  },
  actions: {
    async fetchWallet() {
      const auth = useAuthStore();
      const version = auth.generation;
      this.walletLoading = true;
      this.walletError = null;
      try {
        const result = await useApi().get("/me/wallet", walletSchema);
        if (version !== auth.generation) return;
        this.wallet = result;
      } catch (error) {
        if (version !== auth.generation) return;
        this.walletError = error;
      } finally {
        if (version === auth.generation) this.walletLoading = false;
      }
    },
    async fetchOperations() {
      const auth = useAuthStore();
      const version = auth.generation;
      this.operationsLoading = true;
      this.operationsError = null;
      try {
        const result = await useApi().get("/me/operations", operationsSchema);
        if (version !== auth.generation) return;
        this.operations = result;
        this.operationsLoaded = true;
      } catch (error) {
        if (version !== auth.generation) return;
        this.operationsError = error;
      } finally {
        if (version === auth.generation) this.operationsLoading = false;
      }
    },
    refresh() {
      return Promise.all([this.fetchWallet(), this.fetchOperations()]);
    },
  },
});
