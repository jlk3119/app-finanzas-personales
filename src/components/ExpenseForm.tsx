"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { Category } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Props = {
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
};

export default function ExpenseForm({ categories, onClose, onSaved }: Props) {
  const supabase = createClient();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { setError("Ingresa un monto válido"); return; }
    setLoading(true);
    setError("");

    const { error: err } = await supabase.from("expenses").insert({
      amount: Number(amount),
      description: description || null,
      category_id: categoryId || null,
      date,
    });

    if (err) { setError(err.message); setLoading(false); return; }
    onSaved();
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle>Nuevo gasto</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="amount">Monto *</Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-xl h-12"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="category">Categoría</Label>
            <Select onValueChange={(v) => setCategoryId(v ?? "")} value={categoryId}>
              <SelectTrigger id="category" className="h-11">
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Input
              id="description"
              placeholder="¿En qué gastaste?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

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

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-violet-600 hover:bg-violet-700" disabled={loading}>
              {loading ? "Guardando..." : "Guardar gasto"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
