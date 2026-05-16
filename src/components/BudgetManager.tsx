"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { Budget, Category } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Trash2, Plus } from "lucide-react";

type Props = {
  budgets: Budget[];
  categories: Category[];
  onRefresh: () => void;
  currentMonth: number;
  currentYear: number;
  currentWeek: number;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function BudgetManager({ budgets, categories, onRefresh, currentMonth, currentYear, currentWeek }: Props) {
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [period, setPeriod] = useState<"monthly" | "weekly">("monthly");
  const [categoryId, setCategoryId] = useState("global");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const monthlyBudgets = budgets.filter((b) => b.period === "monthly" && b.year === currentYear && b.month === currentMonth);
  const weeklyBudgets = budgets.filter((b) => b.period === "weekly" && b.year === currentYear && b.week === currentWeek);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const data = {
      user_id: user.id,
      period,
      category_id: categoryId === "global" ? null : categoryId,
      amount: Number(amount),
      year: currentYear,
      month: period === "monthly" ? currentMonth : null,
      week: period === "weekly" ? currentWeek : null,
    };

    if (editingId) {
      await supabase.from("budgets").update({ amount: Number(amount) }).eq("id", editingId);
    } else {
      await supabase.from("budgets").upsert(data, { onConflict: "user_id,category_id,period,year,month,week" });
    }

    setShowForm(false);
    setAmount("");
    setCategoryId("global");
    setEditingId(null);
    setLoading(false);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("budgets").delete().eq("id", id);
    onRefresh();
  };

  const startEdit = (b: Budget) => {
    setEditingId(b.id);
    setAmount(String(b.amount));
    setCategoryId(b.category_id ?? "global");
    setPeriod(b.period);
    setShowForm(true);
  };

  const BudgetRow = ({ b }: { b: Budget }) => {
    const cat = categories.find((c) => c.id === b.category_id);
    return (
      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{cat?.icon ?? "🌐"}</span>
          <div>
            <p className="text-sm font-medium">{cat?.name ?? "Total general"}</p>
            <p className="text-xs text-muted-foreground">{fmt(b.amount)}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => startEdit(b)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="w-7 h-7 text-red-400" onClick={() => handleDelete(b.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="monthly">
        <TabsList className="w-full bg-white shadow-sm">
          <TabsTrigger value="monthly" className="flex-1">Mensual — {MONTHS[currentMonth - 1]}</TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1">Semana {currentWeek}</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="mt-3 space-y-2">
          {monthlyBudgets.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Sin presupuestos mensuales. Agrega uno.</p>
          )}
          {monthlyBudgets.map((b) => <BudgetRow key={b.id} b={b} />)}
        </TabsContent>

        <TabsContent value="weekly" className="mt-3 space-y-2">
          {weeklyBudgets.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Sin presupuestos semanales. Agrega uno.</p>
          )}
          {weeklyBudgets.map((b) => <BudgetRow key={b.id} b={b} />)}
        </TabsContent>
      </Tabs>

      {showForm && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{editingId ? "Editar" : "Nuevo"} presupuesto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Período</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as "monthly" | "weekly")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoría</Label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "global")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">🌐 Total general</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Monto límite</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setEditingId(null); setAmount(""); }}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={handleSave} disabled={loading}>
                {loading ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!showForm && (
        <Button className="w-full" variant="outline" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" /> Agregar presupuesto
        </Button>
      )}
    </div>
  );
}
