"use client";

import { useState } from "react";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { createClient } from "@/utils/supabase/client";
import type { Budget, Category } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Trash2, Plus, Settings2, ChevronLeft, ChevronRight, Copy } from "lucide-react";

type Props = {
  budgets: Budget[];
  categories: Category[];
  onRefresh: () => void;
  onManageCategories: () => void;
  currentMonth: number;
  currentYear: number;
  currentWeek: number;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function prevMonthOf(month: number, year: number) {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}
function nextMonthOf(month: number, year: number) {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
}

export default function BudgetManager({ budgets, categories, onRefresh, onManageCategories, currentMonth, currentYear, currentWeek }: Props) {
  const supabase = createClient();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showForm, setShowForm] = useState(false);
  const [period, setPeriod] = useState<"monthly" | "weekly">("monthly");
  const [categoryId, setCategoryId] = useState("global");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useBackButtonClose(showForm, () => { setShowForm(false); setEditingId(null); setAmount(""); });

  const categoryItems: Record<string, string> = {
    global: "🌐 Total general",
    ...Object.fromEntries(categories.map((c) => [c.id, `${c.icon} ${c.name}`])),
  };

  const monthlyBudgets = budgets.filter((b) =>
    b.period === "monthly" && b.year === selectedYear && b.month === selectedMonth
  );
  const weeklyBudgets = budgets.filter((b) =>
    b.period === "weekly" && b.year === currentYear && b.week === currentWeek
  );

  const prev = prevMonthOf(selectedMonth, selectedYear);
  const next = nextMonthOf(selectedMonth, selectedYear);

  // No navegar más de 2 meses al futuro
  const isNextDisabled =
    next.year > currentYear || (next.year === currentYear && next.month > currentMonth + 2);

  const prevBudgets = budgets.filter((b) =>
    b.period === "monthly" && b.year === prev.year && b.month === prev.month
  );

  const goToPrev = () => {
    setSelectedMonth(prev.month);
    setSelectedYear(prev.year);
    setShowForm(false);
    setEditingId(null);
    setAmount("");
  };

  const goToNext = () => {
    if (isNextDisabled) return;
    setSelectedMonth(next.month);
    setSelectedYear(next.year);
    setShowForm(false);
    setEditingId(null);
    setAmount("");
  };

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
      year: period === "monthly" ? selectedYear : currentYear,
      month: period === "monthly" ? selectedMonth : null,
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

  const copyFromPrevMonth = async () => {
    if (prevBudgets.length === 0) return;
    setCopying(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCopying(false); return; }

    const newBudgets = prevBudgets.map((b) => ({
      user_id: user.id,
      period: "monthly" as const,
      category_id: b.category_id,
      amount: b.amount,
      year: selectedYear,
      month: selectedMonth,
      week: null,
    }));

    await supabase.from("budgets").upsert(newBudgets, {
      onConflict: "user_id,category_id,period,year,month,week",
    });

    setCopying(false);
    onRefresh();
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
          <TabsTrigger value="monthly" className="flex-1">Mensual</TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1">Semana {currentWeek}</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="mt-3 space-y-2">
          {/* Navegación de mes */}
          <div className="flex items-center justify-between bg-white border rounded-xl px-3 py-2">
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={goToPrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold">
              {MONTHS[selectedMonth - 1]} {selectedYear}
              {selectedMonth === currentMonth && selectedYear === currentYear && (
                <span className="ml-1.5 text-xs font-normal text-violet-500">● actual</span>
              )}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={goToNext}
              disabled={isNextDisabled}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Total */}
          {monthlyBudgets.length > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-violet-700 font-medium">Total presupuestado</span>
              <span className="text-base font-bold text-violet-800">
                {fmt(monthlyBudgets.reduce((s, b) => s + Number(b.amount), 0))}
              </span>
            </div>
          )}

          {/* Sin presupuesto — ofrecer copiar del mes anterior */}
          {monthlyBudgets.length === 0 && (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Sin presupuesto para {MONTHS[selectedMonth - 1]}.
              </p>
              {prevBudgets.length > 0 && (
                <Button
                  variant="outline"
                  className="text-violet-600 border-violet-200 hover:bg-violet-50"
                  onClick={copyFromPrevMonth}
                  disabled={copying}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {copying ? "Copiando..." : `Copiar de ${MONTHS[prev.month - 1]}`}
                </Button>
              )}
            </div>
          )}

          {monthlyBudgets.map((b) => <BudgetRow key={b.id} b={b} />)}
        </TabsContent>

        <TabsContent value="weekly" className="mt-3 space-y-2">
          {weeklyBudgets.length > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-violet-700 font-medium">Total presupuestado</span>
              <span className="text-base font-bold text-violet-800">
                {fmt(weeklyBudgets.reduce((s, b) => s + Number(b.amount), 0))}
              </span>
            </div>
          )}
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
              <Select
                value={period}
                onValueChange={(v) => setPeriod(v as "monthly" | "weekly")}
                items={{ monthly: "Mensual", weekly: "Semanal" }}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensual — {MONTHS[selectedMonth - 1]} {selectedYear}</SelectItem>
                  <SelectItem value="weekly">Semanal — Semana {currentWeek}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Categoría</Label>
                <button type="button" onClick={onManageCategories} className="text-xs text-violet-600 flex items-center gap-1 hover:underline">
                  <Settings2 className="w-3 h-3" /> Gestionar categorías
                </button>
              </div>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "global")} items={categoryItems}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
                autoFocus
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
        <div className="flex gap-2">
          <Button className="flex-1" variant="outline" onClick={() => { setShowForm(true); setPeriod("monthly"); }}>
            <Plus className="w-4 h-4 mr-1" /> Agregar presupuesto
          </Button>
          <Button variant="outline" onClick={onManageCategories} className="text-violet-600 border-violet-200 hover:bg-violet-50">
            <Settings2 className="w-4 h-4 mr-1" /> Categorías
          </Button>
        </div>
      )}
    </div>
  );
}
