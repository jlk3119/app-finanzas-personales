"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, AlertCircle, Lightbulb } from "lucide-react";
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

type Summary = {
  status: "good" | "warning" | "critical";
  verdict: string;
  insight: string;
  action: string;
};

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const FREQ_LABEL: Record<string, string> = { monthly: "mensual", biweekly: "quincenal", weekly: "semanal" };

const STATUS_CONFIG = {
  good:     { emoji: "✅", bg: "bg-emerald-500", light: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
  warning:  { emoji: "⚠️", bg: "bg-amber-400",  light: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-100"   },
  critical: { emoji: "🔴", bg: "bg-red-500",    light: "bg-red-50",     text: "text-red-700",     border: "border-red-100"     },
};

export default function FinancialSummaryCard({
  expenses, budgets, goals, debts, categories, accounts, recurringIncome,
  currentMonth, currentYear,
}: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fingerprint covers ALL data — re-fetch whenever anything changes
  const dataFingerprint = useMemo(() => [
    expenses.map((e) => `${e.id}:${e.amount}`).sort().join(","),
    accounts.map((a) => `${a.id}:${a.balance}`).join(","),
    goals.map((g) => `${g.id}:${g.current_amount}`).join(","),
    debts.map((d) => `${d.id}:${d.paid_amount}`).join(","),
    budgets.map((b) => `${b.id}:${b.amount}`).sort().join(","),
    `${currentMonth}-${currentYear}`,
  ].join("|"), [expenses, accounts, goals, debts, budgets, currentMonth, currentYear]);

  const buildPayload = useCallback(() => {
    // Group expenses by year-month key, sorted chronologically
    const byMonth: Record<string, typeof expenses> = {};
    for (const e of expenses) {
      const d = new Date(e.date + "T12:00:00");
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(e);
    }
    const sortedMonthKeys = Object.keys(byMonth).sort();

    const expensesByMonth = sortedMonthKeys.map((key) => {
      const [y, m] = key.split("-").map(Number);
      const label = `${MONTHS[m - 1]} ${y}${(m === currentMonth && y === currentYear) ? " (MES ACTUAL)" : ""}`;
      const rows = byMonth[key].map((e) => {
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
      const total = rows.reduce((s, r) => s + r.amount, 0);
      return { label, total, rows };
    });

    // All monthly budgets grouped the same way
    const budgetsByMonth = (() => {
      const map: Record<string, { category: string; amount: number; spent: number }[]> = {};
      const monthlyBudgets = budgets.filter((b) => b.period === "monthly");
      for (const b of monthlyBudgets) {
        const cat = b.category_id ? categories.find((c) => c.id === b.category_id) : null;
        if (cat?.parent_id) continue; // skip sub-budgets
        const key = `${b.year}-${String(b.month ?? 1).padStart(2, "0")}`;
        if (!map[key]) map[key] = [];
        const monthExp = byMonth[key] ?? [];
        const spent = b.category_id
          ? monthExp.filter((e) => {
              const cat2 = categories.find((c) => c.id === e.category_id);
              return (cat2?.parent_id ?? cat2?.id) === b.category_id;
            }).reduce((s, e) => s + Number(e.amount), 0)
          : monthExp.reduce((s, e) => s + Number(e.amount), 0);
        map[key].push({
          category: cat ? `${cat.icon} ${cat.name}` : "🌐 Total general",
          amount: Number(b.amount),
          spent,
        });
      }
      return map;
    })();

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    return {
      currentMonth: `${MONTHS[currentMonth - 1]} ${currentYear}`,
      today: todayStr,
      expensesByMonth,
      budgetsByMonth,
      accounts: accounts.map((a) => ({ name: a.name, balance: Number(a.balance) })),
      recurringIncome: recurringIncome.map((r) => ({
        name: r.name, amount: Number(r.amount), frequency: FREQ_LABEL[r.frequency] ?? r.frequency,
      })),
      goals: goals.map((g) => ({
        name: `${g.icon} ${g.name}`,
        target: Number(g.target_amount),
        current: Number(g.current_amount),
        completed: g.completed,
        deadline: g.deadline ?? undefined,
      })),
      debts: debts.map((d) => ({
        name: d.name, entity: d.entity,
        total: Number(d.total_amount), paid: Number(d.paid_amount),
      })),
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al obtener el análisis");
      setSummary(data as Summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [buildPayload]);

  // Keep a ref so the fingerprint effect always calls the latest fetchSummary
  const fetchSummaryRef = useRef(fetchSummary);
  useEffect(() => { fetchSummaryRef.current = fetchSummary; }, [fetchSummary]);

  const prevFingerprintRef = useRef<string | null>(null);
  useEffect(() => {
    if (dataFingerprint === prevFingerprintRef.current) return;
    prevFingerprintRef.current = dataFingerprint;
    fetchSummaryRef.current();
  }, [dataFingerprint]);

  const cfg = summary ? STATUS_CONFIG[summary.status] ?? STATUS_CONFIG.good : null;

  return (
    <Card className="overflow-hidden border-0 shadow-md">
      {/* Header band */}
      <div className={`${cfg?.bg ?? "bg-violet-500"} px-4 py-3 flex items-center justify-between transition-colors duration-500`}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-white/80" />
          <span className="text-white text-xs font-medium tracking-wide uppercase">
            Tu mes · {MONTHS[currentMonth - 1]}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 text-white/70 hover:text-white hover:bg-white/20"
          onClick={fetchSummary}
          disabled={loading}
          aria-label="Actualizar análisis"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <CardContent className="p-0">
        {/* Loading skeleton */}
        {loading && (
          <div className="px-4 py-4 space-y-3 animate-pulse">
            <div className="h-5 bg-gray-100 rounded-full w-1/2" />
            <div className="h-3 bg-gray-100 rounded-full w-full" />
            <div className="h-3 bg-gray-100 rounded-full w-4/5" />
            <div className="h-8 bg-gray-100 rounded-xl w-full mt-1" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-start gap-2 text-red-600 bg-red-50 mx-4 my-3 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        {/* Result */}
        {summary && !loading && cfg && (
          <div className="divide-y divide-gray-100">
            {/* Verdict */}
            <div className={`${cfg.light} px-4 py-3 flex items-center gap-2.5`}>
              <span className="text-xl">{cfg.emoji}</span>
              <p className={`font-bold text-base ${cfg.text}`}>{summary.verdict}</p>
            </div>

            {/* Insight */}
            <div className="px-4 py-3">
              <p className="text-sm text-gray-700 leading-relaxed">{summary.insight}</p>
            </div>

            {/* Action */}
            <div className="px-4 py-3 bg-violet-50 flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
              <p className="text-sm text-violet-800 font-medium leading-relaxed">{summary.action}</p>
            </div>
          </div>
        )}

        <p className="text-[10px] text-gray-400 text-right px-4 py-1.5">
          Powered by Llama 3 · Solo datos del mes, sin identidad personal
        </p>
      </CardContent>
    </Card>
  );
}
