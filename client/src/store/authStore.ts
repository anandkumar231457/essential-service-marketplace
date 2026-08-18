import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setAccessToken: (token: string) => void;
  updateUser: (partialUser: Partial<AuthUser>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      updateUser: (partialUser) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partialUser } : null,
        })),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'auth-storage' },
  ),
);