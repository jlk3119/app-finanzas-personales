"use client";

import { useState } from "react";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { createClient } from "@/utils/supabase/client";
import type { Debt } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, X, CreditCard, CheckCircle2 } from "lucide-react";

type Props = { debts: Debt[]; onRefresh: () => void };

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const ICONS = [
  "💳","🏦","🏠","🚗","📱","💻","🎓","🏥","💊","🛒",
  "⚡","💧","🌐","✈️","🏍️","🛋️","👔","💍","🔑","📄",
];

const COLORS = [
  "#ef4444","#f97316","#eab308","#84cc16","#22c55e",
  "#06b6d4","#3b82f6","#8b5cf6","#ec4899","#6b7280",
];

type View = "list" | "form" | "pay";

export default function DebtManager({ debts, onRefresh }: Props) {
  const supabase = createClient();

  const [view, setView] = useState<View>("list");
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);

  const [name, setName] = useState("");
  const [entity, setEntity] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [icon, setIcon] = useState("💳");
  const [color, setColor] = useState("#ef4444");
  const [loading, setLoading] = useState(false);

  const [payAmount, setPayAmount] = useState("");

  const totalDebt = debts.reduce((s, d) => s + Number(d.total_amount), 0);
  const totalPaid = debts.reduce((s, d) => s + Number(d.paid_amount), 0);
  const totalRemaining = totalDebt - totalPaid;

  const closeForm = () => {
    setView("list");
    setEditingDebt(null);
    setName(""); setEntity(""); setTotalAmount(""); setPaidAmount("0"); setNotes(""); setIcon("💳"); setColor("#ef4444");
  };

  const closePay = () => {
    setView("list");
    setPayingDebt(null);
    setPayAmount("");
  };

  const openCreate = () => {
    setEditingDebt(null);
    setName(""); setEntity(""); setTotalAmount(""); setPaidAmount("0"); setNotes(""); setIcon("💳"); setColor("#ef4444");
    setView("form");
  };

  const openEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setName(debt.name);
    setEntity(debt.entity);
    setTotalAmount(String(debt.total_amount));
    setPaidAmount(String(debt.paid_amount));
    setNotes(debt.notes ?? "");
    setIcon(debt.icon);
    setColor(debt.color);
    setView("form");
  };

  const openPay = (debt: Debt) => {
    setPayingDebt(debt);
    setPayAmount("");
    setView("pay");
  };

  useBackButtonClose(view !== "list", view === "pay" ? closePay : closeForm);

  const handleSave = async () => {
    if (!name || !entity || !totalAmount || Number(totalAmount) <= 0) return;
    setLoading(true);
    const total = Number(totalAmount);
    const paid = Math.min(Number(paidAmount) || 0, total);

    if (editingDebt) {
      await supabase.from("debts").update({
        name, entity, total_amount: total, paid_amount: paid,
        notes: notes || null, icon, color,
      }).eq("id", editingDebt.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      await supabase.from("debts").insert({
        user_id: user.id, name, entity,
        total_amount: total, paid_amount: paid,
        notes: notes || null, icon, color,
      });
    }
    setLoading(false);
    closeForm();
    onRefresh();
  };

  const handlePay = async () => {
    if (!payingDebt) return;
    const n = Number(payAmount);
    if (!n || n <= 0) return;
    const newPaid = Math.min(Number(payingDebt.paid_amount) + n, Number(payingDebt.total_amount));
    await supabase.from("debts").update({ paid_amount: newPaid }).eq("id", payingDebt.id);
    closePay();
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("debts").delete().eq("id", id);
    onRefresh();
  };

  if (view === "form") {
    return (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <p className="font-semibold text-sm">{editingDebt ? "Editar deuda" : "Nueva deuda"}</p>

          <div className="space-y-1">
            <Label>Icono</Label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((ic) => (
                <button key={ic} type="button" onClick={() => setIcon(ic)}
                  className={`text-xl p-1.5 rounded-lg transition-all ${icon === ic ? "bg-orange-100 ring-2 ring-orange-400 scale-110" : "hover:bg-gray-100"}`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Nombre de la deuda</Label>
            <Input placeholder="Ej: Crédito vivienda, Tarjeta de crédito…" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div className="space-y-1">
            <Label>Entidad financiera</Label>
            <Input placeholder="Ej: Bancolombia, Davivienda…" value={entity} onChange={(e) => setEntity(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Monto total de la deuda</Label>
            <Input type="number" inputMode="decimal" placeholder="0" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Ya pagado <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
            <Input type="number" inputMode="decimal" placeholder="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Notas <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
            <Input placeholder="Ej: Cuota mensual $350,000, vence el 15…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={closeForm}>Cancelar</Button>
            <Button
              className="flex-1 bg-orange-600 hover:bg-orange-700"
              onClick={handleSave}
              disabled={loading || !name || !entity || !totalAmount || Number(totalAmount) <= 0}
            >
              {loading ? "Guardando..." : editingDebt ? "Guardar cambios" : "Crear deuda"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (view === "pay" && payingDebt) {
    const remaining = Number(payingDebt.total_amount) - Number(payingDebt.paid_amount);
    return (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{payingDebt.icon}</span>
            <div>
              <p className="font-semibold text-sm">{payingDebt.name}</p>
              <p className="text-xs text-muted-foreground">{payingDebt.entity} — pendiente: {fmt(remaining)}</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Monto del pago</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={closePay}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={handlePay}
              disabled={!payAmount || Number(payAmount) <= 0}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" /> Registrar pago
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {debts.length > 0 && (
        <Card className="border-orange-100 bg-orange-50">
          <CardContent className="pt-4">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-800">Resumen de deudas</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-orange-600 font-medium">Total deuda</p>
                <p className="text-sm font-bold text-orange-800">{fmt(totalDebt)}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-600 font-medium">Pagado</p>
                <p className="text-sm font-bold text-emerald-700">{fmt(totalPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-red-600 font-medium">Pendiente</p>
                <p className="text-sm font-bold text-red-700">{fmt(totalRemaining)}</p>
              </div>
            </div>
            {totalDebt > 0 && (
              <div className="mt-3">
                <Progress value={(totalPaid / totalDebt) * 100} className="h-2 bg-orange-100 [&>div]:bg-emerald-500" />
                <p className="text-xs text-orange-700 mt-1 text-right">{Math.round((totalPaid / totalDebt) * 100)}% pagado</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {debts.length === 0 && (
        <div className="text-center py-8 space-y-3 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <p className="text-4xl">💳</p>
          <div className="px-4">
            <p className="text-sm font-semibold text-gray-700">Sin deudas registradas</p>
            <p className="text-xs text-muted-foreground mt-1">
              Lleva el control de tus deudas: cuánto debes, en qué entidad y lo que ya pagaste.
            </p>
          </div>
          <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Registrar primera deuda
          </Button>
        </div>
      )}

      {debts.map((debt) => {
        const total = Number(debt.total_amount);
        const paid = Number(debt.paid_amount);
        const remaining = total - paid;
        const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
        const settled = remaining <= 0;
        return (
          <Card key={debt.id} className={settled ? "border-green-200 bg-green-50" : ""}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{debt.icon}</span>
                  <div>
                    <p className="font-semibold text-sm">{debt.name}</p>
                    <p className="text-xs text-muted-foreground">{debt.entity}</p>
                    {debt.notes && <p className="text-xs text-muted-foreground mt-0.5">{debt.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {settled && <Badge className="bg-green-500 text-xs mr-1">Saldada</Badge>}
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" aria-label="Editar" onClick={() => openEdit(debt)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-red-400" aria-label="Eliminar" onClick={() => handleDelete(debt.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{fmt(paid)} pagado</span>
                  <span>{Math.round(pct)}% — {settled ? "¡Saldada!" : `faltan ${fmt(remaining)}`}</span>
                </div>
                <Progress value={pct} className={`h-2 ${settled ? "[&>div]:bg-green-500" : "[&>div]:bg-orange-500"}`} />
                <p className="text-xs text-right text-muted-foreground mt-1">Deuda total: {fmt(total)}</p>
              </div>

              {!settled && (
                <Button variant="outline" size="sm" className="w-full border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => openPay(debt)}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Registrar pago
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      {debts.length > 0 && (
        <Button variant="outline" className="w-full" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Nueva deuda
        </Button>
      )}
    </div>
  );
}
