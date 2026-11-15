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
      this.walletLoading = true;
      this.walletError = null;
      try {
        this.wallet = await useApi().get("/me/wallet", walletSchema);
      } catch (error) {
        this.walletError = error;
      } finally {
        this.walletLoading = false;
      }
    },
    async fetchOperations() {
      this.operationsLoading = true;
      this.operationsError = null;
      try {
        this.operations = await useApi().get(
          "/me/operations",
          operationsSchema,
        );
        this.operationsLoaded = true;
      } catch (error) {
        this.operationsError = error;
      } finally {
        this.operationsLoading = false;
      }
    },
    refresh() {
      return Promise.all([this.fetchWallet(), this.fetchOperations()]);
    },
  },
});
