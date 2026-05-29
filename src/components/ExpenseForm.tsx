"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { Account, Category, Expense } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X } from "lucide-react";

type Props = {
  categories: Category[];
  accounts: Account[];
  companyId: string;
  editingExpense?: Expense | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function ExpenseForm({ categories, accounts, companyId, editingExpense, onClose, onSaved }: Props) {
  const supabase = createClient();
  const editing = editingExpense != null;

  const [amount, setAmount] = useState(editing ? String(editingExpense.amount) : "");
  const [description, setDescription] = useState(editing ? (editingExpense.description ?? "") : "");
  const [date, setDate] = useState(() => {
    if (editing) return editingExpense.date;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const [budgetPeriod, setBudgetPeriod] = useState(() => {
    if (editing) return editingExpense.budget_period ?? editingExpense.date.slice(0, 7);
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [budgetPeriodManual, setBudgetPeriodManual] = useState(
    editing ? !!(editingExpense.budget_period && editingExpense.budget_period !== editingExpense.date.slice(0, 7)) : false
  );

  // Resolve initial category selection from expense (may be subcategory)
  const initialCatId = (() => {
    if (!editing) return "";
    const cat = categories.find((c) => c.id === editingExpense.category_id);
    return cat?.parent_id ? cat.parent_id : (editingExpense.category_id ?? "");
  })();
  const initialSubCatId = (() => {
    if (!editing) return "";
    const cat = categories.find((c) => c.id === editingExpense.category_id);
    return cat?.parent_id ? (editingExpense.category_id ?? "") : "";
  })();

  const [categoryId, setCategoryId] = useState(initialCatId);
  const [subCategoryId, setSubCategoryId] = useState(initialSubCatId);
  const [accountId, setAccountId] = useState(() => {
    if (editing) return editingExpense.account_id ?? "";
    return accounts.length === 1 ? accounts[0].id : "";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatBudgetMonth = (bp: string) =>
    new Date(bp + "-01T12:00:00").toLocaleDateString("es-CO", { month: "long", year: "numeric" });

  const parentCats = categories.filter((c) => !c.parent_id);
  const childrenOf = (pid: string) => categories.filter((c) => c.parent_id === pid);
  const selectedChildren = categoryId ? childrenOf(categoryId) : [];

  const handleSelectParent = (id: string) => {
    setCategoryId(id === categoryId ? "" : id);
    setSubCategoryId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { setError("Ingresa un monto válido"); return; }
    setLoading(true);
    setError("");

    const finalCategoryId = subCategoryId || categoryId || null;
    const finalAccountId = accountId || null;
    const newAmount = Number(amount);

    if (editing) {
      const { error: err } = await supabase.from("expenses").update({
        amount: newAmount,
        description: description || null,
        category_id: finalCategoryId,
        account_id: finalAccountId,
        date,
        budget_period: budgetPeriod,
      }).eq("id", editingExpense.id);
      if (err) { setError(err.message); setLoading(false); return; }

      // Adjust account balances for the edit
      const oldAccountId = editingExpense.account_id ?? null;
      const oldAmount = Number(editingExpense.amount);

      if (oldAccountId === finalAccountId && finalAccountId !== null) {
        // Same account: apply delta
        const acc = accounts.find((a) => a.id === finalAccountId);
        if (acc) {
          await supabase.from("accounts").update({
            balance: Math.max(0, Number(acc.balance) - newAmount + oldAmount),
          }).eq("id", finalAccountId);
        }
      } else {
        // Restore old account
        if (oldAccountId) {
          const oldAcc = accounts.find((a) => a.id === oldAccountId);
          if (oldAcc) {
            await supabase.from("accounts").update({
              balance: Number(oldAcc.balance) + oldAmount,
            }).eq("id", oldAccountId);
          }
        }
        // Deduct from new account
        if (finalAccountId) {
          const newAcc = accounts.find((a) => a.id === finalAccountId);
          if (newAcc) {
            await supabase.from("accounts").update({
              balance: Math.max(0, Number(newAcc.balance) - newAmount),
            }).eq("id", finalAccountId);
          }
        }
      }
    } else {
      const { error: err } = await supabase.from("expenses").insert({
        amount: newAmount,
        description: description || null,
        category_id: finalCategoryId,
        account_id: finalAccountId,
        date,
        budget_period: budgetPeriod,
        company_id: companyId,
      });
      if (err) { setError(err.message); setLoading(false); return; }

      if (finalAccountId) {
        const acc = accounts.find((a) => a.id === finalAccountId);
        if (acc) {
          await supabase.from("accounts").update({
            balance: Math.max(0, Number(acc.balance) - newAmount),
          }).eq("id", finalAccountId);
        }
      }
    }

    onSaved();
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] flex flex-col gap-0 p-0 pb-8" showCloseButton={false}>
        <SheetHeader className="sticky top-0 z-10 bg-white rounded-t-2xl flex-row items-center justify-between px-4 py-3 border-b mb-0 gap-0">
          <SheetTitle className="text-base">{editing ? "Editar gasto" : "Nuevo gasto"}</SheetTitle>
          <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </SheetHeader>

        <div className="overflow-y-auto flex-1 px-4 pt-4">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Monto */}
            <div className="space-y-1">
              <Label htmlFor="amount">Monto *</Label>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-2xl h-14 font-semibold"
                autoFocus
              />
            </div>

            {/* Cuenta */}
            {accounts.length > 0 && (
              <div className="space-y-2">
                <Label>Cuenta <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
                <div className="flex flex-wrap gap-2">
                  {accounts.map((acc) => {
                    const isSelected = accountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setAccountId(isSelected ? "" : acc.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-medium"
                            : "border-gray-200 bg-white text-gray-700"
                        }`}
                      >
                        <span>{acc.icon}</span>
                        <span>{acc.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Categoría — grid de chips */}
            <div className="space-y-2">
              <Label>Categoría</Label>
              <div className="grid grid-cols-4 gap-2">
                {parentCats.map((cat) => {
                  const isSelected = categoryId === cat.id;
                  const hasSubs = childrenOf(cat.id).length > 0;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectParent(cat.id)}
                      className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border transition-all text-center ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 bg-white active:bg-gray-50"
                      }`}
                    >
                      <span className="text-2xl">{cat.icon}</span>
                      <span className={`text-[9px] leading-tight font-medium line-clamp-2 ${isSelected ? "text-emerald-700" : "text-gray-600"}`}>
                        {cat.name}{hasSubs ? " ›" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subcategoría */}
            {selectedChildren.length > 0 && (
              <div className="space-y-2">
                <Label>
                  Subcategoría{" "}
                  <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {selectedChildren.map((sub) => {
                    const isSelected = subCategoryId === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSubCategoryId(isSelected ? "" : sub.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm transition-all ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-medium"
                            : "border-gray-200 bg-white text-gray-700"
                        }`}
                      >
                        {sub.icon} {sub.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Descripción */}
            <div className="space-y-1">
              <Label htmlFor="description">Descripción <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <Input
                id="description"
                placeholder="¿En qué gastaste?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Fecha */}
            <div className="space-y-1">
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setDate(newDate);
                  if (!budgetPeriodManual && newDate.length >= 7) setBudgetPeriod(newDate.slice(0, 7));
                }}
              />
            </div>

            {/* Mes de presupuesto */}
            <div className="space-y-1">
              <Label htmlFor="budget-period">Mes de presupuesto</Label>
              <Input
                id="budget-period"
                type="month"
                value={budgetPeriod}
                onChange={(e) => { setBudgetPeriod(e.target.value); setBudgetPeriodManual(true); }}
                className={budgetPeriod !== date.slice(0, 7) ? "border-amber-400 bg-amber-50" : ""}
              />
              {budgetPeriod !== date.slice(0, 7) && budgetPeriod && (
                <p className="text-xs text-amber-600">
                  Este gasto contará en el presupuesto de {formatBudgetMonth(budgetPeriod)}, no en el de {formatBudgetMonth(date.slice(0, 7))}.
                </p>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2 pt-1 pb-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                {loading ? "Guardando..." : editing ? "Guardar cambios" : "Guardar gasto"}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
