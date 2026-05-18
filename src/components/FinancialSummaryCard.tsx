"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import type { Expense, Budget, Goal, Debt, Category, Account } from "@/types";

type Props = {
  expenses: Expense[];
  budgets: Budget[];
  goals: Goal[];
  debts: Debt[];
  categories: Category[];
  accounts: Account[];
  currentMonth: number;
  currentYear: number;
};

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function FinancialSummaryCard({
  expenses, budgets, goals, debts, categories, accounts,
  currentMonth, currentYear,
}: Props) {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildPayload = useCallback(() => {
    const thisMonthExpenses = expenses.filter((e) => {
      const d = new Date(e.date + "T12:00:00");
      return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
    });

    const monthlyBudgets = budgets.filter(
      (b) => b.period === "monthly" && b.year === currentYear && b.month === currentMonth
    );

    // Aggregate spending by root category
    const spendingByCategory: Record<string, number> = {};
    for (const e of thisMonthExpenses) {
      if (!e.category_id) continue;
      const cat = categories.find((c) => c.id === e.category_id);
      const rootId = cat?.parent_id ?? cat?.id;
      if (!rootId) continue;
      spendingByCategory[rootId] = (spendingByCategory[rootId] ?? 0) + Number(e.amount);
    }

    const topCategories = Object.entries(spendingByCategory)
      .map(([catId, spent]) => {
        const cat = categories.find((c) => c.id === catId);
        const budgetItem = monthlyBudgets.find((b) => b.category_id === catId);
        return {
          name: cat ? `${cat.icon} ${cat.name}` : "Otros",
          spent,
          budget: budgetItem ? Number(budgetItem.amount) : null,
        };
      })
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5);

    const totalSpent = thisMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const globalBudget = monthlyBudgets.find((b) => !b.category_id);
    const totalBudget = globalBudget ? Number(globalBudget.amount) : 0;
    const disponible = accounts.reduce((s, a) => s + Number(a.balance), 0);

    const goalsSummary = goals
      .filter((g) => !g.completed)
      .slice(0, 4)
      .map((g) => ({
        name: `${g.icon} ${g.name}`,
        pct: g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0,
      }));

    const debtsSummary = debts
      .filter((d) => Number(d.paid_amount) < Number(d.total_amount))
      .slice(0, 4)
      .map((d) => ({
        name: d.name,
        entity: d.entity,
        pct: d.total_amount > 0 ? Math.round((Number(d.paid_amount) / Number(d.total_amount)) * 100) : 0,
        remaining: Number(d.total_amount) - Number(d.paid_amount),
      }));

    return {
      monthName: `${MONTHS[currentMonth - 1]} ${currentYear}`,
      totalSpent,
      totalBudget,
      topCategories,
      budgetItems: monthlyBudgets,
      goals: goalsSummary,
      debts: debtsSummary,
      disponible,
    };
  }, [expenses, budgets, goals, debts, categories, accounts, currentMonth, currentYear]);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/financial-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al obtener el análisis");
      }
      const data = await res.json();
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [buildPayload]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <Card className="border-violet-100 bg-gradient-to-br from-violet-50 to-white">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-semibold text-violet-800">Análisis IA — {MONTHS[currentMonth - 1]}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-violet-400 hover:text-violet-600"
            onClick={fetchSummary}
            disabled={loading}
            aria-label="Actualizar análisis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {loading && (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-violet-100 rounded-full w-full" />
            <div className="h-3 bg-violet-100 rounded-full w-5/6" />
            <div className="h-3 bg-violet-100 rounded-full w-4/6" />
            <div className="h-3 bg-violet-100 rounded-full w-full mt-2" />
            <div className="h-3 bg-violet-100 rounded-full w-3/4" />
          </div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        {summary && !loading && (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{summary}</p>
        )}

        <p className="text-[10px] text-muted-foreground">
          Generado por Llama 3 (Groq) · Solo se envían datos agregados, no transacciones individuales.
        </p>
      </CardContent>
    </Card>
  );
}
