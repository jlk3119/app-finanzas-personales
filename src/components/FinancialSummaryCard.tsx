"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import type { Expense, Budget, Goal, Debt, Category, Account, RecurringIncome } from "@/types";

type Props = {
  expenses: Expense[];
  budgets: Budget[];
  goals: Goal[];
  debts: Debt[];
  categories: Category[];
  accounts: Account[];
  recurringIncome: RecurringIncome[];
  currentMonth: number;
  currentYear: number;
};

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const FREQ_LABEL: Record<string, string> = { monthly: "mensual", biweekly: "quincenal", weekly: "semanal" };

export default function FinancialSummaryCard({
  expenses, budgets, goals, debts, categories, accounts, recurringIncome,
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

    // Spending per root category for budget comparison
    const spentByCategory: Record<string, number> = {};
    for (const e of thisMonthExpenses) {
      if (!e.category_id) continue;
      const cat = categories.find((c) => c.id === e.category_id);
      const rootId = cat?.parent_id ?? cat?.id;
      if (!rootId) continue;
      spentByCategory[rootId] = (spentByCategory[rootId] ?? 0) + Number(e.amount);
    }

    // Detailed expense rows — no user_id, no IDs
    const expenseRows = thisMonthExpenses.map((e) => {
      const cat = categories.find((c) => c.id === e.category_id);
      const rootCat = cat?.parent_id ? categories.find((c) => c.id === cat.parent_id) : cat;
      const account = accounts.find((a) => a.id === e.account_id);
      return {
        date: e.date,
        category: rootCat ? `${rootCat.icon} ${rootCat.name}` : "Sin categoría",
        subcategory: cat?.parent_id ? `${cat.icon} ${cat.name}` : undefined,
        amount: Number(e.amount),
        description: e.description ?? "",
        account: account?.name,
      };
    });

    // Budget rows with actual spending
    const budgetRows = monthlyBudgets
      .filter((b) => {
        const cat = b.category_id ? categories.find((c) => c.id === b.category_id) : null;
        return !cat?.parent_id; // root budgets only
      })
      .map((b) => {
        const cat = b.category_id ? categories.find((c) => c.id === b.category_id) : null;
        const spent = b.category_id ? (spentByCategory[b.category_id] ?? 0) : thisMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
        return {
          category: cat ? `${cat.icon} ${cat.name}` : "🌐 Total general",
          amount: Number(b.amount),
          spent,
        };
      });

    // Accounts — name + balance only
    const accountRows = accounts.map((a) => ({ name: a.name, balance: Number(a.balance) }));

    // Recurring income — no IDs
    const incomeRows = recurringIncome.map((r) => ({
      name: r.name,
      amount: Number(r.amount),
      frequency: FREQ_LABEL[r.frequency] ?? r.frequency,
    }));

    // Goals — active only, no IDs
    const goalRows = goals
      .filter((g) => !g.completed)
      .map((g) => ({
        name: `${g.icon} ${g.name}`,
        target: Number(g.target_amount),
        current: Number(g.current_amount),
        deadline: g.deadline ?? undefined,
      }));

    // Debts — pending only, no IDs
    const debtRows = debts
      .filter((d) => Number(d.paid_amount) < Number(d.total_amount))
      .map((d) => ({
        name: d.name,
        entity: d.entity,
        total: Number(d.total_amount),
        paid: Number(d.paid_amount),
      }));

    return {
      month: `${MONTHS[currentMonth - 1]} ${currentYear}`,
      expenses: expenseRows,
      budgets: budgetRows,
      accounts: accountRows,
      recurringIncome: incomeRows,
      goals: goalRows,
      debts: debtRows,
    };
  }, [expenses, budgets, goals, debts, categories, accounts, recurringIncome, currentMonth, currentYear]);

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
            <div className="h-3 bg-violet-100 rounded-full w-3/4" />
            <div className="h-3 bg-violet-100 rounded-full w-full" />
            <div className="h-3 bg-violet-100 rounded-full w-5/6" />
            <div className="h-3 bg-violet-100 rounded-full w-full mt-2" />
            <div className="h-3 bg-violet-100 rounded-full w-2/3" />
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
          Powered by Llama 3 · Se envían transacciones del mes, nunca datos de identidad.
        </p>
      </CardContent>
    </Card>
  );
}
