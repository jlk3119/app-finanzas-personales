"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { createClient } from "@/utils/supabase/client";
import type { Expense, Budget, Category, Goal, Account, Income, RecurringIncome, MonthClosure, Debt } from "@/types";
import { getCurrentPayPeriod, getCustomPayPeriod } from "@/utils/colombian-holidays";
import { getDefaultBudgetMonth } from "@/utils/budget-month";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { PlusCircle, Target, TrendingDown, Wallet, Settings, Landmark, Trophy, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, EyeOff } from "lucide-react";
import { exportMonthlyCSV } from "@/utils/exportCSV";
import ExpenseForm from "@/components/ExpenseForm";
import ExpenseList from "@/components/ExpenseList";
import BudgetManager from "@/components/BudgetManager";
import GoalsList from "@/components/GoalsList";
import DebtManager from "@/components/DebtManager";
import CategoryManager from "@/components/CategoryManager";
import AccountsManager from "@/components/AccountsManager";
import MonthClosureCard from "@/components/MonthClosureCard";
import SettingsSheet from "@/components/SettingsSheet";
import SuggestionsSheet from "@/components/SuggestionsSheet";
import { usePrivacy } from "@/components/PrivacyProvider";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

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
  const reduceMotion = useReducedMotion();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dashboardExpenses, setDashboardExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [recurringIncome, setRecurringIncome] = useState<RecurringIncome[]>([]);
  const [monthClosures, setMonthClosures] = useState<MonthClosure[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>("dashboard");
  const [expenseMonth, setExpenseMonth] = useState(() => new Date().getMonth() + 1);
  const [expenseYear, setExpenseYear] = useState(() => new Date().getFullYear());
  const [summaryMonth, setSummaryMonth] = useState(() => new Date().getMonth() + 1);
  const [summaryYear, setSummaryYear] = useState(() => new Date().getFullYear());
  const [showClosurePanel, setShowClosurePanel] = useState(false);
  const summaryTouchedRef = useRef(false);
  const summaryDefaultAppliedRef = useRef(false);

  useBackButtonClose(showForm, () => setShowForm(false));
  useBackButtonClose(editingExpense !== null, () => setEditingExpense(null));
  useBackButtonClose(showCategories, () => setShowCategories(false));
  useBackButtonClose(showSettings, () => setShowSettings(false));
  useBackButtonClose(showSuggestions, () => setShowSuggestions(false));

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentWeek = getWeekNumber(now);
  const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
  const summaryMonthKey = `${summaryYear}-${String(summaryMonth).padStart(2, "0")}`;
  const isLiveMonth = summaryMonth === currentMonth && summaryYear === currentYear;

  const checkAutoAssign = useCallback(async (
    recurData: RecurringIncome[],
    incData: Income[],
    accData: Account[],
  ): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const today = new Date();
    const todayYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const toAssign = recurData.filter((r) => {
      if (!r.auto_assign) return false;
      if (!r.start_date) return true;
      return r.start_date.slice(0, 7) <= todayYM;
    });
    if (toAssign.length === 0) return false;
    let anyAssigned = false;
    const balanceDelta = new Map<string, number>();

    for (const r of toAssign) {
      const period = r.is_salary
        ? getCurrentPayPeriod(r.frequency, today)
        : r.day_of_month
          ? getCustomPayPeriod(r.frequency, today, r.day_of_month)
          : null;
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
    const nowObj = new Date();
    const curM = nowObj.getMonth() + 1;
    const curY = nowObj.getFullYear();

    // Ventana hacia atrás para permitir navegar el Resumen por meses anteriores.
    const windowStart = new Date(curY, curM - 1 - 6, 1);
    const windowStartKey = `${windowStart.getFullYear()}-${String(windowStart.getMonth() + 1).padStart(2, "0")}`;
    const startOfWindowStr = `${windowStartKey}-01`;

    const expMonthKey = `${expenseYear}-${String(expenseMonth).padStart(2, "0")}`;

    const [expRes, dashExpRes, budRes, catRes, goalRes, accRes, incRes, recurRes, closuresRes, debtRes] = await Promise.all([
      supabase.from("expenses").select("*, categories(*), accounts(*)").eq("budget_period", expMonthKey).order("date", { ascending: false }),
      supabase.from("expenses").select("*, categories(*), accounts(*)").gte("budget_period", windowStartKey).order("date", { ascending: false }),
      supabase.from("budgets").select("*, categories(*)"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("goals").select("*, categories(*)").order("created_at", { ascending: false }),
      supabase.from("accounts").select("*").order("created_at"),
      supabase.from("income").select("*, accounts(*)").gte("date", startOfWindowStr).order("date", { ascending: false }),
      supabase.from("recurring_income").select("*, accounts(*)").order("created_at"),
      supabase.from("month_closures").select("*"),
      supabase.from("debts").select("*").order("created_at", { ascending: false }),
    ]);

    const expData = (expRes.data ?? []) as Expense[];
    const dashExpData = (dashExpRes.data ?? []) as Expense[];
    const budData = (budRes.data ?? []) as Budget[];
    const accData = (accRes.data ?? []) as Account[];
    const incData = (incRes.data ?? []) as Income[];
    const recurData = (recurRes.data ?? []) as RecurringIncome[];
    const goalData = (goalRes.data ?? []) as Goal[];
    const closuresData = (closuresRes.data ?? []) as MonthClosure[];
    const debtData = (debtRes.data ?? []) as Debt[];

    setExpenses(expData);
    setDashboardExpenses(dashExpData);
    setBudgets(budData);

    let finalCategories = (catRes.data ?? []) as Category[];
    if (catRes.data) {
      if (!finalCategories.some((c) => c.is_system)) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("categories").insert({
            user_id: user.id, name: "Caja menor", icon: "💵", color: "#10b981", is_system: true,
          });
          const { data: updated } = await supabase.from("categories").select("*").order("name");
          if (updated) {
            finalCategories = updated as Category[];
            setCategories(finalCategories);
          }
        }
      } else {
        setCategories(finalCategories);
      }
    }

    setGoals(goalData);
    setMonthClosures(closuresData);
    setDebts(debtData);
    setAccounts(accData);
    setIncome(incData);
    setRecurringIncome(recurData);

    let finalAccData = accData;
    let finalIncData = incData;

    const assigned = await checkAutoAssign(recurData, incData, accData);
    if (assigned) {
      const [accRefresh, incRefresh] = await Promise.all([
        supabase.from("accounts").select("*").order("created_at"),
        supabase.from("income").select("*, accounts(*)").gte("date", startOfWindowStr).order("date", { ascending: false }),
      ]);
      if (accRefresh.data) {
        finalAccData = accRefresh.data as Account[];
        setAccounts(finalAccData);
      }
      if (incRefresh.data) {
        finalIncData = incRefresh.data as Income[];
        setIncome(finalIncData);
      }
    }

    // Save to cache
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "misfinanzas_cache",
          JSON.stringify({
            expenses: expData,
            dashboardExpenses: dashExpData,
            budgets: budData,
            categories: finalCategories,
            goals: goalData,
            accounts: finalAccData,
            income: finalIncData,
            recurringIncome: recurData,
            monthClosures: closuresData,
            debts: debtData,
          })
        );
      } catch (e) {
        console.error("Failed to save offline cache:", e);
      }
    }

    setLoading(false);
  }, [supabase, checkAutoAssign, expenseMonth, expenseYear]);

  /* eslint-disable react-hooks/set-state-in-effect */
  // Restore cache on mount to support offline rendering
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("misfinanzas_cache");
        if (cached) {
          const data = JSON.parse(cached);
          if (data.expenses) setExpenses(data.expenses);
          if (data.dashboardExpenses) setDashboardExpenses(data.dashboardExpenses);
          if (data.budgets) setBudgets(data.budgets);
          if (data.categories) setCategories(data.categories);
          if (data.goals) setGoals(data.goals);
          if (data.accounts) setAccounts(data.accounts);
          if (data.income) setIncome(data.income);
          if (data.recurringIncome) setRecurringIncome(data.recurringIncome);
          if (data.monthClosures) setMonthClosures(data.monthClosures);
          if (data.debts) setDebts(data.debts);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to load offline cache:", e);
      }
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, [fetchData]);

  // Mes por defecto del Resumen = mes no cerrado más reciente. Se aplica una sola vez
  // tras el primer fetch real y nunca pisa la navegación manual del usuario.
  useEffect(() => {
    if (loading || summaryTouchedRef.current || summaryDefaultAppliedRef.current) return;
    const def = getDefaultBudgetMonth(monthClosures, new Date());
    setSummaryMonth(def.month);
    setSummaryYear(def.year);
    summaryDefaultAppliedRef.current = true;
  }, [loading, monthClosures]);

  // Al cambiar de mes en el Resumen, ocultar el panel de cierre para que no se filtre.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowClosurePanel(false);
  }, [summaryMonth, summaryYear]);

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
    if (expenseMonth === 1) {
      setExpenseMonth(12);
      setExpenseYear((y) => y - 1);
    } else {
      setExpenseMonth((m) => m - 1);
    }
  };

  const isNextExpenseMonthDisabled = (() => {
    const nextM = expenseMonth === 12 ? 1 : expenseMonth + 1;
    const nextY = expenseMonth === 12 ? expenseYear + 1 : expenseYear;
    const limitM = currentMonth === 12 ? 1 : currentMonth + 1;
    const limitY = currentMonth === 12 ? currentYear + 1 : currentYear;
    return nextY > limitY || (nextY === limitY && nextM > limitM);
  })();

  const goToNextExpenseMonth = () => {
    if (isNextExpenseMonthDisabled) return;
    if (expenseMonth === 12) {
      setExpenseMonth(1);
      setExpenseYear((y) => y + 1);
    } else {
      setExpenseMonth((m) => m + 1);
    }
  };

  const goToPrevSummaryMonth = () => {
    summaryTouchedRef.current = true;
    if (summaryMonth === 1) {
      setSummaryMonth(12);
      setSummaryYear((y) => y - 1);
    } else {
      setSummaryMonth((m) => m - 1);
    }
  };

  const isNextSummaryMonthDisabled = (() => {
    const nextM = summaryMonth === 12 ? 1 : summaryMonth + 1;
    const nextY = summaryMonth === 12 ? summaryYear + 1 : summaryYear;
    // Permitir ver meses futuros (el usuario gasta el presupuesto del mes siguiente),
    // con un tope de mes actual + 2 o el mes por defecto, lo que sea mayor.
    const defM = getDefaultBudgetMonth(monthClosures, now);
    const cap = new Date(currentYear, currentMonth - 1 + 2, 1);
    const defDate = new Date(defM.year, defM.month - 1, 1);
    const limitDate = defDate > cap ? defDate : cap;
    const nextDate = new Date(nextY, nextM - 1, 1);
    return nextDate > limitDate;
  })();

  const goToNextSummaryMonth = () => {
    if (isNextSummaryMonthDisabled) return;
    summaryTouchedRef.current = true;
    if (summaryMonth === 12) {
      setSummaryMonth(1);
      setSummaryYear((y) => y + 1);
    } else {
      setSummaryMonth((m) => m + 1);
    }
  };

  const handleSummaryClosed = () => {
    summaryTouchedRef.current = true;
    setMonthClosures((prev) => [...prev, { id: "", user_id: "", year: summaryYear, month: summaryMonth, closed_at: "" }]);
    if (summaryMonth === 12) {
      setSummaryMonth(1);
      setSummaryYear((y) => y + 1);
    } else {
      setSummaryMonth((m) => m + 1);
    }
  };

  const handleTabChange = (value: TabValue) => {
    setActiveTab(value);
    window.history.pushState({}, "", `?tab=${value}`);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    location.href = "/login";
  };

  const thisMonthExpenses = dashboardExpenses.filter((e) => e.budget_period === summaryMonthKey);

  const thisWeekExpenses = dashboardExpenses.filter((e) => {
    const d = new Date(e.date + "T12:00:00");
    return getWeekNumber(d) === currentWeek && d.getFullYear() === currentYear;
  });

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const totalToday = dashboardExpenses.filter((e) => e.date === todayStr).reduce((s, e) => s + Number(e.amount), 0);
  const totalWeek = thisWeekExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalMonth = thisMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const monthBudget = budgets.find((b) => b.period === "monthly" && b.category_id === null && b.year === summaryYear && b.month === summaryMonth);
  const weekBudget = budgets.find((b) => b.period === "weekly" && b.category_id === null && b.year === currentYear && b.week === currentWeek);

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  // Gastos sin cuenta asignada no descuentan de ningún balance → restarlos explícitamente
  const unlinkedMonthTotal = dashboardExpenses
    .filter((e) => {
      const d = new Date(e.date + "T12:00:00");
      return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear && !e.account_id;
    })
    .reduce((s, e) => s + Number(e.amount), 0);
  // Ingresos esporádicos asignados a meses futuros ya están en el saldo de la cuenta,
  // pero aún no deben contarse como dinero disponible para el mes en curso
  const futureSporadicLinked = income
    .filter((i) => !i.recurring_income_id && !!i.period_key && i.period_key > currentMonthKey && !!i.account_id)
    .reduce((s, i) => s + Number(i.amount), 0);
  const disponible = totalBalance - unlinkedMonthTotal - futureSporadicLinked;

  const summaryMonthClosed = monthClosures.some((c) => c.year === summaryYear && c.month === summaryMonth);
  // Se puede cerrar cualquier mes no cerrado aún, incluso sin gastos ni presupuesto.
  const canCloseSummary = !summaryMonthClosed;

  const FREQ_MULT: Record<string, number> = { monthly: 1, biweekly: 2, weekly: 4 };
  const activeRecurring = recurringIncome.filter((r) => {
    if (!r.start_date) return true;
    const [sy, sm] = r.start_date.split("-").map(Number);
    return summaryYear > sy || (summaryYear === sy && summaryMonth >= sm);
  });
  const sporadicForMonth = income.filter((i) => !i.recurring_income_id && i.period_key === summaryMonthKey);
  const recurringTotal = activeRecurring.reduce((s, r) => s + Number(r.amount) * (FREQ_MULT[r.frequency] ?? 1), 0);
  const sporadicTotal = sporadicForMonth.reduce((s, i) => s + Number(i.amount), 0);
  const expectedIncome = recurringTotal + sporadicTotal;

  const budgetAllocation = categories
    .filter((c) => !c.parent_id)
    .map((cat) => {
      const b = budgets.find((bg) => bg.category_id === cat.id && bg.period === "monthly" && bg.year === summaryYear && bg.month === summaryMonth);
      if (!b) return null;
      return { name: cat.name, icon: cat.icon, color: cat.color, amount: Number(b.amount) };
    })
    .filter((c): c is { name: string; icon: string; color: string; amount: number } => c !== null)
    .sort((a, b) => b.amount - a.amount);
  const totalBudgetAllocated = budgetAllocation.reduce((s, b) => s + b.amount, 0);
  const unassignedIncome = Math.max(0, expectedIncome - totalBudgetAllocated);

  const childrenOf = (pid: string) => categories.filter((c) => c.parent_id === pid);
  const categorySpend = categories
    .filter((c) => !c.parent_id)
    .map((cat) => {
      const subs = childrenOf(cat.id);
      const allIds = [cat.id, ...subs.map((s) => s.id)];
      // Caja menor (categoría de sistema) usa el margen libre como presupuesto dinámico.
      const explicitBudget = budgets.find((b) => b.category_id === cat.id && b.period === "monthly" && b.year === summaryYear && b.month === summaryMonth)?.amount;
      const budget = cat.is_system
        ? (unassignedIncome > 0 ? unassignedIncome : undefined)
        : explicitBudget;
      return {
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        total: thisMonthExpenses.filter((e) => allIds.includes(e.category_id ?? "")).reduce((s, e) => s + Number(e.amount), 0),
        budget,
      };
    })
    .filter((c) => c.total > 0);

  const { hidden: amountsHidden, toggle: toggleAmounts, fmt } = usePrivacy();

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

  const fabVisible = activeTab === "dashboard" || activeTab === "expenses";

  return (
    <div className="min-h-screen lg:flex lg:bg-surface-container-low">
      {/* Sidebar de navegación — solo escritorio */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen border-r border-outline-variant bg-surface px-3 py-6">
        <div className="px-3 mb-6">
          <h1 className="text-xl font-bold tracking-tight">💸 MisFinanzas</h1>
        </div>
        <nav aria-label="Navegación principal" className="flex flex-col gap-1">
          {TABS.map(({ value, label, Icon }) => {
            const active = activeTab === value;
            return (
              <button
                key={value}
                onClick={() => handleTabChange(value)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-secondary-container text-on-secondary-container"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "stroke-[2.2px]" : ""}`} />
                {label}
              </button>
            );
          })}
        </nav>
        <button
          onClick={() => setShowSettings(true)}
          className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <Settings className="w-5 h-5" />
          Configuración
        </button>
      </aside>

      {/* Columna principal */}
      <div className={`flex-1 min-w-0 ${fabVisible ? "pb-40" : "pb-24"} lg:pb-10`}>
        <div className="lg:max-w-5xl lg:mx-auto lg:px-6">
      {/* Header */}
      <div className="bg-primary text-on-primary px-4 pt-10 pb-6 rounded-b-3xl shadow-e2 lg:rounded-3xl lg:mt-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">💸 MisFinanzas</h1>
            <p className="text-on-primary/70 text-sm">{now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={amountsHidden ? "Mostrar montos" : "Ocultar montos"}
              aria-pressed={amountsHidden}
              onClick={toggleAmounts}
              className="text-on-primary hover:bg-on-primary/20"
            >
              {amountsHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Configuración" onClick={() => setShowSettings(true)} className="text-on-primary hover:bg-on-primary/20">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="bg-on-primary/15 rounded-2xl p-3 text-center">
            <p className="text-xs text-on-primary/70">Hoy</p>
            <p className="font-bold text-sm">{fmt(totalToday)}</p>
          </div>
          <div className="bg-on-primary/15 rounded-2xl p-3 text-center">
            <p className="text-xs text-on-primary/70">Semana</p>
            <p className="font-bold text-sm">{fmt(totalWeek)}</p>
            {weekBudget && <p className="text-xs text-on-primary/60">/ {fmt(weekBudget.amount)}</p>}
          </div>
          <div className="bg-on-primary/15 rounded-2xl p-3 text-center">
            <p className="text-xs text-on-primary/70">{isLiveMonth ? "Mes" : `Mes · ${MONTHS[summaryMonth - 1].slice(0, 3)}`}</p>
            <p className="font-bold text-sm">{fmt(totalMonth)}</p>
            {monthBudget && <p className="text-xs text-on-primary/60">/ {fmt(monthBudget.amount)}</p>}
          </div>
        </div>

        {accounts.length > 0 && (
          <div className={`mt-2 rounded-2xl px-4 py-2.5 flex items-center justify-between ${disponible >= 0 ? "bg-on-primary/10" : "bg-error/40"}`}>
            <div>
              <p className="text-xs text-on-primary/70">Disponible total</p>
              <p className="text-[10px] text-on-primary/60">
                {unlinkedMonthTotal > 0
                  ? `saldo en cuentas − ${fmt(unlinkedMonthTotal)} sin cuenta`
                  : "saldo real en cuentas"}
              </p>
            </div>
            <p className={`font-bold text-base ${disponible < 0 ? "text-on-error-container" : "text-on-primary"}`}>{fmt(disponible)}</p>
          </div>
        )}

        {monthBudget && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-on-primary/70 mb-1">
              <span>Presupuesto mensual</span>
              <span>{Math.round((totalMonth / monthBudget.amount) * 100)}%</span>
            </div>
            <Progress value={Math.min((totalMonth / monthBudget.amount) * 100, 100)} className="h-2 bg-on-primary/30" />
          </div>
        )}
      </div>

      {/* Contenido por pestaña */}
      <div className="px-4 mt-4 space-y-4">
        <div className={`space-y-4 ${activeTab !== "dashboard" ? "hidden" : ""}`}>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={goToPrevSummaryMonth} className="h-8 w-8">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-semibold">
                {MONTHS[summaryMonth - 1]} {summaryYear}{!isLiveMonth && " · presupuesto"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextSummaryMonth}
                disabled={isNextSummaryMonthDisabled}
                className="h-8 w-8"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {canCloseSummary && !showClosurePanel && (
              <Button
                variant="outline"
                className="w-full text-primary"
                onClick={() => setShowClosurePanel(true)}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" /> Cerrar mes de {MONTHS[summaryMonth - 1]}
              </Button>
            )}

            {showClosurePanel && (
              <MonthClosureCard
                prevYear={summaryYear}
                prevMonth={summaryMonth}
                budgetPeriod={summaryMonthKey}
                expenses={dashboardExpenses}
                categories={categories}
                budgets={budgets}
                goals={goals}
                income={income}
                onClose={() => { setShowClosurePanel(false); handleSummaryClosed(); }}
                onRefresh={fetchData}
              />
            )}
            {(() => {
              const s1 = accounts.length > 0;
              const s2 = recurringIncome.length > 0;
              const s3 = budgets.some((b) => b.period === "monthly");
              if (s1 && s2 && s3) return null;
              const steps = [
                { done: s1, label: "Agrega tu cuenta bancaria",   desc: "Registra dónde guardas tu dinero",               tab: "accounts" as TabValue },
                { done: s2, label: "Configura tus ingresos",      desc: "Salario u otros ingresos fijos del mes",         tab: "accounts" as TabValue },
                { done: s3, label: "Crea tu presupuesto mensual", desc: "Pon un límite a lo que puedes gastar",           tab: "budget"   as TabValue },
              ];
              const doneCount = steps.filter((s) => s.done).length;
              return (
                <Card className="bg-primary-container">
                  <CardContent className="pt-5 pb-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold text-on-primary-container">
                          {doneCount === 0 ? "👋 ¡Bienvenido a MisFinanzas!" : "Configuración inicial"}
                        </h2>
                        <p className="text-xs text-on-primary-container/80 mt-0.5">{doneCount} de 3 pasos completados</p>
                      </div>
                      <div className="flex gap-1">
                        {steps.map((s, i) => (
                          <div key={i} className={`w-2 h-2 rounded-full ${s.done ? "bg-success" : "bg-on-primary-container/30"}`} />
                        ))}
                      </div>
                    </div>
                    <ol className="space-y-2">
                      {steps.map((step, i) => step.done ? (
                        <li key={i} className="flex items-center gap-2.5 bg-surface-container-lowest/60 rounded-xl px-3 py-2.5">
                          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                          <p className="text-sm text-on-success-container line-through">{step.label}</p>
                        </li>
                      ) : (
                        <li key={i}>
                          <button
                            className="w-full flex items-center gap-2.5 bg-surface-container-lowest rounded-xl px-3 py-2.5 shadow-e1 text-left active:bg-primary-container transition-colors"
                            onClick={() => handleTabChange(step.tab)}
                          >
                            <span className="w-5 h-5 rounded-full bg-primary text-on-primary font-bold text-[10px] flex items-center justify-center shrink-0">{i + 1}</span>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-on-surface">{step.label}</p>
                              <p className="text-xs text-muted-foreground">{step.desc}</p>
                            </div>
                            <span className="ml-auto text-on-surface-variant text-base shrink-0">›</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              );
            })()}
            <div className="lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start space-y-4 lg:space-y-0">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Presupuesto del mes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categorySpend.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin gastos este mes aún. ¡Agrega tu primer gasto!</p>
                )}
                {[...categorySpend]
                  .sort((a, b) => {
                    const pctA = a.budget ? a.total / a.budget : Infinity;
                    const pctB = b.budget ? b.total / b.budget : Infinity;
                    return pctA - pctB;
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
                              <span className="text-xs text-muted-foreground ml-1">/ {fmt(cat.budget)}</span>
                            )}
                            {cat.budget && (
                              <Badge variant={pct > 100 ? "destructive" : "secondary"} className="ml-1 text-xs">
                                {Math.round(pct)}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        {cat.budget && (
                          <>
                            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full transition-all"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  backgroundColor: pct > 100 ? "var(--md-error)" : cat.color,
                                }}
                              />
                            </div>
                            <p className={`text-right text-[10px] mt-0.5 ${pct > 100 ? "text-error" : "text-success"}`}>
                              {pct > 100
                                ? `${fmt(cat.total - cat.budget)} excedido`
                                : `${fmt(cat.budget - cat.total)} disponibles`}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })}
              </CardContent>
            </Card>

            {expectedIncome > 0 && budgetAllocation.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Distribución del presupuesto</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {budgetAllocation.map((b) => {
                      const pct = (b.amount / expectedIncome) * 100;
                      return (
                        <div key={b.name} className="flex items-center justify-between">
                          <span className="text-sm flex items-center gap-2">
                            <span className="text-base">{b.icon}</span>
                            <span>{b.name}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{fmt(b.amount)}</span>
                            <span className="text-xs font-semibold w-10 text-right" style={{ color: b.color }}>
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="border-t pt-2 mt-2 flex items-center justify-between text-muted-foreground">
                      <span className="text-sm italic">Sin asignar</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{fmt(unassignedIncome)}</span>
                        <span className="text-xs font-semibold w-10 text-right">
                          {((unassignedIncome / expectedIncome) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            </div>
        </div>

        {activeTab === "expenses" && (
          <motion.div
            key="tab-expenses"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          >
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
                    disabled={isNextExpenseMonthDisabled}
                    className="h-8 w-8"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      exportMonthlyCSV(expenses, budgets, categories, expenseMonth, expenseYear)
                        .catch((e) => console.error("Error al exportar CSV:", e));
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    title="Exportar CSV"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <ExpenseList expenses={expenses} categories={categories} accounts={accounts} onRefresh={fetchData} onEdit={setEditingExpense} />
            </CardContent>
          </Card>
          </motion.div>
        )}

        {activeTab === "budget" && (
          <motion.div
            key="tab-budget"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          >
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
          />
          </motion.div>
        )}

        {activeTab === "goals" && (
          <motion.div
            key="tab-goals"
            className="space-y-6"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          >
            <GoalsList goals={goals} categories={categories} onRefresh={fetchData} />
            <div>
              <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide mb-3">Deudas</h2>
              <DebtManager debts={debts} onRefresh={fetchData} />
            </div>
          </motion.div>
        )}

        {activeTab === "accounts" && (
          <motion.div
            key="tab-accounts"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          >
          <AccountsManager
            accounts={accounts}
            income={income}
            recurringIncome={recurringIncome}
            disponible={disponible}
            unlinkedMonthTotal={unlinkedMonthTotal}
            onRefresh={fetchData}
          />
          </motion.div>
        )}
      </div>
        </div>
      </div>

      {/* FAB — solo en Resumen y Gastos */}
      <AnimatePresence>
        {fabVisible && (
          <motion.div
            className="fixed bottom-[88px] right-4 z-50 lg:bottom-8 lg:right-8"
            initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <motion.button
              className="flex items-center gap-2 bg-primary-container text-on-primary-container rounded-2xl pl-4 pr-5 py-4 shadow-e3"
              whileTap={{ scale: 0.94, borderRadius: 28 }}
              onClick={() => setShowForm(true)}
            >
              <PlusCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-semibold">Nuevo gasto</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de navegación inferior — MD3 Navigation Bar (solo móvil) */}
      <nav aria-label="Navegación" className="fixed bottom-0 inset-x-0 z-40 bg-surface-container shadow-e2 flex h-20 pb-2 lg:hidden">
        {TABS.map(({ value, label, Icon }) => {
          const active = activeTab === value;
          return (
            <button
              key={value}
              className="flex-1 flex flex-col items-center justify-center gap-1 pt-3"
              onClick={() => handleTabChange(value)}
            >
              <span className="relative flex items-center justify-center w-16 h-8">
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-secondary-container"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon className={`relative w-5 h-5 transition-colors ${active ? "text-on-secondary-container stroke-[2.2px]" : "text-on-surface-variant"}`} />
              </span>
              <span className={`text-[11px] font-medium leading-tight transition-colors ${active ? "text-on-surface" : "text-on-surface-variant"}`}>{label}</span>
            </button>
          );
        })}
      </nav>

      {(showForm || editingExpense !== null) && (
        <ExpenseForm
          categories={categories}
          accounts={accounts}
          editingExpense={editingExpense}
          onClose={() => { setShowForm(false); setEditingExpense(null); }}
          onSaved={() => { setShowForm(false); setEditingExpense(null); fetchData(); }}
        />
      )}

      {showCategories && (
        <CategoryManager
          categories={categories}
          onClose={() => setShowCategories(false)}
          onRefresh={fetchData}
        />
      )}

      {showSettings && (
        <SettingsSheet
          onClose={() => setShowSettings(false)}
          onManageCategories={() => setShowCategories(true)}
          onOpenSuggestions={() => { setShowSettings(false); setShowSuggestions(true); }}
          onSignOut={signOut}
        />
      )}

      {showSuggestions && (
        <SuggestionsSheet onClose={() => setShowSuggestions(false)} />
      )}
    </div>
  );
}
