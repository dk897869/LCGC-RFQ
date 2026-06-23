'use client';

import { create } from 'zustand';
import type { User, RFQ, PurchaseOrder, Vendor, Approval, DashboardStats } from './types';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface AppStore {
  // Auth State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setIsAuthenticated: (value: boolean) => void;
  setIsLoading: (value: boolean) => void;

  // Data State
  rfqs: RFQ[];
  pos: PurchaseOrder[];
  vendors: Vendor[];
  approvals: Approval[];
  dashboardStats: DashboardStats | null;

  setRFQs: (rfqs: RFQ[]) => void;
  setPOs: (pos: PurchaseOrder[]) => void;
  setVendors: (vendors: Vendor[]) => void;
  setApprovals: (approvals: Approval[]) => void;
  setDashboardStats: (stats: DashboardStats) => void;

  // Toast State
  toasts: Toast[];
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
  removeToast: (id: string) => void;

  // Filters & Pagination
  selectedRFQFilter: string;
  selectedPOFilter: string;
  currentPage: number;
  setSelectedRFQFilter: (filter: string) => void;
  setSelectedPOFilter: (filter: string) => void;
  setCurrentPage: (page: number) => void;

  // Cleanup
  logout: () => void;
}

export const useStore = create<AppStore>((set) => ({
  // Auth
  user: null,
  isAuthenticated: false,
  isLoading: false,
  setUser: (user) => set({ user }),
  setIsAuthenticated: (value) => set({ isAuthenticated: value }),
  setIsLoading: (value) => set({ isLoading: value }),

  // Data
  rfqs: [],
  pos: [],
  vendors: [],
  approvals: [],
  dashboardStats: null,
  setRFQs: (rfqs) => set({ rfqs }),
  setPOs: (pos) => set({ pos }),
  setVendors: (vendors) => set({ vendors }),
  setApprovals: (approvals) => set({ approvals }),
  setDashboardStats: (stats) => set({ dashboardStats: stats }),

  // Toasts
  toasts: [],
  addToast: (message, type, duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }],
    }));

    if (duration) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  // Filters
  selectedRFQFilter: 'all',
  selectedPOFilter: 'all',
  currentPage: 1,
  setSelectedRFQFilter: (filter) => set({ selectedRFQFilter: filter, currentPage: 1 }),
  setSelectedPOFilter: (filter) => set({ selectedPOFilter: filter, currentPage: 1 }),
  setCurrentPage: (page) => set({ currentPage: page }),

  // Cleanup
  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
      rfqs: [],
      pos: [],
      vendors: [],
      approvals: [],
      dashboardStats: null,
      toasts: [],
    }),
}));
