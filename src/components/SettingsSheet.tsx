"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { usePrivacy } from "@/components/PrivacyProvider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Monitor, Sun, Moon, Tags, LogOut, X, ChevronRight, Eye, EyeOff, Lightbulb } from "lucide-react";

type Props = {
  onClose: () => void;
  onManageCategories: () => void;
  onOpenSuggestions: () => void;
  onSignOut: () => void;
};

const THEME_OPTIONS = [
  { value: "system", label: "Sistema", Icon: Monitor },
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
] as const;

export default function SettingsSheet({ onClose, onManageCategories, onOpenSuggestions, onSignOut }: Props) {
  const { theme, setTheme } = useTheme();
  const { hidden: amountsHidden, toggle: toggleAmounts } = usePrivacy();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  useBackButtonClose(true, onClose);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[90vh] flex flex-col gap-0 p-0 pb-8"
        showCloseButton={false}
      >
        <SheetHeader className="sticky top-0 z-10 bg-surface-container-lowest rounded-t-2xl flex-row items-center justify-between px-4 py-3 border-b mb-0 gap-0">
          <SheetTitle className="text-base">Configuración</SheetTitle>
          <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose} className="h-8 w-8">
            <X className="w-5 h-5" />
          </Button>
        </SheetHeader>

        <div className="overflow-y-auto px-4 py-4 space-y-6">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Apariencia</h3>
            <p className="text-sm text-on-surface">Tema</p>
            <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map(({ value, label, Icon }) => {
                const active = mounted && theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={label}
                    onClick={() => setTheme(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 min-h-[44px] transition-colors ${
                      active
                        ? "border-primary bg-secondary-container text-on-secondary-container"
                        : "border-outline-variant text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-on-surface-variant">
              «Sistema» sigue la configuración de tu dispositivo.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Privacidad</h3>
            <button
              type="button"
              role="switch"
              aria-checked={amountsHidden}
              aria-label="Ocultar montos"
              onClick={toggleAmounts}
              className="w-full flex items-center justify-between rounded-2xl border border-outline-variant px-4 py-3 min-h-[44px] hover:bg-surface-container transition-colors"
            >
              <span className="flex items-center gap-3">
                {amountsHidden ? <EyeOff className="w-5 h-5 text-on-surface-variant" /> : <Eye className="w-5 h-5 text-on-surface-variant" />}
                <span className="text-left">
                  <span className="block text-sm font-medium text-on-surface">Ocultar montos</span>
                  <span className="block text-xs text-on-surface-variant">Enmascara totales, saldos y gastos</span>
                </span>
              </span>
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  amountsHidden ? "bg-primary" : "bg-outline-variant"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-surface-container-lowest transition-transform ${
                    amountsHidden ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </span>
            </button>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">General</h3>
            <button
              type="button"
              onClick={onManageCategories}
              className="w-full flex items-center justify-between rounded-2xl border border-outline-variant px-4 py-3 min-h-[44px] hover:bg-surface-container transition-colors"
            >
              <span className="flex items-center gap-3">
                <Tags className="w-5 h-5 text-on-surface-variant" />
                <span className="text-sm font-medium text-on-surface">Categorías</span>
              </span>
              <ChevronRight className="w-4 h-4 text-on-surface-variant" />
            </button>
            <button
              type="button"
              onClick={onOpenSuggestions}
              className="w-full flex items-center justify-between rounded-2xl border border-outline-variant px-4 py-3 min-h-[44px] hover:bg-surface-container transition-colors"
            >
              <span className="flex items-center gap-3">
                <Lightbulb className="w-5 h-5 text-on-surface-variant" />
                <span className="text-left">
                  <span className="block text-sm font-medium text-on-surface">Sugerencias</span>
                  <span className="block text-xs text-on-surface-variant">Propón nuevas funcionalidades</span>
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-on-surface-variant" />
            </button>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Cuenta</h3>
            <button
              type="button"
              onClick={onSignOut}
              className="w-full flex items-center gap-3 rounded-2xl border border-outline-variant px-4 py-3 min-h-[44px] text-error hover:bg-error/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">Cerrar sesión</span>
            </button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
