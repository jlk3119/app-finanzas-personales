"use client";

import { useState } from "react";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { createClient } from "@/utils/supabase/client";
import type { Budget, Category, Account, RecurringIncome, Income } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus, Settings2, ChevronLeft, ChevronRight, ChevronDown, Copy, Info, Check, X } from "lucide-react";

type Props = {
  budgets: Budget[];
  categories: Category[];
  accounts: Account[];
  recurringIncome: RecurringIncome[];
  income: Income[];
  companyId: string;
  role: "owner" | "employee";
  onRefresh: () => void;
  onManageCategories: () => void;
  currentMonth: number;
  currentYear: number;
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

const FREQ_MULTIPLIER: Record<string, number> = { monthly: 1, biweekly: 2, weekly: 4 };
const FREQ_LABEL: Record<string, string> = { monthly: "mensual", biweekly: "quincenal ×2", weekly: "semanal ×4" };

export default function BudgetManager({ budgets, categories, accounts, recurringIncome, income, companyId, role, onRefresh, onManageCategories, currentMonth, currentYear }: Props) {
  const supabase = createClient();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showForm, setShowForm] = useState(false);
  const [categoryId, setCategoryId] = useState("global");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCajaInfo, setShowCajaInfo] = useState(false);
  const [subAmounts, setSubAmounts] = useState<Record<string, string>>({});
  const [extraSubs, setExtraSubs] = useState<Category[]>([]);
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [newSubAmount, setNewSubAmount] = useState("");
  const [addingSubLoading, setAddingSubLoading] = useState(false);
  const [othersAmount, setOthersAmount] = useState("");
  const [collapsedBudgets, setCollapsedBudgets] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingBudget, setDeletingBudget] = useState(false);
  const confirmBudget = confirmDeleteId ? budgets.find((b) => b.id === confirmDeleteId) : null;
  const confirmBudgetCat = confirmBudget?.category_id ? categories.find((c) => c.id === confirmBudget.category_id) : null;
  const toggleCollapse = (id: string) => setCollapsedBudgets((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const closeForm = () => {
    setShowForm(false); setEditingId(null); setAmount(""); setSubAmounts({});
    setCategoryId("global"); setExtraSubs([]); setShowAddSub(false);
    setNewSubName(""); setNewSubAmount(""); setOthersAmount("");
  };

  useBackButtonClose(showForm, closeForm);

  // Build ordered list: parents first, then their children
  const topCats = categories.filter((c) => !c.parent_id);
  const subsOf = (pid: string) => categories.filter((c) => c.parent_id === pid);
  const orderedCats = topCats.flatMap((c) => [c, ...subsOf(c.id)]);

  const subsOfSelected = categoryId !== "global" ? subsOf(categoryId) : [];
  const allSubsInForm = [...subsOfSelected, ...extraSubs];

  const preloadSubAmounts = (parentCatId: string) => {
    const subs = parentCatId !== "global" ? subsOf(parentCatId) : [];
    const pool = monthlyBudgets;
    const next: Record<string, string> = {};
    let subTotal = 0;
    subs.forEach((sub) => {
      const existing = pool.find((b) => b.category_id === sub.id);
      if (existing) { next[sub.id] = String(existing.amount); subTotal += Number(existing.amount); }
    });
    setSubAmounts(next);
    if (parentCatId !== "global") {
      const parentBud = pool.find((b) => b.category_id === parentCatId);
      const diff = parentBud ? Number(parentBud.amount) - subTotal : 0;
      setOthersAmount(diff > 0 ? String(diff) : "");
    } else {
      setOthersAmount("");
    }
  };

  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId);
    setExtraSubs([]); setShowAddSub(false); setNewSubName(""); setNewSubAmount(""); setOthersAmount("");
    preloadSubAmounts(newCatId);
  };

  // Excluir subcategorías del total para evitar doble conteo (el padre ya incluye su monto)
  const isRootBudget = (b: Budget) => {
    if (!b.category_id) return true;
    const cat = categories.find((c) => c.id === b.category_id);
    return !cat?.parent_id;
  };

  const categoryItems: Record<string, string> = {
    global: "🌐 Total general",
    ...Object.fromEntries(topCats.map((c) => [c.id, `${c.icon} ${c.name}`])),
  };

  const monthlyBudgets = budgets.filter((b) =>
    b.period === "monthly" && b.year === selectedYear && b.month === selectedMonth
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
    const subTotal = Object.values(subAmounts).reduce((s, v) => s + (Number(v) || 0), 0);
    const hasSubcategories = allSubsInForm.length > 0;
    const finalAmount = hasSubcategories ? subTotal + (Number(othersAmount) || 0) : Number(amount);
    if (finalAmount <= 0) return;
    setLoading(true);

    const baseRow = {
      company_id: companyId,
      period: "monthly" as const,
      category_id: categoryId === "global" ? null : categoryId,
      amount: finalAmount,
      year: selectedYear,
      month: selectedMonth,
      week: null,
    };

    if (editingId) {
      await supabase.from("budgets").update({ amount: finalAmount }).eq("id", editingId);
    } else {
      // Delete any existing record first (upsert with NULL keys is unreliable in PostgreSQL)
      let delParent = supabase.from("budgets").delete()
        .eq("company_id", companyId)
        .eq("period", "monthly")
        .eq("year", selectedYear)
        .eq("month", selectedMonth)
        .is("week", null);
      if (baseRow.category_id) delParent = delParent.eq("category_id", baseRow.category_id);
      else delParent = delParent.is("category_id", null);
      await delParent;
      await supabase.from("budgets").insert(baseRow);
    }

    // Save sub-budgets: delete existing then insert fresh to avoid NULL-key upsert duplicates
    const subEntries = Object.entries(subAmounts).filter(([, v]) => Number(v) > 0);
    if (subEntries.length > 0) {
      const subCatIds = subEntries.map(([id]) => id);
      await supabase.from("budgets").delete()
        .in("category_id", subCatIds)
        .eq("company_id", companyId)
        .eq("period", "monthly")
        .eq("year", selectedYear)
        .eq("month", selectedMonth)
        .is("week", null);

      await supabase.from("budgets").insert(
        subEntries.map(([subCatId, subAmt]) => ({
          company_id: companyId,
          period: "monthly" as const,
          category_id: subCatId,
          amount: Number(subAmt),
          year: selectedYear,
          month: selectedMonth,
          week: null,
        }))
      );
    }

    setShowForm(false); setAmount(""); setCategoryId("global"); setSubAmounts({});
    setEditingId(null); setExtraSubs([]); setShowAddSub(false);
    setNewSubName(""); setNewSubAmount(""); setOthersAmount("");
    setLoading(false);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    setDeletingBudget(true);
    await supabase.from("budgets").delete().eq("id", id);
    setDeletingBudget(false);
    onRefresh();
  };

  const startEdit = (b: Budget) => {
    const cat = b.category_id ? categories.find((c) => c.id === b.category_id) : null;

    // Subcategory → redirect to editing the parent budget
    if (cat?.parent_id) {
      const parentBudget = monthlyBudgets.find((pb) => pb.category_id === cat.parent_id);
      if (parentBudget) {
        startEdit(parentBudget);
        return;
      }
      // Parent budget doesn't exist yet — open new form with parent pre-selected
      setEditingId(null); setAmount(""); setExtraSubs([]); setShowAddSub(false);
      setNewSubName(""); setNewSubAmount(""); setOthersAmount("");
      setCategoryId(cat.parent_id);
      preloadSubAmounts(cat.parent_id);
      setShowForm(true);
      return;
    }

    setEditingId(b.id);
    setAmount(String(b.amount));
    const catId = b.category_id ?? "global";
    setCategoryId(catId);
    preloadSubAmounts(catId);
    setShowForm(true);
  };

  const handleAddSub = async () => {
    if (!newSubName.trim()) return;
    setAddingSubLoading(true);
    const parentCat = categories.find((c) => c.id === categoryId);
    const { data: newCat, error } = await supabase
      .from("categories")
      .insert({ company_id: companyId, name: newSubName.trim(), icon: parentCat?.icon ?? "📂", color: parentCat?.color ?? "#6b7280", is_system: false, parent_id: categoryId })
      .select()
      .single();
    if (!error && newCat) {
      setExtraSubs((prev) => [...prev, newCat as Category]);
      if (newSubAmount) setSubAmounts((prev) => ({ ...prev, [(newCat as Category).id]: newSubAmount }));
    }
    setShowAddSub(false); setNewSubName(""); setNewSubAmount("");
    setAddingSubLoading(false);
  };

  const copyFromPrevMonth = async () => {
    if (prevBudgets.length === 0) return;
    setCopying(true);

    const newBudgets = prevBudgets.map((b) => ({
      company_id: companyId,
      period: "monthly" as const,
      category_id: b.category_id,
      amount: b.amount,
      year: selectedYear,
      month: selectedMonth,
      week: null,
    }));

    await supabase.from("budgets").upsert(newBudgets, {
      onConflict: "company_id,category_id,period,year,month,week",
    });

    setCopying(false);
    onRefresh();
  };

  const BudgetRow = ({ b, isChild = false, displayAmount, hasChildren = false, isCollapsed = false, onToggle }: { b: Budget; isChild?: boolean; displayAmount?: number; hasChildren?: boolean; isCollapsed?: boolean; onToggle?: () => void }) => {
    const cat = categories.find((c) => c.id === b.category_id);
    const shownAmount = displayAmount ?? Number(b.amount);
    return (
      <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${isChild ? "ml-5 bg-white border border-gray-100" : "bg-gray-50"}`}>
        <div className="flex items-center gap-2">
          {isChild && <span className="text-muted-foreground text-xs shrink-0">↳</span>}
          <span className={isChild ? "text-base" : "text-lg"}>{cat?.icon ?? "🌐"}</span>
          <div>
            <p className={`font-medium ${isChild ? "text-xs" : "text-sm"}`}>{cat?.name ?? "Total general"}</p>
            <p className="text-xs text-muted-foreground">{fmt(shownAmount)}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="w-7 h-7" aria-label="Editar" onClick={() => startEdit(b)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="w-7 h-7 text-red-400" aria-label="Eliminar" onClick={() => setConfirmDeleteId(b.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          {hasChildren && (
            <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" aria-label={isCollapsed ? "Expandir" : "Colapsar"} onClick={onToggle}>
              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderBudgetList = (bList: Budget[]) => {
    const parentBudgets = bList.filter((b) => {
      if (!b.category_id) return true;
      const cat = categories.find((c) => c.id === b.category_id);
      return !cat?.parent_id;
    });
    const childBudgets = bList.filter((b) => {
      if (!b.category_id) return false;
      const cat = categories.find((c) => c.id === b.category_id);
      return !!cat?.parent_id;
    });
    const renderedChildIds = new Set<string>();

    const rows = parentBudgets.flatMap((parent) => {
      const parentCat = parent.category_id ? categories.find((c) => c.id === parent.category_id) : null;
      const children = parentCat
        ? childBudgets.filter((sub) => {
            const subCat = categories.find((c) => c.id === sub.category_id);
            return subCat?.parent_id === parentCat.id;
          })
        : [];
      children.forEach((c) => renderedChildIds.add(c.id));
      const childrenTotal = children.reduce((s, c) => s + Number(c.amount), 0);
      const othersAmt = children.length > 0 ? Number(parent.amount) - childrenTotal : 0;
      const hasChildren = children.length > 0 || othersAmt > 0;
      const isCollapsed = collapsedBudgets.has(parent.id);
      return [
        <BudgetRow key={parent.id} b={parent} displayAmount={Number(parent.amount)} hasChildren={hasChildren} isCollapsed={isCollapsed} onToggle={() => toggleCollapse(parent.id)} />,
        ...(!isCollapsed ? [
          ...children.map((child) => <BudgetRow key={child.id} b={child} isChild />),
          ...(othersAmt > 0 ? [
            <div key={`${parent.id}-otros`} className="ml-5 bg-white border border-gray-100 flex items-center justify-between rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs shrink-0">↳</span>
                <span className="text-base">📋</span>
                <div>
                  <p className="font-medium text-xs">Otros</p>
                  <p className="text-xs text-muted-foreground">{fmt(othersAmt)}</p>
                </div>
              </div>
            </div>
          ] : []),
        ] : []),
      ];
    });

    // Subcategorías huérfanas (sin presupuesto del padre)
    const orphans = childBudgets.filter((b) => !renderedChildIds.has(b.id));
    orphans.forEach((b) => rows.push(<BudgetRow key={b.id} b={b} isChild />));

    return rows;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
          {/* Navegación de mes */}
          <div className="flex items-center justify-between bg-white border rounded-xl px-3 py-2">
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={goToPrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold">
              {MONTHS[selectedMonth - 1]} {selectedYear}
              {selectedMonth === currentMonth && selectedYear === currentYear && (
                <span className="ml-1.5 text-xs font-normal text-emerald-500">● actual</span>
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

          {/* Resumen: ingresos esperados + presupuesto + caja menor */}
          {monthlyBudgets.length > 0 && (() => {
            const totalBudget = monthlyBudgets.filter(isRootBudget).reduce((s, b) => s + Number(b.amount), 0);
            const activeRecurring = recurringIncome.filter((r) => {
              if (!r.start_date) return true;
              const [sy, sm] = r.start_date.split("-").map(Number);
              return selectedYear > sy || (selectedYear === sy && selectedMonth >= sm);
            });
            const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
            const sporadicForMonth = income.filter((i) => !i.recurring_income_id && i.period_key === monthKey);
            const recurringTotal = activeRecurring.reduce(
              (s, r) => s + Number(r.amount) * (FREQ_MULTIPLIER[r.frequency] ?? 1), 0
            );
            const sporadicTotal = sporadicForMonth.reduce((s, i) => s + Number(i.amount), 0);
            const expectedIncome = recurringTotal + sporadicTotal;
            const hasIncome = activeRecurring.length > 0 || sporadicForMonth.length > 0;
            const cajaMenor = expectedIncome - totalBudget;
            const cajaLabel = "Ingresos esperados − presupuesto";
            return (
              <div className="rounded-xl border overflow-hidden">
                {/* Ingresos esperados — si hay recurrentes o esporádicos asignados al mes */}
                {hasIncome && (
                  <>
                    <div className="bg-emerald-50 px-4 py-2.5 border-b border-emerald-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-emerald-700 font-medium">Ingresos esperados</span>
                        <span className="text-base font-bold text-emerald-700">+{fmt(expectedIncome)}</span>
                      </div>
                      {activeRecurring.map((r) => {
                        const mult = FREQ_MULTIPLIER[r.frequency] ?? 1;
                        return (
                          <div key={r.id} className="flex items-center justify-between text-xs text-emerald-600 py-0.5">
                            <span>{r.name} <span className="text-emerald-400">({FREQ_LABEL[r.frequency]})</span></span>
                            <span>+{fmt(Number(r.amount) * mult)}</span>
                          </div>
                        );
                      })}
                      {sporadicForMonth.map((i) => (
                        <div key={i.id} className="flex items-center justify-between text-xs text-emerald-600 py-0.5">
                          <span>{i.description || "Ingreso esporádico"} <span className="text-emerald-400">(esporádico)</span></span>
                          <span>+{fmt(Number(i.amount))}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="bg-emerald-50 px-4 py-3 flex items-center justify-between border-b border-emerald-100">
                  <span className="text-sm text-emerald-700 font-medium">Total presupuestado</span>
                  <span className="text-base font-bold text-emerald-800">{fmt(totalBudget)}</span>
                </div>
                {hasIncome && (
                  <div className={`px-4 py-3 ${cajaMenor >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-semibold ${cajaMenor >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                          Margen libre
                        </span>
                        <button type="button" onClick={() => setShowCajaInfo((v) => !v)} className="text-muted-foreground hover:text-gray-600">
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className={`text-base font-bold ${cajaMenor >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {cajaMenor >= 0 ? "+" : ""}{fmt(cajaMenor)}
                      </span>
                    </div>
                    {showCajaInfo ? (
                      <p className="text-xs text-muted-foreground mt-1.5 bg-white/70 rounded-lg px-2.5 py-2 leading-relaxed">
                        Es lo que te sobra (o te falta) después de cubrir todo lo presupuestado. Si es negativo, tus gastos planeados superan tus ingresos esperados.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">{cajaLabel}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Sin presupuesto — ofrecer copiar del mes anterior */}
          {monthlyBudgets.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 space-y-3 text-center">
              <p className="text-3xl">📊</p>
              <div>
                <p className="text-sm font-semibold text-gray-700">Sin presupuesto para {MONTHS[selectedMonth - 1]}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Un presupuesto te permite definir cuánto puedes gastar en total o por categoría (comida, transporte, entretenimiento…).
                </p>
              </div>
              {prevBudgets.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                  onClick={copyFromPrevMonth}
                  disabled={copying}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  {copying ? "Copiando..." : `Usar el de ${MONTHS[prev.month - 1]}`}
                </Button>
              )}
            </div>
          )}

          {renderBudgetList(monthlyBudgets)}
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{editingId ? "Editar" : "Nuevo"} presupuesto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Categoría</Label>
                <button type="button" onClick={onManageCategories} className="text-xs text-emerald-600 flex items-center gap-1 hover:underline">
                  <Settings2 className="w-3 h-3" /> Gestionar categorías
                </button>
              </div>
              <Select value={categoryId} onValueChange={(v) => handleCategoryChange(v ?? "global")} items={categoryItems}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">🌐 Total general</SelectItem>
                  {topCats.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {allSubsInForm.length === 0 && (
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
            )}

            {allSubsInForm.length > 0 && (
              <div className="space-y-2 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-3">
                <p className="text-xs font-semibold text-emerald-700">Montos por subcategoría</p>
                {allSubsInForm.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2">
                    <span className="text-sm shrink-0 w-36 truncate text-muted-foreground">{sub.icon} {sub.name}</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={subAmounts[sub.id] ?? ""}
                      onChange={(e) => setSubAmounts((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}

                {/* Otros: monto adicional no asignado a ninguna subcategoría */}
                <div className="flex items-center gap-2">
                  <span className="text-sm shrink-0 w-36 truncate text-muted-foreground">📋 Otros</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={othersAmount}
                    onChange={(e) => setOthersAmount(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                {/* Agregar subcategoría inline */}
                {!showAddSub ? (
                  <button
                    type="button"
                    onClick={() => setShowAddSub(true)}
                    className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 font-medium py-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar subcategoría
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 pt-1">
                    <Input
                      placeholder="Nueva subcategoría"
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      className="h-8 text-sm flex-1"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddSub(); if (e.key === "Escape") { setShowAddSub(false); setNewSubName(""); setNewSubAmount(""); } }}
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={newSubAmount}
                      onChange={(e) => setNewSubAmount(e.target.value)}
                      className="h-8 text-sm w-24"
                    />
                    <button
                      type="button"
                      onClick={handleAddSub}
                      disabled={!newSubName.trim() || addingSubLoading}
                      className="p-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-40"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddSub(false); setNewSubName(""); setNewSubAmount(""); }}
                      className="p-1.5 rounded-lg border text-muted-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex justify-between items-center pt-1.5 border-t border-emerald-200">
                  <span className="text-xs font-semibold text-emerald-700">Total</span>
                  <span className="text-sm font-bold text-emerald-800">
                    {fmt(Object.values(subAmounts).reduce((s, v) => s + (Number(v) || 0), 0) + (Number(othersAmount) || 0))}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={closeForm}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleSave}
                disabled={loading || (allSubsInForm.length === 0 ? !amount || Number(amount) <= 0 : Object.values(subAmounts).reduce((s, v) => s + (Number(v) || 0), 0) + (Number(othersAmount) || 0) <= 0)}
              >
                {loading ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!showForm && (
        <div className="flex gap-2">
          <Button className="flex-1" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Agregar presupuesto
          </Button>
          <Button variant="outline" onClick={onManageCategories} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
            <Settings2 className="w-4 h-4 mr-1" /> Categorías
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title="¿Eliminar este presupuesto?"
        description={confirmBudget ? `${confirmBudgetCat ? `${confirmBudgetCat.icon} ${confirmBudgetCat.name}` : "Total general"} · ${fmt(Number(confirmBudget.amount))}. Esta acción no se puede deshacer.` : "Esta acción no se puede deshacer."}
        loading={deletingBudget}
        onConfirm={async () => { if (confirmDeleteId) await handleDelete(confirmDeleteId); }}
      />
    </div>
  );
}
