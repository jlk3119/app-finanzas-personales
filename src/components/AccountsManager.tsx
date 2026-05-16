"use client";

import { useState } from "react";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { createClient } from "@/utils/supabase/client";
import type { Account, Income } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus, Check, X, ChevronRight } from "lucide-react";

type Props = {
  accounts: Account[];
  income: Income[];
  onRefresh: () => void;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const ACCOUNT_ICONS = ["🏦","💳","📱","💵","🪙","🏧","💼","🏪","💰","🐷","✈️","🌐"];
const ACCOUNT_COLORS = ["#6366f1","#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#6b7280","#f97316"];

type AccountForm = { name: string; icon: string; color: string; balance: string };
const EMPTY_ACCOUNT: AccountForm = { name: "", icon: "🏦", color: "#6366f1", balance: "0" };

type IncomeForm = { amount: string; description: string; date: string; account_id: string };
const emptyIncome = (): IncomeForm => ({
  amount: "",
  description: "",
  date: new Date().toISOString().split("T")[0],
  account_id: "",
});

type View = "main" | "account-form" | "income-form" | "income-list";

export default function AccountsManager({ accounts, income, onRefresh }: Props) {
  const supabase = createClient();
  const [view, setView] = useState<View>("main");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm>(EMPTY_ACCOUNT);
  const [incomeForm, setIncomeForm] = useState<IncomeForm>(emptyIncome());
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useBackButtonClose(view !== "main", () => setView("main"));

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const recentIncome = income.slice(0, 5);

  /* ── Account CRUD ── */
  const openCreateAccount = () => {
    setEditingAccount(null);
    setAccountForm(EMPTY_ACCOUNT);
    setView("account-form");
  };

  const openEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setAccountForm({ name: acc.name, icon: acc.icon, color: acc.color, balance: String(acc.balance) });
    setView("account-form");
  };

  const saveAccount = async () => {
    if (!accountForm.name.trim()) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    if (editingAccount) {
      await supabase.from("accounts").update({
        name: accountForm.name.trim(),
        icon: accountForm.icon,
        color: accountForm.color,
        balance: Number(accountForm.balance) || 0,
      }).eq("id", editingAccount.id);
    } else {
      await supabase.from("accounts").insert({
        user_id: user.id,
        name: accountForm.name.trim(),
        icon: accountForm.icon,
        color: accountForm.color,
        balance: Number(accountForm.balance) || 0,
      });
    }
    setLoading(false);
    setView("main");
    onRefresh();
  };

  const deleteAccount = async (id: string) => {
    setDeletingId(id);
    await supabase.from("accounts").delete().eq("id", id);
    setDeletingId(null);
    onRefresh();
  };

  /* ── Income CRUD ── */
  const openIncomeForm = () => {
    setIncomeForm(emptyIncome());
    setView("income-form");
  };

  const saveIncome = async () => {
    if (!incomeForm.amount || Number(incomeForm.amount) <= 0) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const amount = Number(incomeForm.amount);
    const account_id = incomeForm.account_id || null;

    await supabase.from("income").insert({
      user_id: user.id,
      account_id,
      amount,
      description: incomeForm.description || null,
      date: incomeForm.date,
    });

    // Si está vinculado a una cuenta, sumar al saldo
    if (account_id) {
      const acc = accounts.find((a) => a.id === account_id);
      if (acc) {
        await supabase.from("accounts")
          .update({ balance: Number(acc.balance) + amount })
          .eq("id", account_id);
      }
    }

    setLoading(false);
    setView("main");
    onRefresh();
  };

  const deleteIncome = async (entry: Income) => {
    setDeletingId(entry.id);
    await supabase.from("income").delete().eq("id", entry.id);
    // Restar del saldo de la cuenta
    if (entry.account_id) {
      const acc = accounts.find((a) => a.id === entry.account_id);
      if (acc) {
        await supabase.from("accounts")
          .update({ balance: Math.max(0, Number(acc.balance) - Number(entry.amount)) })
          .eq("id", entry.account_id);
      }
    }
    setDeletingId(null);
    onRefresh();
  };

  /* ── Vistas ── */

  // Formulario de cuenta
  if (view === "account-form") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setView("main")}>
            <X className="w-4 h-4" />
          </Button>
          <h2 className="font-semibold text-sm">{editingAccount ? "Editar cuenta" : "Nueva cuenta"}</h2>
        </div>

        <div className="space-y-1">
          <Label>Nombre de la cuenta</Label>
          <Input
            placeholder="Ej: Bancolombia, Nequi, Efectivo..."
            value={accountForm.name}
            onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label>Icono</Label>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setAccountForm({ ...accountForm, icon: ic })}
                className={`text-2xl p-1.5 rounded-xl transition-all ${accountForm.icon === ic ? "ring-2 ring-violet-500 bg-violet-50 scale-110" : "hover:bg-gray-100"}`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAccountForm({ ...accountForm, color: c })}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{ backgroundColor: c }}
              >
                {accountForm.color === c && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label>Saldo actual</Label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={accountForm.balance}
            onChange={(e) => setAccountForm({ ...accountForm, balance: e.target.value })}
            className="h-11"
          />
        </div>

        {/* Vista previa */}
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
          <Button className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={saveAccount} disabled={loading || !accountForm.name.trim()}>
            <Check className="w-4 h-4 mr-1" /> {loading ? "Guardando..." : editingAccount ? "Actualizar" : "Crear cuenta"}
          </Button>
        </div>
      </div>
    );
  }

  // Formulario de ingreso
  if (view === "income-form") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setView("main")}>
            <X className="w-4 h-4" />
          </Button>
          <h2 className="font-semibold text-sm">Registrar ingreso</h2>
        </div>

        <div className="space-y-1">
          <Label>Monto *</Label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={incomeForm.amount}
            onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
            className="text-xl h-12"
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <Label>Descripción (opcional)</Label>
          <Input
            placeholder="Ej: Salario, Freelance, Venta..."
            value={incomeForm.description}
            onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={incomeForm.date}
            onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <Label>Cuenta (opcional)</Label>
          {accounts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No tienes cuentas creadas. Crea una primero para vincular el ingreso.</p>
          ) : (
            <Select
              value={incomeForm.account_id}
              onValueChange={(v) => setIncomeForm({ ...incomeForm, account_id: v ?? "" })}
              items={Object.fromEntries(accounts.map((a) => [a.id, `${a.icon} ${a.name}`]))}
            >
              <SelectTrigger className="w-full h-11">
                <SelectValue placeholder="Sin cuenta específica" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.icon} {acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {incomeForm.account_id && (
            <p className="text-xs text-violet-600">El saldo de la cuenta se actualizará automáticamente.</p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => setView("main")}>Cancelar</Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={saveIncome}
            disabled={loading || !incomeForm.amount || Number(incomeForm.amount) <= 0}
          >
            {loading ? "Guardando..." : "Registrar ingreso"}
          </Button>
        </div>
      </div>
    );
  }

  // Lista completa de ingresos
  if (view === "income-list") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setView("main")}>
            <X className="w-4 h-4" />
          </Button>
          <h2 className="font-semibold text-sm">Todos los ingresos</h2>
        </div>

        {income.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Sin ingresos registrados.</p>
        )}

        {income.map((entry) => {
          const acc = accounts.find((a) => a.id === entry.account_id);
          return (
            <div key={entry.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-lg">
                  {acc ? acc.icon : "💵"}
                </div>
                <div>
                  <p className="text-sm font-medium">{entry.description || "Ingreso"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.date + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                    {acc && <span> · {acc.name}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-emerald-600">+{fmt(entry.amount)}</span>
                <Button
                  variant="ghost" size="icon" className="w-7 h-7 text-red-400"
                  onClick={() => deleteIncome(entry)}
                  disabled={deletingId === entry.id}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Vista principal
  return (
    <div className="space-y-4">

      {/* Saldo total */}
      <Card className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-0">
        <CardContent className="pt-5 pb-5 text-center">
          <p className="text-violet-200 text-sm mb-1">Saldo total disponible</p>
          <p className="text-3xl font-bold">{fmt(totalBalance)}</p>
          <p className="text-violet-300 text-xs mt-1">{accounts.length} {accounts.length === 1 ? "cuenta" : "cuentas"}</p>
        </CardContent>
      </Card>

      {/* Cuentas */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Cuentas</h3>
          <Button variant="ghost" size="sm" className="text-violet-600 h-7 text-xs" onClick={openCreateAccount}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Nueva
          </Button>
        </div>

        {accounts.length === 0 && (
          <div className="text-center py-6 bg-gray-50 rounded-xl">
            <p className="text-sm text-muted-foreground">Sin cuentas. Agrega tu primera cuenta bancaria.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={openCreateAccount}>
              <Plus className="w-4 h-4 mr-1" /> Agregar cuenta
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {accounts.map((acc) => (
            <div key={acc.id} className="flex items-center justify-between bg-white border rounded-xl px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: acc.color + "33" }}>
                  {acc.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold">{acc.name}</p>
                  <p className="text-base font-bold" style={{ color: acc.color }}>{fmt(acc.balance)}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground" onClick={() => openEditAccount(acc)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="w-8 h-8 text-red-400"
                  onClick={() => deleteAccount(acc.id)}
                  disabled={deletingId === acc.id}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ingresos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ingresos</h3>
          <Button variant="ghost" size="sm" className="text-emerald-600 h-7 text-xs" onClick={openIncomeForm}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Registrar
          </Button>
        </div>

        {recentIncome.length === 0 && (
          <div className="text-center py-6 bg-gray-50 rounded-xl">
            <p className="text-sm text-muted-foreground">Sin ingresos registrados aún.</p>
            <Button variant="outline" size="sm" className="mt-3 text-emerald-600 border-emerald-200" onClick={openIncomeForm}>
              <Plus className="w-4 h-4 mr-1" /> Registrar ingreso
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {recentIncome.map((entry) => {
            const acc = accounts.find((a) => a.id === entry.account_id);
            return (
              <div key={entry.id} className="flex items-center justify-between bg-white border rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-lg">
                    {acc ? acc.icon : "💵"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{entry.description || "Ingreso"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.date + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                      {acc && <span> · {acc.name}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-emerald-600">+{fmt(entry.amount)}</span>
                  <Button
                    variant="ghost" size="icon" className="w-7 h-7 text-red-400"
                    onClick={() => deleteIncome(entry)}
                    disabled={deletingId === entry.id}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {income.length > 5 && (
          <Button
            variant="ghost"
            className="w-full text-sm text-muted-foreground mt-1"
            onClick={() => setView("income-list")}
          >
            Ver todos los ingresos ({income.length}) <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
