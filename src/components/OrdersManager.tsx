"use client";

import { useState, useEffect } from "react";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { createClient } from "@/utils/supabase/client";
import type { Order, Client } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Trash2, Calendar, Clock } from "lucide-react";

type Props = {
  orders: Order[];
  clients: Client[];
  companyId: string;
  role: "owner" | "employee";
  onRefresh: () => void;
  onRequestNew?: number;
};

type StatusFilter = "active" | "pending" | "in_progress" | "delivered" | "cancelled" | "all";
type View = "list" | "form";
type OrderStatus = Order["status"];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; badge: string }> = {
  pending:     { label: "Pendiente",  color: "text-amber-700",   badge: "bg-amber-100 text-amber-700 border-amber-200" },
  in_progress: { label: "En curso",   color: "text-blue-700",    badge: "bg-blue-100 text-blue-700 border-blue-200" },
  delivered:   { label: "Entregado",  color: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancelled:   { label: "Cancelado",  color: "text-gray-500",    badge: "bg-gray-100 text-gray-500 border-gray-200" },
};

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active",      label: "Activos" },
  { value: "pending",     label: "Pendientes" },
  { value: "in_progress", label: "En curso" },
  { value: "delivered",   label: "Entregados" },
  { value: "cancelled",   label: "Cancelados" },
  { value: "all",         label: "Todos" },
];

export function getDaysUntilDelivery(dateStr: string): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delivery = new Date(dateStr + "T00:00:00");
  const diff = Math.round((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

type FormState = {
  client_id: string;
  description: string;
  total_value: string;
  advance_payment: string;
  status: OrderStatus;
  order_date: string;
  delivery_date: string;
  notes: string;
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY: FormState = {
  client_id: "",
  description: "",
  total_value: "",
  advance_payment: "0",
  status: "pending",
  order_date: todayStr(),
  delivery_date: "",
  notes: "",
};

export default function OrdersManager({ orders, clients, companyId, role, onRefresh, onRequestNew }: Props) {
  const supabase = createClient();
  const [view, setView] = useState<View>("list");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirmOrder = confirmId ? orders.find((o) => o.id === confirmId) : null;

  const openCreate = () => {
    setEditingOrder(null);
    setForm({ ...EMPTY, order_date: todayStr() });
    setView("form");
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if ((onRequestNew ?? 0) > 0 && view === "list") openCreate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRequestNew]);

  const openEdit = (order: Order) => {
    setEditingOrder(order);
    setForm({
      client_id: order.client_id ?? "",
      description: order.description,
      total_value: String(order.total_value),
      advance_payment: String(order.advance_payment),
      status: order.status,
      order_date: order.order_date,
      delivery_date: order.delivery_date ?? "",
      notes: order.notes ?? "",
    });
    setView("form");
  };

  const closeForm = () => {
    setView("list");
    setEditingOrder(null);
    setForm(EMPTY);
  };

  useBackButtonClose(view === "form", closeForm);

  const handleSave = async () => {
    if (!form.description.trim() || !form.total_value || Number(form.total_value) < 0) return;
    setLoading(true);
    const payload = {
      client_id: form.client_id || null,
      description: form.description.trim(),
      total_value: Number(form.total_value),
      advance_payment: Math.min(Number(form.advance_payment) || 0, Number(form.total_value)),
      status: form.status,
      order_date: form.order_date,
      delivery_date: form.delivery_date || null,
      notes: form.notes.trim() || null,
    };
    if (editingOrder) {
      await supabase.from("orders").update(payload).eq("id", editingOrder.id);
    } else {
      await supabase.from("orders").insert({ ...payload, company_id: companyId });
    }
    setLoading(false);
    closeForm();
    onRefresh();
  };

  const handleStatusChange = async (order: Order, status: OrderStatus) => {
    await supabase.from("orders").update({ status }).eq("id", order.id);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from("orders").delete().eq("id", id);
    setDeletingId(null);
    onRefresh();
  };

  const filtered = orders.filter((o) => {
    if (filter === "active") return o.status === "pending" || o.status === "in_progress";
    if (filter === "all") return true;
    return o.status === filter;
  });

  const DeliveryBadge = ({ dateStr }: { dateStr: string }) => {
    const days = getDaysUntilDelivery(dateStr);
    if (days === null) return null;
    const label = days < 0 ? `Venció hace ${Math.abs(days)}d` : days === 0 ? "Hoy" : `${days}d restantes`;
    const cls = days < 0 ? "text-rose-600 bg-rose-50 border-rose-200" : days <= 3 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-emerald-600 bg-emerald-50 border-emerald-200";
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cls}`}>
        <Clock className="w-3 h-3" /> {label}
      </span>
    );
  };

  if (view === "form") {
    return (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <p className="font-semibold text-sm">{editingOrder ? "Editar pedido" : "Nuevo pedido"}</p>

          <div className="space-y-1">
            <Label>Descripción del pedido <span className="text-rose-500">*</span></Label>
            <Input
              placeholder="Ej: 50 unidades camisetas bordadas…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label>Cliente <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
            <select
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            >
              <option value="">Sin cliente asignado</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Valor total <span className="text-rose-500">*</span></Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={form.total_value}
                onChange={(e) => setForm({ ...form, total_value: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Anticipo <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={form.advance_payment}
                onChange={(e) => setForm({ ...form, advance_payment: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Fecha del pedido</Label>
              <Input
                type="date"
                value={form.order_date}
                onChange={(e) => setForm({ ...form, order_date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Fecha de entrega <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
              <Input
                type="date"
                value={form.delivery_date}
                onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Estado</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(STATUS_CONFIG) as [OrderStatus, typeof STATUS_CONFIG[OrderStatus]][]).map(([s, cfg]) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, status: s })}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    form.status === s ? `${cfg.badge} font-semibold` : "bg-white text-gray-500 border-gray-200"
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notas <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
            <Input
              placeholder="Instrucciones, materiales, etc."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={closeForm}>Cancelar</Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSave}
              disabled={loading || !form.description.trim() || !form.total_value || Number(form.total_value) < 0}
            >
              {loading ? "Guardando..." : editingOrder ? "Guardar cambios" : "Crear pedido"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter(opt.value)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              filter === opt.value
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-gray-500 border-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {orders.length === 0 && (
        <div className="text-center py-8 space-y-3 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <p className="text-4xl">📋</p>
          <div className="px-4">
            <p className="text-sm font-semibold text-gray-700">Sin pedidos registrados</p>
            <p className="text-xs text-muted-foreground mt-1">
              Registra tus pedidos para hacer seguimiento de su valor, avance y fecha de entrega.
            </p>
          </div>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Registrar primer pedido
          </Button>
        </div>
      )}

      {orders.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">Sin pedidos en este estado.</p>
      )}

      {filtered.map((order) => {
        const client = clients.find((c) => c.id === order.client_id);
        const cfg = STATUS_CONFIG[order.status];
        const total = Number(order.total_value);
        const advance = Number(order.advance_payment);
        const saldo = total - advance;
        return (
          <Card key={order.id} className={order.status === "delivered" ? "border-emerald-200 bg-emerald-50" : order.status === "cancelled" ? "opacity-60" : ""}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-xs border ${cfg.badge} bg-transparent`}>{cfg.label}</Badge>
                    {order.delivery_date && <DeliveryBadge dateStr={order.delivery_date} />}
                  </div>
                  <p className="font-semibold text-sm mt-1 leading-tight">{order.description}</p>
                  {client && <p className="text-xs text-muted-foreground">{client.name}</p>}
                  {order.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{order.notes}</p>}
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 text-muted-foreground"
                    aria-label="Editar"
                    onClick={() => openEdit(order)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  {role === "owner" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-red-400"
                      aria-label="Eliminar"
                      onClick={() => setConfirmId(order.id)}
                      disabled={deletingId === order.id}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-xl px-3 py-2 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-sm font-bold">{fmt(total)}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600">Anticipo</p>
                  <p className="text-sm font-bold text-emerald-700">{fmt(advance)}</p>
                </div>
                <div>
                  <p className="text-xs text-rose-500">Saldo</p>
                  <p className="text-sm font-bold text-rose-600">{fmt(saldo)}</p>
                </div>
              </div>

              {order.delivery_date && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Entrega: {new Date(order.delivery_date + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}

              {order.status !== "delivered" && order.status !== "cancelled" && (
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {order.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                      onClick={() => handleStatusChange(order, "in_progress")}
                    >
                      Iniciar
                    </Button>
                  )}
                  {(order.status === "pending" || order.status === "in_progress") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => handleStatusChange(order, "delivered")}
                    >
                      Marcar entregado
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-gray-400"
                    onClick={() => handleStatusChange(order, "cancelled")}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {orders.length > 0 && (
        <Button variant="outline" className="w-full" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Nuevo pedido
        </Button>
      )}

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => !open && setConfirmId(null)}
        title="¿Eliminar este pedido?"
        description={
          confirmOrder
            ? `${confirmOrder.description} · ${fmt(Number(confirmOrder.total_value))}. Esta acción no se puede deshacer.`
            : "Esta acción no se puede deshacer."
        }
        loading={deletingId === confirmId}
        onConfirm={async () => { if (confirmId) await handleDelete(confirmId); }}
      />
    </div>
  );
}
