"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

type Variant = "success" | "error" | "info";
type Snack = { id: number; message: string; variant: Variant };

type ShowSnackbar = (message: string, variant?: Variant) => void;

const SnackbarContext = createContext<ShowSnackbar>(() => {});

const ICONS: Record<Variant, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [snack, setSnack] = useState<Snack | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();

  const show = useCallback<ShowSnackbar>((message, variant = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setSnack({ id: Date.now(), message, variant });
    timer.current = setTimeout(() => setSnack(null), variant === "error" ? 6000 : 4000);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const Icon = snack ? ICONS[snack.variant] : Info;

  return (
    <SnackbarContext.Provider value={show}>
      {children}
      <div className="fixed inset-x-0 bottom-24 lg:bottom-6 z-[60] flex justify-center px-4 pointer-events-none">
        <AnimatePresence>
          {snack && (
            <motion.div
              key={snack.id}
              role="status"
              aria-live={snack.variant === "error" ? "assertive" : "polite"}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              className={`pointer-events-auto flex items-center gap-2.5 max-w-sm w-full rounded-2xl px-4 py-3 shadow-e3 text-sm font-medium ${
                snack.variant === "error"
                  ? "bg-error-container text-on-error-container"
                  : "bg-on-surface text-surface"
              }`}
              onClick={() => setSnack(null)}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${
                  snack.variant === "success" ? "text-success" : snack.variant === "error" ? "text-error" : ""
                }`}
              />
              <span className="min-w-0">{snack.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): ShowSnackbar {
  return useContext(SnackbarContext);
}
