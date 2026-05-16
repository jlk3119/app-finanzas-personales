"use client";

import { useEffect, useState, useCallback } from "react";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { createClient } from "@/utils/supabase/client";
import type { Expense, Budget, Category, Goal, Account, Income, RecurringIncome } from "@/types";
import { getCurrentPayPeriod } from "@/utils/colombian-holidays";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { PlusCircle, LogOut, Target, TrendingDown, Wallet, Settings, Landmark, Trophy } from "lucide-react";
import ExpenseForm from "@/components/ExpenseForm";
import ExpenseList from "@/components/ExpenseList";
import BudgetManager from "@/components/BudgetManager";
import GoalsList from "@/components/GoalsList";
import CategoryManager from "@/components/CategoryManager";
import AccountsManager from "@/components/AccountsManager";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function getWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

const TABS = [
  { value: "dashboard", label: "Resumen",  Icon: TrendingDown },
  { value: "expenses",  label: "Gastos",   Icon: Wallet },
  { value: "budget",    label: "Presup.",  Icon: Target },
  { value: "goals",     label: "Metas",    Icon: Trophy },
  { value: "accounts",  label: "Dinero",   Icon: Landmark },
] as const;

type TabValue = typeof TABS[number]["value"];

export default function Dashboard() {
  const supabase = createClient();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [recurringIncome, setRecurringIncome] = useState<RecurringIncome[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>("dashboard");

  useBackButtonClose(showForm, () => setShowForm(false));
  useBackButtonClose(showCategories, () => setShowCategories(false));

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentWeek = getWeekNumber(now);

  const checkAutoAssign = useCallback(async (
    recurData: RecurringIncome[],
    incData: Income[],
    accData: Account[],
  ): Promise<boolean> => {
    const toAssign = recurData.filter((r) => r.auto_assign);
    if (toAssign.length === 0) return false;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const today = new Date();
    let anyAssigned = false;
    const balanceDelta = new Map<string, number>();

    for (const r of toAssign) {
      const period = getCurrentPayPeriod(r.frequency, today);
      if (!period) continue;

      const alreadyDone = incData.some(
        (i) => i.recurring_income_id === r.id && i.period_key === period.periodKey,
      );
      if (alreadyDone) continue;

      const { error } = await supabase.from("income").insert({
        user_id: user.id,
        account_id: r.account_id,
        amount: r.amount,
        description: `${r.name} (automático)`,
        date: period.payDate,
        recurring_income_id: r.id,
        period_key: period.periodKey,
      });

      if (!error) {
        anyAssigned = true;
        if (r.account_id) {
          balanceDelta.set(r.account_id, (balanceDelta.get(r.account_id) ?? 0) + Number(r.amount));
        }
      }
    }

    for (const [accId, delta] of balanceDelta) {
      const acc = accData.find((a) => a.id === accId);
      if (acc) await supabase.from("accounts").update({ balance: Number(acc.balance) + delta }).eq("id", accId);
    }

    return anyAssigned;
  }, [supabase]);

  const fetchData = useCallback(async () => {
    const [expRes, budRes, catRes, goalRes, accRes, incRes, recurRes] = await Promise.all([
      supabase.from("expenses").select("*, categories(*)").order("date", { ascending: false }),
      supabase.from("budgets").select("*, categories(*)"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("goals").select("*").order("created_at", { ascending: false }),
      supabase.from("accounts").select("*").order("created_at"),
      supabase.from("income").select("*, accounts(*)").order("date", { ascending: false }),
      supabase.from("recurring_income").select("*, accounts(*)").order("created_at"),
    ]);

    if (expRes.data) setExpenses(expRes.data as Expense[]);
    if (budRes.data) setBudgets(budRes.data as Budget[]);

    const accData = (accRes.data ?? []) as Account[];
    const incData = (incRes.data ?? []) as Income[];
    const recurData = (recurRes.data ?? []) as RecurringIncome[];

    if (catRes.data) {
      const cats = catRes.data as Category[];
      if (!cats.some((c) => c.is_system)) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("categories").insert({
            user_id: user.id, name: "Caja menor", icon: "💵", color: "#10b981", is_system: true,
          });
          const { data: updated } = await supabase.from("categories").select("*").order("name");
          if (updated) setCategories(updated as Category[]);
        }
      } else {
        setCategories(cats);
      }
    }

    if (goalRes.data) setGoals(goalRes.data as Goal[]);
    setAccounts(accData);
    setIncome(incData);
    setRecurringIncome(recurData);

    const assigned = await checkAutoAssign(recurData, incData, accData);
    if (assigned) {
      const [accRefresh, incRefresh] = await Promise.all([
        supabase.from("accounts").select("*").order("created_at"),
        supabase.from("income").select("*, accounts(*)").order("date", { ascending: false }),
      ]);
      if (accRefresh.data) setAccounts(accRefresh.data as Account[]);
      if (incRefresh.data) setIncome(incRefresh.data as Income[]);
    }

    setLoading(false);
  }, [supabase, checkAutoAssign]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as TabValue | null;
    if (tab && TABS.some((t) => t.value === tab)) setActiveTab(tab);

    const handlePop = () => {
      const p = new URLSearchParams(window.location.search);
      setActiveTab((p.get("tab") as TabValue) || "dashboard");
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const handleTabChange = (value: TabValue) => {
    setActiveTab(value);
    window.history.pushState({}, "", `?tab=${value}`);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    location.href = "/login";
  };

  const thisMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date + "T12:00:00");
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });

  const thisWeekExpenses = expenses.filter((e) => {
    const d = new Date(e.date + "T12:00:00");
    return getWeekNumber(d) === currentWeek && d.getFullYear() === currentYear;
  });

  const todayStr = now.toISOString().split("T")[0];
  const totalToday = expenses.filter((e) => e.date === todayStr).reduce((s, e) => s + Number(e.amount), 0);
  const totalWeek = thisWeekExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalMonth = thisMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const monthBudget = budgets.find((b) => b.period === "monthly" && b.category_id === null && b.year === currentYear && b.month === currentMonth);
  const weekBudget = budgets.find((b) => b.period === "weekly" && b.category_id === null && b.year === currentYear && b.week === currentWeek);

  const categorySpend = categories.map((cat) => ({
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    total: thisMonthExpenses.filter((e) => e.category_id === cat.id).reduce((s, e) => s + Number(e.amount), 0),
    budget: budgets.find((b) => b.category_id === cat.id && b.period === "monthly" && b.year === currentYear && b.month === currentMonth)?.amount,
  })).filter((c) => c.total > 0);

  const fmt = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-4xl animate-bounce">💸</div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 pt-10 pb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold">💸 MisFinanzas</h1>
            <p className="text-violet-200 text-sm">{now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowCategories(true)} className="text-white hover:bg-white/20">
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="text-white hover:bg-white/20">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <p className="text-xs text-violet-200">Hoy</p>
            <p className="font-bold text-sm">{fmt(totalToday)}</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <p className="text-xs text-violet-200">Semana</p>
            <p className="font-bold text-sm">{fmt(totalWeek)}</p>
            {weekBudget && <p className="text-xs text-violet-300">/ {fmt(weekBudget.amount)}</p>}
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <p className="text-xs text-violet-200">Mes</p>
            <p className="font-bold text-sm">{fmt(totalMonth)}</p>
            {monthBudget && <p className="text-xs text-violet-300">/ {fmt(monthBudget.amount)}</p>}
          </div>
        </div>

        {monthBudget && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-violet-200 mb-1">
              <span>Presupuesto mensual</span>
              <span>{Math.round((totalMonth / monthBudget.amount) * 100)}%</span>
            </div>
            <Progress value={Math.min((totalMonth / monthBudget.amount) * 100, 100)} className="h-2 bg-white/30" />
          </div>
        )}
      </div>

      {/* Contenido por pestaña */}
      <div className="px-4 mt-4 space-y-4">
        {activeTab === "dashboard" && (
          <>
            {categorySpend.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Gastos por categoría este mes</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={categorySpend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="icon" tick={{ fontSize: 16 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => fmt(Number(v))} labelFormatter={(l) => categorySpend.find(c => c.icon === l)?.name || l} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {categorySpend.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Categorías este mes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categorySpend.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin gastos este mes aún. ¡Agrega tu primer gasto!</p>
                )}
                {categorySpend.map((cat) => (
                  <div key={cat.name}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm flex items-center gap-1">
                        <span>{cat.icon}</span> {cat.name}
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-medium">{fmt(cat.total)}</span>
                        {cat.budget && (
                          <Badge variant={cat.total > cat.budget ? "destructive" : "secondary"} className="ml-1 text-xs">
                            {Math.round((cat.total / cat.budget) * 100)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    {cat.budget && <Progress value={Math.min((cat.total / cat.budget) * 100, 100)} className="h-1.5" />}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Últimos gastos</CardTitle>
              </CardHeader>
              <CardContent>
                <ExpenseList expenses={expenses.slice(0, 5)} categories={categories} onRefresh={fetchData} compact />
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "expenses" && (
          <Card>
            <CardContent className="pt-4">
              <ExpenseList expenses={expenses} categories={categories} onRefresh={fetchData} />
            </CardContent>
          </Card>
        )}

        {activeTab === "budget" && (
          <BudgetManager
            budgets={budgets}
            categories={categories}
            accounts={accounts}
            recurringIncome={recurringIncome}
            onRefresh={fetchData}
            onManageCategories={() => setShowCategories(true)}
            currentMonth={currentMonth}
            currentYear={currentYear}
            currentWeek={currentWeek}
          />
        )}

        {activeTab === "goals" && (
          <GoalsList goals={goals} onRefresh={fetchData} />
        )}

        {activeTab === "accounts" && (
          <AccountsManager
            accounts={accounts}
            income={income}
            recurringIncome={recurringIncome}
            onRefresh={fetchData}
          />
        )}
      </div>

      {/* FAB — encima del nav inferior */}
      <div className="fixed bottom-[72px] right-4 z-50">
        <Button
          size="lg"
          className="rounded-full w-14 h-14 shadow-lg bg-violet-600 hover:bg-violet-700"
          onClick={() => setShowForm(true)}
        >
          <PlusCircle className="w-6 h-6" />
        </Button>
      </div>

      {/* Barra de navegación inferior */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] flex">
        {TABS.map(({ value, label, Icon }) => (
          <button
            key={value}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
              activeTab === value ? "text-violet-600" : "text-gray-400"
            }`}
            onClick={() => handleTabChange(value)}
          >
            <Icon className={`w-5 h-5 ${activeTab === value ? "stroke-[2.2px]" : ""}`} />
            <span className="text-[10px] font-medium leading-tight">{label}</span>
          </button>
        ))}
      </nav>

      {showForm && (
        <ExpenseForm
          categories={categories}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData(); }}
        />
      )}

      {showCategories && (
        <CategoryManager
          categories={categories}
          onClose={() => setShowCategories(false)}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
}
