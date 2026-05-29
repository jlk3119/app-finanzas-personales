"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { Account, Expense, Category } from "@/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pencil, Trash2 } from "lucide-react";

type Props = {
  expenses: Expense[];
  categories: Category[];
  accounts: Account[];
  onRefresh: () => void;
  onEdit?: (expense: Expense) => void;
  compact?: boolean;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

function groupByDate(expenses: Expense[]) {
  const groups: Record<string, Expense[]> = {};
  for (const e of expenses) {
    if (!groups[e.date]) groups[e.date] = [];
    groups[e.date].push(e);
  }
  return groups;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const toLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (dateStr === toLocal(today)) return "Hoy";
  if (dateStr === toLocal(yesterday)) return "Ayer";
  return d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
}

export default function ExpenseList({ expenses, categories, accounts, onRefresh, onEdit, compact }: Props) {
  const supabase = createClient();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmExpense = confirmId ? expenses.find((e) => e.id === confirmId) : null;

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const expense = expenses.find((e) => e.id === id);
    await supabase.from("expenses").delete().eq("id", id);
    if (expense?.account_id) {
      const acc = accounts.find((a) => a.id === expense.account_id);
      if (acc) {
        await supabase.from("accounts").update({
          balance: Number(acc.balance) + Number(expense.amount),
        }).eq("id", acc.id);
      }
    }
    onRefresh();
    setDeleting(null);
  };

  if (expenses.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Sin gastos registrados aún.</p>;
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {expenses.map((e) => {
          const cat = categories.find((c) => c.id === e.category_id);
          return (
            <div key={e.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{cat?.icon ?? "📦"}</span>
                <div>
                  <p className="text-sm font-medium leading-tight">{e.description || cat?.name || "Gasto"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(e.date)}</p>
                </div>
              </div>
              <span className="text-sm font-semibold">{fmt(Number(e.amount))}</span>
            </div>
          );
        })}
      </div>
    );
  }

  const grouped = groupByDate(expenses);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{formatDate(date)}</p>
            <p className="text-xs text-muted-foreground">{fmt(items.reduce((s, e) => s + Number(e.amount), 0))}</p>
          </div>
          <div className="space-y-2">
            {items.map((e) => {
              const cat = categories.find((c) => c.id === e.category_id);
              const parentCat = cat?.parent_id ? categories.find((c) => c.id === cat.parent_id) : null;
              const catLabel = parentCat ? `${parentCat.name} › ${cat?.name}` : cat?.name;
              return (
                <div key={e.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-base" style={{ backgroundColor: (parentCat?.color ?? cat?.color) + "22" }}>
                      {cat?.icon ?? "📦"}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium leading-tight">{e.description || cat?.name || "Gasto"}</p>
                        {e.budget_period && e.budget_period !== e.date.slice(0, 7) && (
                          <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                            → {new Date(e.budget_period + "-01T12:00:00").toLocaleDateString("es-CO", { month: "short" })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{catLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold mr-1">{fmt(Number(e.amount))}</span>
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 text-muted-foreground hover:text-violet-600"
                        aria-label="Editar"
                        onClick={() => onEdit(e)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-muted-foreground hover:text-red-500"
                      aria-label="Eliminar"
                      onClick={() => setConfirmId(e.id)}
                      disabled={deleting === e.id}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => !open && setConfirmId(null)}
        title="¿Eliminar este gasto?"
        description={confirmExpense ? `${confirmExpense.description || "Gasto"} · ${fmt(Number(confirmExpense.amount))}. Esta acción no se puede deshacer.` : "Esta acción no se puede deshacer."}
        loading={deleting === confirmId}
        onConfirm={async () => { if (confirmId) await handleDelete(confirmId); }}
      />
    </div>
  );
}
