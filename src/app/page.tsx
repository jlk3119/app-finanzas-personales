"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { useCompany } from "@/hooks/useCompany";
import { createClient } from "@/utils/supabase/client";
import type { Expense, Budget, Category, Account, Income, RecurringIncome, MonthClosure, Debt, Client, Order } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  PlusCircle, LogOut, Wallet, Settings, Landmark, ClipboardList, Users,
  LayoutDashboard, ChevronLeft, ChevronRight, Download, TrendingUp, TrendingDown, CheckCircle2,
} from "lucide-react";
import { exportMonthlyCSV } from "@/utils/exportCSV";
import ExpenseForm from "@/components/ExpenseForm";
import ExpenseList from "@/components/ExpenseList";
import BudgetManager from "@/components/BudgetManager";
import DebtManager from "@/components/DebtManager";
import CategoryManager from "@/components/CategoryManager";
import AccountsManager from "@/components/AccountsManager";
import MonthClosureCard from "@/components/MonthClosureCard";
import ClientsManager from "@/components/ClientsManager";
import OrdersManager from "@/components/OrdersManager";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const TABS = [
  { value: "dashboard", label: "Resumen",  Icon: LayoutDashboard },
  { value: "clients",   label: "Clientes", Icon: Users },
  { value: "orders",    label: "Pedidos",  Icon: ClipboardList },
  { value: "expenses",  label: "Gastos",   Icon: Wallet },
  { value: "finance",   label: "Finanzas", Icon: Landmark },
] as const;

type TabValue = typeof TABS[number]["value"];

export default function Dashboard() {
  const supabase = createClient();
  const router = useRouter();
  const { companyId, role, company, loading: companyLoading } = useCompany();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dashboardExpenses, setDashboardExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [recurringIncome, setRecurringIncome] = useState<RecurringIncome[]>([]);
  const [monthClosures, setMonthClosures] = useState<MonthClosure[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [showBudgetInExpenses, setShowBudgetInExpenses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>("dashboard");
  const [expenseMonth, setExpenseMonth] = useState(() => new Date().getMonth() + 1);
  const [expenseYear, setExpenseYear] = useState(() => new Date().getFullYear());
  const [clientFormSignal, setClientFormSignal] = useState(0);
  const [orderFormSignal, setOrderFormSignal] = useState(0);

  useBackButtonClose(showForm, () => setShowForm(false));
  useBackButtonClose(editingExpense !== null, () => setEditingExpense(null));
  useBackButtonClose(showCategories, () => setShowCategories(false));

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const fetchData = useCallback(async () => {
    if (!companyId) return;

    const nowObj = new Date();
    const curM = nowObj.getMonth() + 1;
    const curY = nowObj.getFullYear();
    const pM = curM === 1 ? 12 : curM - 1;
    const pY = curM === 1 ? curY - 1 : curY;
    const startOfPrevMonthStr = `${pY}-${String(pM).padStart(2, "0")}-01`;

    const startOfMonthStr = `${expenseYear}-${String(expenseMonth).padStart(2, "0")}-01`;
    const endOfMonthStr = `${expenseYear}-${String(expenseMonth).padStart(2, "0")}-${new Date(expenseYear, expenseMonth, 0).getDate()}`;

    const [expRes, dashExpRes, budRes, catRes, accRes, incRes, recurRes, closuresRes, debtRes, clientRes, orderRes] = await Promise.all([
      supabase.from("expenses").select("*, categories(*)").gte("date", startOfMonthStr).lte("date", endOfMonthStr).order("date", { ascending: false }),
      supabase.from("expenses").select("*, categories(*)").gte("date", startOfPrevMonthStr).order("date", { ascending: false }),
      supabase.from("budgets").select("*, categories(*)"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("accounts").select("*").order("created_at"),
      supabase.from("income").select("*").gte("date", startOfPrevMonthStr).order("date", { ascending: false }),
      supabase.from("recurring_income").select("*").order("created_at"),
      supabase.from("month_closures").select("*"),
      supabase.from("debts").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("*").order("name"),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
    ]);

    setExpenses((expRes.data ?? []) as Expense[]);
    setDashboardExpenses((dashExpRes.data ?? []) as Expense[]);
    setBudgets((budRes.data ?? []) as Budget[]);
    setCategories((catRes.data ?? []) as Category[]);
    setAccounts((accRes.data ?? []) as Account[]);
    setIncome((incRes.data ?? []) as Income[]);
    setRecurringIncome((recurRes.data ?? []) as RecurringIncome[]);
    setMonthClosures((closuresRes.data ?? []) as MonthClosure[]);
    setDebts((debtRes.data ?? []) as Debt[]);
    setClients((clientRes.data ?? []) as Client[]);
    setOrders((orderRes.data ?? []) as Order[]);
    setLoading(false);
  }, [supabase, companyId, expenseMonth, expenseYear]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!companyId && !companyLoading) {
      router.push("/company-setup");
      return;
    }
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("minegocio_cache");
        if (cached) {
          const data = JSON.parse(cached);
          if (data.expenses)        setExpenses(data.expenses);
          if (data.dashboardExpenses) setDashboardExpenses(data.dashboardExpenses);
          if (data.budgets)         setBudgets(data.budgets);
          if (data.categories)      setCategories(data.categories);
          if (data.accounts)        setAccounts(data.accounts);
          if (data.income)          setIncome(data.income);
          if (data.recurringIncome) setRecurringIncome(data.recurringIncome);
          if (data.monthClosures)   setMonthClosures(data.monthClosures);
          if (data.debts)           setDebts(data.debts);
          if (data.clients)         setClients(data.clients);
          if (data.orders)          setOrders(data.orders);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to load offline cache:", e);
      }
    }
  }, [companyId, companyLoading, router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as TabValue | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab && TABS.some((t) => t.value === tab)) setActiveTab(tab);

    const handlePop = () => {
      const p = new URLSearchParams(window.location.search);
      setActiveTab((p.get("tab") as TabValue) || "dashboard");
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const goToPrevExpenseMonth = () => {
    if (expenseMonth === 1) { setExpenseMonth(12); setExpenseYear((y) => y - 1); }
    else { setExpenseMonth((m) => m - 1); }
  };

  const goToNextExpenseMonth = () => {
    if (expenseMonth === currentMonth && expenseYear === currentYear) return;
    if (expenseMonth === 12) { setExpenseMonth(1); setExpenseYear((y) => y + 1); }
    else { setExpenseMonth((m) => m + 1); }
  };

  const handleTabChange = (value: TabValue) => {
    setActiveTab(value);
    window.history.pushState({}, "", `?tab=${value}`);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      localStorage.removeItem("minegocio_company");
      document.cookie = "has_company=; max-age=0; path=/";
    }
    location.href = "/login";
  };

  // KPIs for dashboard
  const thisMonthExpenses = dashboardExpenses.filter((e) => {
    const d = new Date(e.date + "T12:00:00");
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });
  const totalMonthSpent = thisMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
  const thisMonthIncome = income.filter((i) => {
    const d = new Date(i.date + "T12:00:00");
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });
  const totalMonthIncome = thisMonthIncome.reduce((s, i) => s + Number(i.amount), 0);

  const activeOrders = orders.filter((o) => o.status === "pending" || o.status === "in_progress");
  const activeOrdersValue = activeOrders.reduce((s, o) => s + Number(o.total_value) - Number(o.advance_payment), 0);

  const utilidad = totalMonthIncome - totalMonthSpent;

  // Disponible
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const unlinkedMonthTotal = thisMonthExpenses
    .filter((e) => !e.account_id)
    .reduce((s, e) => s + Number(e.amount), 0);
  const futureSporadicLinked = income
    .filter((i) => !i.recurring_income_id && !!i.period_key && i.period_key > currentMonthKey && !!i.account_id)
    .reduce((s, i) => s + Number(i.amount), 0);
  const disponible = totalBalance - unlinkedMonthTotal - futureSporadicLinked;

  // Month closure
  const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
  const prevMonthClosed = monthClosures.some((c) => c.year === prevY && c.month === prevM);
  const prevMonthHasData =
    dashboardExpenses.some((e) => {
      const d = new Date(e.date + "T12:00:00");
      return d.getMonth() + 1 === prevM && d.getFullYear() === prevY;
    }) || budgets.some((b) => b.period === "monthly" && b.year === prevY && b.month === prevM);
  const showClosure = !prevMonthClosed && prevMonthHasData;

  // Category spend for dashboard
  const childrenOf = (pid: string) => categories.filter((c) => c.parent_id === pid);
  const categorySpend = categories
    .filter((c) => !c.parent_id)
    .map((cat) => {
      const subs = childrenOf(cat.id);
      const allIds = [cat.id, ...subs.map((s) => s.id)];
      return {
        name: cat.name, icon: cat.icon, color: cat.color,
        total: thisMonthExpenses.filter((e) => allIds.includes(e.category_id ?? "")).reduce((s, e) => s + Number(e.amount), 0),
        budget: budgets.find((b) => b.category_id === cat.id && b.period === "monthly" && b.year === currentYear && b.month === currentMonth)?.amount,
      };
    })
    .filter((c) => c.total > 0);

  const monthBudget = budgets.find((b) => b.period === "monthly" && b.category_id === null && b.year === currentYear && b.month === currentMonth);

  // FAB config per tab
  const fabConfig = (() => {
    switch (activeTab) {
      case "dashboard":
      case "expenses": return { label: "Nuevo gasto", action: () => setShowForm(true) };
      case "clients":  return { label: "Nuevo cliente", action: () => setClientFormSignal((s) => s + 1) };
      case "orders":   return { label: "Nuevo pedido", action: () => setOrderFormSignal((s) => s + 1) };
      default: return null;
    }
  })();

  if (companyLoading || (loading && !categories.length)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-4xl animate-bounce">🏢</div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 pt-10 pb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold">🏢 MiNegocio</h1>
            <p className="text-emerald-200 text-sm">{company?.name ?? ""}</p>
            {role === "employee" && (
              <Badge className="bg-emerald-800/60 text-emerald-100 text-xs mt-0.5">Empleado</Badge>
            )}
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

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-200">Ingresos del mes</p>
            <p className="font-bold text-sm">{fmt(totalMonthIncome)}</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-200">Gastos del mes</p>
            <p className="font-bold text-sm">{fmt(totalMonthSpent)}</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-200">Saldo por cobrar</p>
            <p className="font-bold text-sm">{fmt(activeOrdersValue)}</p>
          </div>
          <div className={`rounded-xl p-3 text-center ${utilidad >= 0 ? "bg-white/20" : "bg-rose-500/30"}`}>
            <p className="text-xs text-emerald-200">Utilidad bruta</p>
            <p className="font-bold text-sm">{fmt(utilidad)}</p>
          </div>
        </div>

        {accounts.length > 0 && (
          <div className={`mt-2 rounded-xl px-4 py-2.5 flex items-center justify-between ${disponible >= 0 ? "bg-white/10" : "bg-rose-500/30"}`}>
            <p className="text-xs text-emerald-300">Disponible en cuentas</p>
            <p className={`font-bold text-base ${disponible < 0 ? "text-rose-200" : "text-white"}`}>{fmt(disponible)}</p>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="px-4 mt-4 space-y-4">

        {/* ── Resumen ── */}
        {activeTab === "dashboard" && (
          <>
            {showClosure && companyId && (
              <MonthClosureCard
                companyId={companyId}
                prevYear={prevY}
                prevMonth={prevM}
                expenses={dashboardExpenses}
                categories={categories}
                budgets={budgets}
                income={income}
                onClose={() => setMonthClosures((prev) => [...prev, { id: "", company_id: companyId, year: prevY, month: prevM, closed_at: "" }])}
                onRefresh={fetchData}
              />
            )}

            {/* Onboarding checklist */}
            {(() => {
              const s1 = accounts.length > 0;
              const s2 = clients.length > 0;
              const s3 = orders.length > 0;
              if (s1 && s2 && s3) return null;
              const steps = [
                { done: s1, label: "Agrega tu cuenta bancaria",  desc: "Registra dónde guardas el dinero del negocio",  tab: "finance"  as TabValue },
                { done: s2, label: "Registra tu primer cliente",  desc: "¿Quiénes te compran?",                          tab: "clients"  as TabValue },
                { done: s3, label: "Crea tu primer pedido",       desc: "Lleva el control de tus pedidos en curso",      tab: "orders"   as TabValue },
              ];
              const doneCount = steps.filter((s) => s.done).length;
              return (
                <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
                  <CardContent className="pt-5 pb-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold text-emerald-900">
                          {doneCount === 0 ? "👋 ¡Bienvenido a MiNegocio!" : "Primeros pasos"}
                        </h2>
                        <p className="text-xs text-emerald-600 mt-0.5">{doneCount} de 3 pasos completados</p>
                      </div>
                      <div className="flex gap-1">
                        {steps.map((s, i) => (
                          <div key={i} className={`w-2 h-2 rounded-full ${s.done ? "bg-emerald-500" : "bg-emerald-200"}`} />
                        ))}
                      </div>
                    </div>
                    <ol className="space-y-2">
                      {steps.map((step, i) => step.done ? (
                        <li key={i} className="flex items-center gap-2.5 bg-white/60 rounded-xl px-3 py-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          <p className="text-sm text-emerald-700 line-through">{step.label}</p>
                        </li>
                      ) : (
                        <li key={i}>
                          <button
                            className="w-full flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5 shadow-sm text-left active:bg-emerald-50 transition-colors"
                            onClick={() => handleTabChange(step.tab)}
                          >
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0">{i + 1}</span>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-gray-800">{step.label}</p>
                              <p className="text-xs text-muted-foreground">{step.desc}</p>
                            </div>
                            <span className="ml-auto text-emerald-400 text-base shrink-0">›</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Category spend */}
            {categorySpend.length > 0 && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <p className="text-sm font-semibold">Gastos por categoría — {MONTHS[currentMonth - 1]}</p>
                  {[...categorySpend]
                    .sort((a, b) => {
                      const pA = a.budget ? a.total / a.budget : -1;
                      const pB = b.budget ? b.total / b.budget : -1;
                      return pB - pA;
                    })
                    .map((cat) => {
                      const pct = cat.budget ? (cat.total / cat.budget) * 100 : 0;
                      return (
                        <div key={cat.name}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm flex items-center gap-1">
                              <span>{cat.icon}</span> {cat.name}
                            </span>
                            <div className="text-right">
                              <span className="text-sm font-medium">{fmt(cat.total)}</span>
                              {cat.budget && (
                                <>
                                  <span className="text-xs text-muted-foreground ml-1">/ {fmt(cat.budget)}</span>
                                  <Badge variant={pct > 100 ? "destructive" : "secondary"} className="ml-1 text-xs">
                                    {Math.round(pct)}%
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                          {cat.budget && (
                            <>
                              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                                <div
                                  className="h-full transition-all"
                                  style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pct > 100 ? "#ef4444" : cat.color }}
                                />
                              </div>
                              <p className={`text-right text-[10px] mt-0.5 ${pct > 100 ? "text-red-500" : "text-emerald-600"}`}>
                                {pct > 100 ? `${fmt(cat.total - cat.budget)} excedido` : `${fmt(cat.budget - cat.total)} disponibles`}
                              </p>
                            </>
                          )}
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            )}

            {/* Pedidos activos en dashboard */}
            {activeOrders.length > 0 && (
              <Card className="border-blue-100 bg-blue-50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-blue-800">{activeOrders.length} pedido{activeOrders.length !== 1 ? "s" : ""} activo{activeOrders.length !== 1 ? "s" : ""}</p>
                    <button className="text-xs text-blue-600 font-medium" onClick={() => handleTabChange("orders")}>Ver todos ›</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-xs text-blue-600">Valor total</p>
                      <p className="text-sm font-bold text-blue-800">{fmt(activeOrders.reduce((s, o) => s + Number(o.total_value), 0))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600">Por cobrar</p>
                      <p className="text-sm font-bold text-blue-800">{fmt(activeOrdersValue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Utilidad trend */}
            {(totalMonthIncome > 0 || totalMonthSpent > 0) && (
              <Card className={utilidad >= 0 ? "border-emerald-100 bg-emerald-50" : "border-rose-100 bg-rose-50"}>
                <CardContent className="pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Utilidad bruta del mes</p>
                    <p className={`text-xl font-bold ${utilidad >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{fmt(utilidad)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fmt(totalMonthIncome)} ingresos − {fmt(totalMonthSpent)} gastos
                    </p>
                  </div>
                  {utilidad >= 0
                    ? <TrendingUp className="w-8 h-8 text-emerald-400 shrink-0" />
                    : <TrendingDown className="w-8 h-8 text-rose-400 shrink-0" />
                  }
                </CardContent>
              </Card>
            )}

            {monthBudget && totalMonthSpent > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Presupuesto mensual global</span>
                    <span>{Math.round((totalMonthSpent / monthBudget.amount) * 100)}%</span>
                  </div>
                  <Progress value={Math.min((totalMonthSpent / monthBudget.amount) * 100, 100)} className="h-2" />
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ── Clientes ── */}
        {activeTab === "clients" && companyId && (
          <ClientsManager
            clients={clients}
            companyId={companyId}
            role={role ?? "employee"}
            onRefresh={fetchData}
            onRequestNew={clientFormSignal}
          />
        )}

        {/* ── Pedidos ── */}
        {activeTab === "orders" && companyId && (
          <OrdersManager
            orders={orders}
            clients={clients}
            companyId={companyId}
            role={role ?? "employee"}
            onRefresh={fetchData}
            onRequestNew={orderFormSignal}
          />
        )}

        {/* ── Gastos ── */}
        {activeTab === "expenses" && (
          <>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Button variant="ghost" size="icon" onClick={goToPrevExpenseMonth} className="h-8 w-8">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-semibold">{MONTHS[expenseMonth - 1]} {expenseYear}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToNextExpenseMonth}
                      disabled={expenseMonth === currentMonth && expenseYear === currentYear}
                      className="h-8 w-8"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => exportMonthlyCSV(expenses, budgets, categories, expenseMonth, expenseYear)}
                      className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
                      title="Exportar CSV"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <ExpenseList
                  expenses={expenses}
                  categories={categories}
                  accounts={accounts}
                  role={role ?? "employee"}
                  onRefresh={fetchData}
                  onEdit={role === "owner" ? setEditingExpense : undefined}
                />
              </CardContent>
            </Card>

            <button
              className="w-full flex items-center justify-between text-sm font-semibold text-muted-foreground py-1"
              onClick={() => setShowBudgetInExpenses((v) => !v)}
            >
              <span>Presupuestos</span>
              <span className="text-xs">{showBudgetInExpenses ? "Ocultar ▲" : "Mostrar ▼"}</span>
            </button>

            {showBudgetInExpenses && companyId && (
              <BudgetManager
                budgets={budgets}
                categories={categories}
                accounts={accounts}
                recurringIncome={recurringIncome}
                income={income}
                onRefresh={fetchData}
                onManageCategories={() => setShowCategories(true)}
                currentMonth={currentMonth}
                currentYear={currentYear}
                companyId={companyId}
                role={role ?? "employee"}
              />
            )}
          </>
        )}

        {/* ── Finanzas ── */}
        {activeTab === "finance" && companyId && (
          <>
            <AccountsManager
              accounts={accounts}
              income={income}
              recurringIncome={recurringIncome}
              companyId={companyId}
              role={role ?? "employee"}
              disponible={disponible}
              unlinkedMonthTotal={unlinkedMonthTotal}
              onRefresh={fetchData}
            />
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Deudas</p>
              <DebtManager
                debts={debts}
                companyId={companyId}
                role={role ?? "employee"}
                onRefresh={fetchData}
              />
            </div>
          </>
        )}

      </div>

      {/* FAB */}
      {fabConfig && (
        <div className="fixed bottom-[76px] right-4 z-50">
          <button
            className="flex items-center gap-2 bg-emerald-600 active:bg-emerald-800 text-white rounded-full pl-4 pr-5 py-3 shadow-lg active:scale-95 transition-transform"
            onClick={fabConfig.action}
          >
            <PlusCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold">{fabConfig.label}</span>
          </button>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] flex">
        {TABS.map(({ value, label, Icon }) => (
          <button
            key={value}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
              activeTab === value ? "text-emerald-600" : "text-gray-400"
            }`}
            onClick={() => handleTabChange(value)}
          >
            <Icon className={`w-5 h-5 ${activeTab === value ? "stroke-[2.2px]" : ""}`} />
            <span className="text-[10px] font-medium leading-tight">{label}</span>
          </button>
        ))}
      </nav>

      {/* Expense form sheet */}
      {(showForm || editingExpense !== null) && companyId && (
        <ExpenseForm
          categories={categories}
          accounts={accounts}
          companyId={companyId}
          editingExpense={editingExpense}
          onClose={() => { setShowForm(false); setEditingExpense(null); }}
          onSaved={() => { setShowForm(false); setEditingExpense(null); fetchData(); }}
        />
      )}

      {/* Category manager sheet */}
      {showCategories && companyId && (
        <CategoryManager
          categories={categories}
          companyId={companyId}
          role={role ?? "employee"}
          onClose={() => setShowCategories(false)}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
}
