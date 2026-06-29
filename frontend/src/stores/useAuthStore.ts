import { create } from 'zustand';

interface AuthState {
  adminApiKey: string | null;
  setApiKey: (key: string) => void;
  logout: () => void;
}

const STORAGE_KEY = 'uptime_admin_token';

// Helper to set session cookie for SSE stream authentication
const setSessionCookie = (key: string | null) => {
  if (key) {
    document.cookie = `session=${key}; path=/; SameSite=Strict; Secure;`;
  } else {
    document.cookie = `session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Strict; Secure;`;
  }
};

export const useAuthStore = create<AuthState>((set) => {
  // Read initial key from localStorage on store startup
  const initialKey = localStorage.getItem(STORAGE_KEY);
  if (initialKey) {
    setSessionCookie(initialKey);
  }

  return {
    adminApiKey: initialKey,
    setApiKey: (key: string) => {
      localStorage.setItem(STORAGE_KEY, key);
      setSessionCookie(key);
      set({ adminApiKey: key });
    },
    logout: () => {
      localStorage.removeItem(STORAGE_KEY);
      setSessionCookie(null);
      set({ adminApiKey: null });
    },
  };
});
