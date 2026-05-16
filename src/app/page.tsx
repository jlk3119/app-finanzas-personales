"use client";

import { useEffect, useState, useCallback } from "react";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { createClient } from "@/utils/supabase/client";
import type { Expense, Budget, Category, Goal, Account, Income } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, LogOut, Target, TrendingDown, Wallet, Settings, Landmark } from "lucide-react";
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

export default function Dashboard() {
  const supabase = createClient();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  useBackButtonClose(showForm, () => setShowForm(false));
  useBackButtonClose(showCategories, () => setShowCategories(false));

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentWeek = getWeekNumber(now);

  const fetchData = useCallback(async () => {
    const [expRes, budRes, catRes, goalRes, accRes, incRes] = await Promise.all([
      supabase.from("expenses").select("*, categories(*)").order("date", { ascending: false }),
      supabase.from("budgets").select("*, categories(*)"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("goals").select("*").order("created_at", { ascending: false }),
      supabase.from("accounts").select("*").order("created_at"),
      supabase.from("income").select("*, accounts(*)").order("date", { ascending: false }),
    ]);
    if (expRes.data) setExpenses(expRes.data as Expense[]);
    if (budRes.data) setBudgets(budRes.data as Budget[]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    if (goalRes.data) setGoals(goalRes.data as Goal[]);
    if (accRes.data) setAccounts(accRes.data as Account[]);
    if (incRes.data) setIncome(incRes.data as Income[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab) setActiveTab(tab);

    const handlePop = () => {
      const p = new URLSearchParams(window.location.search);
      setActiveTab(p.get("tab") || "dashboard");
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const handleTabChange = (value: string) => {
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

      <div className="px-4 mt-4">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full mb-4 bg-white shadow-sm">
            <TabsTrigger value="dashboard" className="flex-1 text-xs"><TrendingDown className="w-3 h-3 mr-1" />Resumen</TabsTrigger>
            <TabsTrigger value="expenses" className="flex-1 text-xs"><Wallet className="w-3 h-3 mr-1" />Gastos</TabsTrigger>
            <TabsTrigger value="budget" className="flex-1 text-xs"><Target className="w-3 h-3 mr-1" />Presup.</TabsTrigger>
            <TabsTrigger value="goals" className="flex-1 text-xs">🎯 Metas</TabsTrigger>
            <TabsTrigger value="accounts" className="flex-1 text-xs"><Landmark className="w-3 h-3 mr-1" />Dinero</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
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
                        {categorySpend.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
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
                    {cat.budget && (
                      <Progress value={Math.min((cat.total / cat.budget) * 100, 100)} className="h-1.5" />
                    )}
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
          </TabsContent>

          <TabsContent value="expenses">
            <Card>
              <CardContent className="pt-4">
                <ExpenseList expenses={expenses} categories={categories} onRefresh={fetchData} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="budget">
            <BudgetManager budgets={budgets} categories={categories} onRefresh={fetchData}
              onManageCategories={() => setShowCategories(true)}
              currentMonth={currentMonth} currentYear={currentYear} currentWeek={currentWeek} />
          </TabsContent>

          <TabsContent value="goals">
            <GoalsList goals={goals} onRefresh={fetchData} />
          </TabsContent>

          <TabsContent value="accounts">
            <AccountsManager accounts={accounts} income={income} onRefresh={fetchData} />
          </TabsContent>
        </Tabs>
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          className="rounded-full w-14 h-14 shadow-lg bg-violet-600 hover:bg-violet-700"
          onClick={() => setShowForm(true)}
        >
          <PlusCircle className="w-6 h-6" />
        </Button>
      </div>

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
