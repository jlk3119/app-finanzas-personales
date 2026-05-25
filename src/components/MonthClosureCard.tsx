"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { Expense, Category, Budget, Income } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

type Props = {
  companyId: string;
  prevYear: number;
  prevMonth: number;
  expenses: Expense[];
  categories: Category[];
  budgets: Budget[];
  income: Income[];
  onClose: () => void;
  onRefresh: () => void;
};

export default function MonthClosureCard({
  companyId, prevYear, prevMonth, expenses, categories, budgets, income, onClose, onRefresh,
}: Props) {
  const supabase = createClient();
  const [dismissing, setDismissing] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const monthName = MONTH_NAMES[prevMonth - 1];

  const prevExpenses = expenses.filter((e) => {
    const d = new Date(e.date + "T12:00:00");
    return d.getMonth() + 1 === prevMonth && d.getFullYear() === prevYear;
  });
  const totalSpent = prevExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const ppMonth = prevMonth === 1 ? 12 : prevMonth - 1;
  const ppYear = prevMonth === 1 ? prevYear - 1 : prevYear;
  const ppExpenses = expenses.filter((e) => {
    const d = new Date(e.date + "T12:00:00");
    return d.getMonth() + 1 === ppMonth && d.getFullYear() === ppYear;
  });

  const monthBudget = budgets.find(
    (b) => b.period === "monthly" && b.category_id === null && b.year === prevYear && b.month === prevMonth,
  );

  const prevIncome = income.filter((i) => {
    const d = new Date(i.date + "T12:00:00");
    return d.getMonth() + 1 === prevMonth && d.getFullYear() === prevYear;
  });
  const totalIncome = prevIncome.reduce((s, i) => s + Number(i.amount), 0);

  const reference = totalIncome > 0 ? totalIncome : monthBudget?.amount ?? null;
  const realMargin = reference !== null ? reference - totalSpent : null;
  const surplus = realMargin !== null && realMargin > 0 ? realMargin : 0;
  const isPositive = realMargin === null || realMargin >= 0;

  const childrenOf = (pid: string) => categories.filter((c) => c.parent_id === pid);
  const topCats = categories.filter((c) => !c.parent_id);

  const catBreakdown = topCats.map((cat) => {
    const subs = childrenOf(cat.id);
    const allIds = [cat.id, ...subs.map((s) => s.id)];
    const spent = prevExpenses
      .filter((e) => allIds.includes(e.category_id ?? ""))
      .reduce((s, e) => s + Number(e.amount), 0);
    const ppSpent = ppExpenses
      .filter((e) => allIds.includes(e.category_id ?? ""))
      .reduce((s, e) => s + Number(e.amount), 0);
    const budget = budgets.find(
      (b) => b.category_id === cat.id && b.period === "monthly" && b.year === prevYear && b.month === prevMonth,
    )?.amount;
    const pctChange = ppSpent > 0 ? ((spent - ppSpent) / ppSpent) * 100 : null;
    const subBreakdown = subs
      .map((sub) => ({
        ...sub,
        spent: prevExpenses
          .filter((e) => e.category_id === sub.id)
          .reduce((s, e) => s + Number(e.amount), 0),
      }))
      .filter((s) => s.spent > 0);
    return { ...cat, spent, budget, pctChange, subBreakdown };
  }).filter((c) => c.spent > 0);

  const toggleCat = (id: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDismiss = async () => {
    setDismissing(true);
    await supabase.from("month_closures").upsert({ company_id: companyId, year: prevYear, month: prevMonth });
    onClose();
  };

  return (
    <Card className="border-2 border-emerald-200 overflow-hidden">
      <div
        className={`px-4 py-4 text-white ${
          isPositive
            ? "bg-gradient-to-r from-emerald-500 to-teal-500"
            : "bg-gradient-to-r from-rose-500 to-orange-500"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium opacity-80">Resumen del mes cerrado</p>
            <h2 className="text-xl font-bold">{monthName} {prevYear}</h2>
          </div>
          <span className="text-4xl">{isPositive ? "🎉" : "😅"}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="bg-white/20 rounded-xl p-2.5">
            <p className="text-xs opacity-80">Total gastado</p>
            <p className="font-bold">{fmt(totalSpent)}</p>
          </div>
          <div className="bg-white/20 rounded-xl p-2.5">
            <p className="text-xs opacity-80">{totalIncome > 0 ? "Ingresos del mes" : "Presupuesto"}</p>
            <p className="font-bold">{totalIncome > 0 ? fmt(totalIncome) : (monthBudget ? fmt(monthBudget.amount) : "—")}</p>
          </div>
        </div>
      </div>

      <CardContent className="pt-4 space-y-4">
        {realMargin !== null && (
          <div
            className={`rounded-xl px-4 py-3 flex items-center justify-between ${
              isPositive ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"
            }`}
          >
            <div>
              <p className="text-xs font-medium text-muted-foreground">Margen real del mes</p>
              <p className={`text-2xl font-bold ${isPositive ? "text-emerald-700" : "text-rose-700"}`}>
                {fmt(Math.abs(realMargin))}
              </p>
              <p className="text-xs text-muted-foreground">{isPositive ? "a tu favor" : "de déficit"}</p>
            </div>
            {isPositive
              ? <TrendingUp className="w-8 h-8 text-emerald-400" />
              : <TrendingDown className="w-8 h-8 text-rose-400" />
            }
          </div>
        )}

        {monthBudget && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Presupuesto utilizado</span>
              <span>{Math.round((totalSpent / monthBudget.amount) * 100)}%</span>
            </div>
            <Progress value={Math.min((totalSpent / monthBudget.amount) * 100, 100)} className="h-2" />
          </div>
        )}

        {catBreakdown.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Por categoría</p>
            {catBreakdown.map((cat) => (
              <div key={cat.id} className="bg-gray-50 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                  onClick={() => cat.subBreakdown.length > 0 && toggleCat(cat.id)}
                >
                  <span className="text-lg shrink-0">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{cat.name}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {cat.pctChange !== null && (
                          <span
                            className={`text-xs font-medium flex items-center gap-0.5 ${
                              cat.pctChange > 5 ? "text-rose-500" : cat.pctChange < -5 ? "text-emerald-500" : "text-muted-foreground"
                            }`}
                          >
                            {cat.pctChange > 5
                              ? <TrendingUp className="w-3 h-3" />
                              : cat.pctChange < -5
                                ? <TrendingDown className="w-3 h-3" />
                                : <Minus className="w-3 h-3" />
                            }
                            {Math.abs(Math.round(cat.pctChange))}%
                          </span>
                        )}
                        <p className="text-sm font-semibold">{fmt(cat.spent)}</p>
                      </div>
                    </div>
                    {cat.budget && (
                      <Progress
                        value={Math.min((cat.spent / cat.budget) * 100, 100)}
                        className={`h-1 mt-1 ${cat.spent > cat.budget ? "[&>div]:bg-rose-500" : ""}`}
                      />
                    )}
                  </div>
                  {cat.subBreakdown.length > 0 && (
                    expandedCats.has(cat.id)
                      ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                </button>
                {expandedCats.has(cat.id) && cat.subBreakdown.length > 0 && (
                  <div className="border-t border-gray-100 px-3 pb-2 pt-1 space-y-1">
                    {cat.subBreakdown.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between py-0.5">
                        <span className="text-xs text-muted-foreground">↳ {sub.icon} {sub.name}</span>
                        <span className="text-xs font-medium">{fmt(sub.spent)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {surplus > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-emerald-800">💡 {fmt(surplus)} de saldo a favor</p>
            <p className="text-xs text-emerald-600 mt-0.5">Puedes asignarlo a una cuenta o reinvertirlo.</p>
          </div>
        )}

        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          onClick={handleDismiss}
          disabled={dismissing}
        >
          {dismissing ? "Cerrando mes..." : "Entendido ✓"}
        </Button>
      </CardContent>
    </Card>
  );
}
