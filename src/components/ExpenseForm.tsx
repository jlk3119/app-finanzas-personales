"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { Account, Category } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X } from "lucide-react";

type Props = {
  categories: Category[];
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
};

export default function ExpenseForm({ categories, accounts, onClose, onSaved }: Props) {
  const supabase = createClient();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [accountId, setAccountId] = useState(accounts.length === 1 ? accounts[0].id : "");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const finalCategoryId = subCategoryId || categoryId || null;
    const finalAccountId = accountId || null;

    const { error: err } = await supabase.from("expenses").insert({
      amount: Number(amount),
      description: description || null,
      category_id: finalCategoryId,
      account_id: finalAccountId,
      date,
      user_id: user.id,
    });

    if (err) { setError(err.message); setLoading(false); return; }

    if (finalAccountId) {
      const acc = accounts.find((a) => a.id === finalAccountId);
      if (acc) {
        await supabase.from("accounts").update({
          balance: Math.max(0, Number(acc.balance) - Number(amount)),
        }).eq("id", finalAccountId);
      }
    }

    onSaved();
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] flex flex-col gap-0 p-0 pb-8" showCloseButton={false}>
        <SheetHeader className="sticky top-0 z-10 bg-white rounded-t-2xl flex-row items-center justify-between px-4 py-3 border-b mb-0 gap-0">
          <SheetTitle className="text-base">Nuevo gasto</SheetTitle>
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
                            ? "border-violet-500 bg-violet-50 text-violet-700 font-medium"
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
                          ? "border-violet-500 bg-violet-50"
                          : "border-gray-200 bg-white active:bg-gray-50"
                      }`}
                    >
                      <span className="text-2xl">{cat.icon}</span>
                      <span className={`text-[9px] leading-tight font-medium line-clamp-2 ${isSelected ? "text-violet-700" : "text-gray-600"}`}>
                        {cat.name}{hasSubs ? " ›" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subcategoría — aparece solo si la categoría seleccionada tiene hijos */}
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
                            ? "border-violet-500 bg-violet-50 text-violet-700 font-medium"
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
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2 pt-1 pb-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-violet-600 hover:bg-violet-700" disabled={loading}>
                {loading ? "Guardando..." : "Guardar gasto"}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
