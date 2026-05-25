"use client";

import { useState } from "react";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { createClient } from "@/utils/supabase/client";
import type { Account, Income, RecurringIncome } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pencil, Trash2, Plus, Check, X, ChevronRight } from "lucide-react";

type Props = {
  accounts: Account[];
  income: Income[];
  recurringIncome: RecurringIncome[];
  companyId: string;
  role: "owner" | "employee";
  disponible: number;
  unlinkedMonthTotal: number;
  onRefresh: () => void;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" });

const FREQ_LABELS: Record<string, string> = {
  monthly: "Mensual",
  biweekly: "Quincenal",
  weekly: "Semanal",
};

const ACCOUNT_ICONS = ["🏦","💳","📱","💵","🪙","🏧","💼","🏪","💰","🐷","✈️","🌐"];
const ACCOUNT_COLORS = ["#059669","#0d9488","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#6b7280","#f97316"];

type AccountForm = { name: string; icon: string; color: string; balance: string };
const EMPTY_ACCOUNT: AccountForm = { name: "", icon: "🏦", color: "#059669", balance: "0" };

type IncomeForm = { amount: string; description: string; date: string; account_id: string; budget_month: string };
const emptyIncome = (): IncomeForm => {
  const d = new Date();
  return {
    amount: "", description: "",
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    account_id: "",
    budget_month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
  };
};

type RecurringForm = {
  name: string; amount: string;
  frequency: "monthly" | "biweekly" | "weekly";
  day_of_month: string; account_id: string;
  start_month: string;
};
const currentMonthStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
};
const EMPTY_RECURRING: RecurringForm = {
  name: "", amount: "", frequency: "monthly",
  day_of_month: "", account_id: "", start_month: currentMonthStr(),
};

type View = "main" | "account-form" | "income-form" | "recurring-form" | "income-list";

export default function AccountsManager({ accounts, income, recurringIncome, companyId, role, disponible, unlinkedMonthTotal, onRefresh }: Props) {
  const supabase = createClient();
  const [view, setView] = useState<View>("main");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<RecurringIncome | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm>(EMPTY_ACCOUNT);
  const [incomeForm, setIncomeForm] = useState<IncomeForm>(emptyIncome());
  const [recurringForm, setRecurringForm] = useState<RecurringForm>(EMPTY_RECURRING);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<
    | { type: "account"; id: string }
    | { type: "income"; entry: Income }
    | { type: "recurring"; id: string }
    | null
  >(null);
  const confirmDeleteAccount = confirmDelete?.type === "account" ? accounts.find((a) => a.id === confirmDelete.id) : null;
  const confirmDeleteRecurring = confirmDelete?.type === "recurring" ? recurringIncome.find((r) => r.id === confirmDelete.id) : null;
  const confirmDeleteIncome = confirmDelete?.type === "income" ? confirmDelete.entry : null;
  const confirmTitle = confirmDelete?.type === "account" ? "¿Eliminar esta cuenta?"
    : confirmDelete?.type === "income" ? "¿Eliminar este ingreso?"
    : confirmDelete?.type === "recurring" ? "¿Eliminar este ingreso recurrente?"
    : "";
  const confirmDescription = confirmDeleteAccount
    ? `${confirmDeleteAccount.icon} ${confirmDeleteAccount.name} · saldo ${fmt(Number(confirmDeleteAccount.balance))}. Esta acción no se puede deshacer.`
    : confirmDeleteIncome
    ? `${confirmDeleteIncome.description || "Ingreso"} · ${fmt(Number(confirmDeleteIncome.amount))}. El saldo de la cuenta se ajustará. Esta acción no se puede deshacer.`
    : confirmDeleteRecurring
    ? `${confirmDeleteRecurring.name} · ${fmt(Number(confirmDeleteRecurring.amount))}. Esta acción no se puede deshacer.`
    : "Esta acción no se puede deshacer.";
  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "account") await deleteAccount(confirmDelete.id);
    else if (confirmDelete.type === "income") await deleteIncome(confirmDelete.entry);
    else await deleteRecurring(confirmDelete.id);
  };

  useBackButtonClose(view !== "main", () => setView("main"));

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const futureSporadicByAccount = (accId: string) =>
    income
      .filter((i) => !i.recurring_income_id && !!i.period_key && i.period_key > currentMonthKey && i.account_id === accId)
      .reduce((s, i) => s + Number(i.amount), 0);

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance) - futureSporadicByAccount(a.id), 0);

  /* ── Accounts ── */
  const openCreateAccount = () => { setEditingAccount(null); setAccountForm(EMPTY_ACCOUNT); setView("account-form"); };
  const openEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setAccountForm({ name: acc.name, icon: acc.icon, color: acc.color, balance: String(acc.balance) });
    setView("account-form");
  };

  const saveAccount = async () => {
    if (!accountForm.name.trim()) return;
    setLoading(true);
    if (editingAccount) {
      await supabase.from("accounts").update({
        name: accountForm.name.trim(), icon: accountForm.icon,
        color: accountForm.color, balance: Number(accountForm.balance) || 0,
      }).eq("id", editingAccount.id);
    } else {
      await supabase.from("accounts").insert({
        company_id: companyId, name: accountForm.name.trim(),
        icon: accountForm.icon, color: accountForm.color, balance: Number(accountForm.balance) || 0,
      });
    }
    setLoading(false); setView("main"); onRefresh();
  };

  const deleteAccount = async (id: string) => {
    setDeletingId(id);
    await supabase.from("accounts").delete().eq("id", id);
    setDeletingId(null); onRefresh();
  };

  /* ── Sporadic income ── */
  const saveIncome = async () => {
    if (!incomeForm.amount || Number(incomeForm.amount) <= 0) return;
    setLoading(true);
    const amount = Number(incomeForm.amount);
    const account_id = incomeForm.account_id || null;
    await supabase.from("income").insert({
      company_id: companyId, account_id, amount,
      description: incomeForm.description || null, date: incomeForm.date,
      period_key: incomeForm.budget_month || null,
    });
    if (account_id) {
      const acc = accounts.find((a) => a.id === account_id);
      if (acc) await supabase.from("accounts").update({ balance: Number(acc.balance) + amount }).eq("id", account_id);
    }
    setLoading(false); setView("main"); onRefresh();
  };

  const deleteIncome = async (entry: Income) => {
    setDeletingId(entry.id);
    await supabase.from("income").delete().eq("id", entry.id);
    if (entry.account_id) {
      const acc = accounts.find((a) => a.id === entry.account_id);
      if (acc) await supabase.from("accounts").update({ balance: Math.max(0, Number(acc.balance) - Number(entry.amount)) }).eq("id", entry.account_id);
    }
    setDeletingId(null); onRefresh();
  };

  /* ── Recurring income ── */
  const openCreateRecurring = () => { setEditingRecurring(null); setRecurringForm(EMPTY_RECURRING); setView("recurring-form"); };
  const openEditRecurring = (r: RecurringIncome) => {
    setEditingRecurring(r);
    const sm = r.start_date ? r.start_date.slice(0, 7) : currentMonthStr();
    setRecurringForm({
      name: r.name, amount: String(r.amount), frequency: r.frequency,
      day_of_month: r.day_of_month ? String(r.day_of_month) : "",
      account_id: r.account_id ?? "", start_month: sm,
    });
    setView("recurring-form");
  };

  const saveRecurring = async () => {
    if (!recurringForm.name.trim() || !recurringForm.amount || Number(recurringForm.amount) <= 0) return;
    setLoading(true);
    const payload = {
      name: recurringForm.name.trim(),
      amount: Number(recurringForm.amount),
      frequency: recurringForm.frequency,
      day_of_month: recurringForm.day_of_month ? Number(recurringForm.day_of_month) : null,
      account_id: recurringForm.account_id || null,
      auto_assign: false,
      start_date: recurringForm.start_month ? `${recurringForm.start_month}-01` : null,
    };
    if (editingRecurring) {
      await supabase.from("recurring_income").update(payload).eq("id", editingRecurring.id);
    } else {
      await supabase.from("recurring_income").insert({ ...payload, company_id: companyId });
    }
    setLoading(false); setView("main"); onRefresh();
  };

  const deleteRecurring = async (id: string) => {
    setDeletingId(id);
    await supabase.from("recurring_income").delete().eq("id", id);
    setDeletingId(null); onRefresh();
  };

  /* ══ VISTAS ══ */

  if (view === "account-form") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setView("main")}><X className="w-4 h-4" /></Button>
          <h2 className="font-semibold text-sm">{editingAccount ? "Editar cuenta" : "Nueva cuenta"}</h2>
        </div>
        <div className="space-y-1">
          <Label>Nombre de la cuenta</Label>
          <Input placeholder="Ej: Bancolombia, Nequi, Caja..." value={accountForm.name}
            onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} autoFocus />
        </div>
        <div className="space-y-2">
          <Label>Icono</Label>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_ICONS.map((ic) => (
              <button key={ic} type="button" onClick={() => setAccountForm({ ...accountForm, icon: ic })}
                className={`text-2xl p-1.5 rounded-xl transition-all ${accountForm.icon === ic ? "ring-2 ring-emerald-500 bg-emerald-50 scale-110" : "hover:bg-gray-100"}`}>
                {ic}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setAccountForm({ ...accountForm, color: c })}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{ backgroundColor: c }}>
                {accountForm.color === c && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label>Saldo actual</Label>
          <Input type="number" inputMode="decimal" placeholder="0" value={accountForm.balance}
            onChange={(e) => setAccountForm({ ...accountForm, balance: e.target.value })} className="h-11" />
        </div>
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: accountForm.color + "33" }}>
            {accountForm.icon}
          </div>
          <div>
            <p className="font-semibold text-sm">{accountForm.name || "Vista previa"}</p>
            <p className="text-xs text-muted-foreground">{fmt(Number(accountForm.balance) || 0)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setView("main")}>Cancelar</Button>
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={saveAccount} disabled={loading || !accountForm.name.trim()}>
            <Check className="w-4 h-4 mr-1" /> {loading ? "Guardando..." : editingAccount ? "Actualizar" : "Crear cuenta"}
          </Button>
        </div>
      </div>
    );
  }

  if (view === "income-form") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setView("main")}><X className="w-4 h-4" /></Button>
          <h2 className="font-semibold text-sm">Registrar ingreso esporádico</h2>
        </div>
        <div className="space-y-1">
          <Label>Monto *</Label>
          <Input type="number" inputMode="decimal" placeholder="0" value={incomeForm.amount}
            onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })} className="text-xl h-12" autoFocus />
        </div>
        <div className="space-y-1">
          <Label>Descripción (opcional)</Label>
          <Input placeholder="Ej: Venta, Comisión, Anticipo..." value={incomeForm.description}
            onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Fecha de recibo</Label>
          <Input type="date" value={incomeForm.date} onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Mes de presupuesto</Label>
          <Input type="month" value={incomeForm.budget_month}
            onChange={(e) => setIncomeForm({ ...incomeForm, budget_month: e.target.value })} />
          <p className="text-xs text-muted-foreground">¿En qué mes debe contar este ingreso?</p>
        </div>
        <div className="space-y-1">
          <Label>Cuenta (opcional)</Label>
          {accounts.length > 0 ? (
            <Select value={incomeForm.account_id} onValueChange={(v) => setIncomeForm({ ...incomeForm, account_id: v ?? "" })}
              items={Object.fromEntries(accounts.map((a) => [a.id, `${a.icon} ${a.name}`]))}>
              <SelectTrigger className="w-full h-11"><SelectValue placeholder="Sin cuenta específica" /></SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.icon} {acc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-muted-foreground py-2">No tienes cuentas creadas aún.</p>
          )}
          {incomeForm.account_id && <p className="text-xs text-emerald-600">El saldo se actualizará automáticamente.</p>}
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => setView("main")}>Cancelar</Button>
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={saveIncome}
            disabled={loading || !incomeForm.amount || Number(incomeForm.amount) <= 0}>
            {loading ? "Guardando..." : "Registrar ingreso"}
          </Button>
        </div>
      </div>
    );
  }

  if (view === "recurring-form") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setView("main")}><X className="w-4 h-4" /></Button>
          <h2 className="font-semibold text-sm">{editingRecurring ? "Editar ingreso recurrente" : "Nuevo ingreso recurrente"}</h2>
        </div>

        <div className="space-y-1">
          <Label>Nombre *</Label>
          <Input placeholder="Ej: Arriendo cobrado, Suscripción..." value={recurringForm.name}
            onChange={(e) => setRecurringForm({ ...recurringForm, name: e.target.value })} autoFocus />
        </div>

        <div className="space-y-1">
          <Label>Monto *</Label>
          <Input type="number" inputMode="decimal" placeholder="0" value={recurringForm.amount}
            onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })} className="h-11" />
        </div>

        <div className="space-y-1">
          <Label>Frecuencia</Label>
          <Select value={recurringForm.frequency}
            onValueChange={(v) => setRecurringForm({ ...recurringForm, frequency: v as RecurringForm["frequency"] })}
            items={{ monthly: "Mensual", biweekly: "Quincenal", weekly: "Semanal" }}>
            <SelectTrigger className="w-full h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">📅 Mensual</SelectItem>
              <SelectItem value="biweekly">📅 Quincenal</SelectItem>
              <SelectItem value="weekly">📅 Semanal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {recurringForm.frequency !== "weekly" && (
          <div className="space-y-1.5">
            <Label>
              {recurringForm.frequency === "biweekly" ? "Día de la 1ª quincena (1–15)" : "Día de pago del mes (1–31)"}
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder={recurringForm.frequency === "biweekly" ? "Ej: 15" : "Ej: 25"}
              min={1}
              max={recurringForm.frequency === "biweekly" ? 15 : 31}
              value={recurringForm.day_of_month}
              onChange={(e) => setRecurringForm({ ...recurringForm, day_of_month: e.target.value })}
              className="h-11"
            />
          </div>
        )}

        <div className="space-y-1">
          <Label>Cuenta destino</Label>
          {accounts.length > 0 ? (
            <Select value={recurringForm.account_id} onValueChange={(v) => setRecurringForm({ ...recurringForm, account_id: v ?? "" })}
              items={Object.fromEntries(accounts.map((a) => [a.id, `${a.icon} ${a.name}`]))}>
              <SelectTrigger className="w-full h-11"><SelectValue placeholder="Selecciona una cuenta" /></SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.icon} {acc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-muted-foreground py-2">Crea una cuenta bancaria primero.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Vigente desde</Label>
          <Input
            type="month"
            value={recurringForm.start_month}
            onChange={(e) => setRecurringForm({ ...recurringForm, start_month: e.target.value })}
            className="h-11"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => setView("main")}>Cancelar</Button>
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={saveRecurring}
            disabled={loading || !recurringForm.name.trim() || !recurringForm.amount || Number(recurringForm.amount) <= 0}>
            <Check className="w-4 h-4 mr-1" /> {loading ? "Guardando..." : editingRecurring ? "Actualizar" : "Guardar"}
          </Button>
        </div>
      </div>
    );
  }

  if (view === "income-list") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setView("main")}><X className="w-4 h-4" /></Button>
          <h2 className="font-semibold text-sm">Todos los ingresos</h2>
        </div>
        {income.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Sin ingresos registrados.</p>}
        {income.map((entry) => {
          const acc = accounts.find((a) => a.id === entry.account_id);
          const isPending = !entry.recurring_income_id && !!entry.period_key && entry.period_key > currentMonthStr();
          return (
            <div key={entry.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-lg">{acc ? acc.icon : "💵"}</div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium">{entry.description || "Ingreso"}</p>
                    {isPending && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Pendiente</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(entry.date)}{acc && <span> · {acc.name}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-emerald-600">+{fmt(entry.amount)}</span>
                {role === "owner" && (
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-red-400" onClick={() => setConfirmDelete({ type: "income", entry })} disabled={deletingId === entry.id}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ── Vista principal ── */
  const recentIncome = income.filter((i) => !i.recurring_income_id).slice(0, 5);

  return (
    <div className="space-y-6">

      {/* Disponible total */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl px-5 py-5 text-center shadow-md">
        <p className="text-emerald-200 text-xs mb-1 uppercase tracking-wide">Disponible total</p>
        <p className={`text-3xl font-bold ${disponible < 0 ? "text-red-300" : ""}`}>{fmt(disponible)}</p>
        <p className="text-emerald-300 text-xs mt-1">
          {unlinkedMonthTotal > 0
            ? `${fmt(totalBalance)} en cuentas − ${fmt(unlinkedMonthTotal)} sin cuenta`
            : "Saldo total en cuentas"}
        </p>
      </div>

      {/* ── Cuentas ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cuentas</h3>
          {role === "owner" && (
            <Button variant="ghost" size="sm" className="text-emerald-600 h-7 text-xs px-2" onClick={openCreateAccount}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Nueva
            </Button>
          )}
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <p className="text-2xl mb-2">🏦</p>
            <p className="text-sm text-muted-foreground mb-3">Agrega tu primera cuenta bancaria</p>
            {role === "owner" && (
              <Button variant="outline" size="sm" onClick={openCreateAccount}>
                <Plus className="w-4 h-4 mr-1" /> Agregar cuenta
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between bg-white border rounded-2xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-2xl flex-shrink-0" style={{ backgroundColor: acc.color + "22" }}>
                    {acc.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{acc.name}</p>
                    <p className="text-lg font-bold leading-tight" style={{ color: acc.color }}>{fmt(Number(acc.balance) - futureSporadicByAccount(acc.id))}</p>
                  </div>
                </div>
                {role === "owner" && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground" aria-label="Editar cuenta" onClick={() => openEditAccount(acc)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-red-400" aria-label="Eliminar cuenta" onClick={() => setConfirmDelete({ type: "account", id: acc.id })} disabled={deletingId === acc.id}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Ingresos recurrentes ── */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ingresos recurrentes</h3>
          {role === "owner" && (
            <Button variant="ghost" size="sm" className="text-emerald-600 h-7 text-xs px-2" onClick={openCreateRecurring}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Agregar
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">Arriendos cobrados, suscripciones, ingresos fijos mensuales.</p>

        {recurringIncome.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <p className="text-2xl mb-2">💰</p>
            <p className="text-sm font-semibold text-gray-700 mb-1">Sin ingresos recurrentes</p>
            <p className="text-xs text-muted-foreground mb-3 px-4">Registra tus ingresos fijos para calcular el presupuesto disponible.</p>
            {role === "owner" && (
              <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200" onClick={openCreateRecurring}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Agregar ingreso recurrente
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {recurringIncome.map((r) => {
              const acc = accounts.find((a) => a.id === r.account_id);
              return (
                <div key={r.id} className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-4 pt-3.5 pb-2 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-xl flex-shrink-0">
                        {acc ? acc.icon : "💰"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {FREQ_LABELS[r.frequency]}
                          {r.start_date && (
                            <span> · desde {new Date(r.start_date + "T12:00:00").toLocaleDateString("es-CO", { month: "short", year: "numeric" })}</span>
                          )}
                          {acc && <span> → {acc.name}</span>}
                        </p>
                      </div>
                    </div>
                    {role === "owner" && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" onClick={() => openEditRecurring(r)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-red-400" onClick={() => setConfirmDelete({ type: "recurring", id: r.id })} disabled={deletingId === r.id}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold text-gray-900">{fmt(r.amount)}</span>
                    <span className="text-[10px] font-medium bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">
                      {FREQ_LABELS[r.frequency]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Ingresos esporádicos ── */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ingresos esporádicos</h3>
          <Button variant="ghost" size="sm" className="text-emerald-600 h-7 text-xs px-2" onClick={() => setView("income-form")}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Registrar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Pagos de clientes, ventas puntuales, anticipos recibidos.</p>

        {recentIncome.length === 0 ? (
          <div className="text-center py-5 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <p className="text-sm text-muted-foreground">Sin ingresos esporádicos registrados.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentIncome.map((entry) => {
              const acc = accounts.find((a) => a.id === entry.account_id);
              const isPending = !entry.recurring_income_id && !!entry.period_key && entry.period_key > currentMonthStr();
              return (
                <div key={entry.id} className="flex items-center justify-between bg-white border rounded-xl px-3 py-2.5 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-lg flex-shrink-0">
                      {acc ? acc.icon : "💵"}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-gray-800">{entry.description || "Ingreso"}</p>
                        {isPending && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Pendiente</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(entry.date)}{acc && <span> · {acc.name}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold text-emerald-600">+{fmt(entry.amount)}</span>
                    {role === "owner" && (
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-red-400" onClick={() => setConfirmDelete({ type: "income", entry })} disabled={deletingId === entry.id}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {income.filter((i) => !i.recurring_income_id).length > 5 && (
          <Button variant="ghost" className="w-full text-sm text-muted-foreground mt-1" onClick={() => setView("income-list")}>
            Ver todos <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </section>
      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={confirmTitle}
        description={confirmDescription}
        loading={deletingId !== null && (
          (confirmDelete?.type === "account" && deletingId === confirmDelete.id) ||
          (confirmDelete?.type === "income" && deletingId === confirmDelete.entry.id) ||
          (confirmDelete?.type === "recurring" && deletingId === confirmDelete.id)
        )}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
