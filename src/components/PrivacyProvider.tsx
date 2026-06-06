"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { COP_MASK, formatCOP } from "@/utils/currency";

const STORAGE_KEY = "mf-privacy";

type PrivacyContextValue = {
  hidden: boolean;
  toggle: () => void;
  fmt: (n: number) => string;
};

const PrivacyContext = createContext<PrivacyContextValue>({
  hidden: false,
  toggle: () => {},
  fmt: formatCOP,
});

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore: privacy preference simply won't persist
      }
      return next;
    });
  }, []);

  const fmt = useCallback((n: number) => (hidden ? COP_MASK : formatCOP(n)), [hidden]);

  return (
    <PrivacyContext.Provider value={{ hidden, toggle, fmt }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextValue {
  return useContext(PrivacyContext);
}

export function useMoney(): (n: number) => string {
  return usePrivacy().fmt;
}
