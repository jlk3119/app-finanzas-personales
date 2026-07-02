"use client";

import { useMoney } from "@/components/PrivacyProvider";

import { useState } from "react";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { createClient } from "@/utils/supabase/client";
import type { Goal, Category } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Trash2, PlusCircle, CheckCircle2, Pencil, X } from "lucide-react";
import { useSnackbar } from "@/components/SnackbarProvider";

type Props = { goals: Goal[]; categories: Category[]; onRefresh: () => void };

const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const ICONS = [
  "🏠","🛋️","🔑","🏡","🏗️","🛁",
  "✈️","🏖️","🌍","🏕️","🚢","🗺️","🎒","🏔️",
  "🚗","🏍️","🚲","⛵","🚐",
  "📱","💻","🎮","📷","🎧","⌚","📺","🖥️",
  "🎓","📚","🏫","🔬","✏️","🎨",
  "👶","💍","💒","👨‍👩‍👧","🐶","🐱",
  "🏋️","🧘","🚴","⚽","🎾","🏊","🥊","🏆",
  "💰","💎","📈","🏦","🪙","💵",
  "🛡️","⛑️","🚨","🧯","🆘",
  "🎯","🎉","🎁","🌟","🥂","🎪",
  "🌱","☕","🍕","🎵","📸","🧳",
];

export default function GoalsList({ goals, categories, onRefresh }: Props) {
  const fmt = useMoney();
  const supabase = createClient();
  const snackbar = useSnackbar();
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [deadline, setDeadline] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingGoal, setDeletingGoal] = useState(false);
  const confirmGoal = confirmId ? goals.find((g) => g.id === confirmId) : null;

  const [addingToGoal, setAddingToGoal] = useState<Goal | null>(null);
  const [addAmount, setAddAmount] = useState("");
  const [addCategoryId, setAddCategoryId] = useState<string>("");

  // Only show top-level categories (no subcategories) in dropdowns
  const rootCategories = categories.filter((c) => !c.parent_id);

  const closeForm = () => {
    setShowForm(false);
    setEditingGoal(null);
    setName(""); setTarget(""); setCurrent("0"); setDeadline(""); setIcon("🎯"); setFormCategoryId("");
  };

  const openCreate = () => {
    setEditingGoal(null);
    setName(""); setTarget(""); setCurrent("0"); setDeadline(""); setIcon("🎯"); setFormCategoryId("");
    setShowForm(true);
  };

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setName(goal.name);
    setTarget(String(goal.target_amount));
    setCurrent(String(goal.current_amount));
    setDeadline(goal.deadline ?? "");
    setIcon(goal.icon);
    setFormCategoryId(goal.category_id ?? "");
    setShowForm(true);
  };

  const openAddSaving = (goal: Goal) => {
    setAddingToGoal(goal);
    setAddAmount("");
    setAddCategoryId(goal.category_id ?? "");
  };

  const closeAddSaving = () => {
    setAddingToGoal(null);
    setAddAmount("");
    setAddCategoryId("");
  };

  useBackButtonClose(showForm, closeForm);
  useBackButtonClose(addingToGoal !== null, closeAddSaving);

  const handleSave = async () => {
    if (!name || !target || Number(target) <= 0) return;
    setLoading(true);
    try {
      const currentAmt = Number(current) || 0;
      const targetAmt = Number(target);
      const categoryId = formCategoryId || null;

      if (editingGoal) {
        const { error } = await supabase.from("goals").update({
          name,
          target_amount: targetAmt,
          current_amount: Math.min(currentAmt, targetAmt),
          deadline: deadline || null,
          icon,
          category_id: categoryId,
          completed: currentAmt >= targetAmt,
        }).eq("id", editingGoal.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = await supabase.from("goals").insert({
          user_id: user.id, name, icon,
          target_amount: targetAmt,
          current_amount: Math.min(currentAmt, targetAmt),
          deadline: deadline || null,
          category_id: categoryId,
          completed: currentAmt >= targetAmt,
        });
        if (error) throw error;
      }
      snackbar(editingGoal ? "Meta actualizada" : "Meta creada", "success");
      closeForm();
      onRefresh();
    } catch (err) {
      console.error("Error al guardar meta:", err);
      snackbar("No se pudo guardar la meta", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAmount = async () => {
    if (!addingToGoal) return;
    const goal = addingToGoal;
    const n = Number(addAmount);
    if (!n || n <= 0) return;

    try {
      const newAmt = Math.min(goal.current_amount + n, goal.target_amount);
      const { error } = await supabase.from("goals").update({
        current_amount: newAmt,
        completed: newAmt >= goal.target_amount,
      }).eq("id", goal.id);
      if (error) throw error;

      // If a source category is selected, also record it as an expense so the budget reflects it
      if (addCategoryId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: expErr } = await supabase.from("expenses").insert({
            user_id: user.id,
            category_id: addCategoryId,
            amount: n,
            description: `Ahorro: ${goal.name}`,
            date: toLocalDateStr(new Date()),
          });
          if (expErr) throw expErr;
        }
      }

      snackbar("Ahorro registrado", "success");
      closeAddSaving();
      onRefresh();
    } catch (err) {
      console.error("Error al registrar ahorro:", err);
      snackbar("No se pudo registrar el ahorro", "error");
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingGoal(true);
    try {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
      snackbar("Meta eliminada", "success");
      onRefresh();
    } catch (err) {
      console.error("Error al eliminar meta:", err);
      snackbar("No se pudo eliminar la meta", "error");
    } finally {
      setDeletingGoal(false);
    }
  };

  return (
    <div className="space-y-4">
      {goals.length === 0 && !showForm && (
        <div className="text-center py-8 space-y-3 bg-surface rounded-2xl border border-dashed border-outline-variant">
          <p className="text-4xl">🎯</p>
          <div className="px-4">
            <p className="text-sm font-semibold text-on-surface">Sin metas financieras</p>
            <p className="text-xs text-muted-foreground mt-1">
              Define un objetivo de ahorro (viaje, fondo de emergencia, electrodoméstico…) y registra cuánto llevas acumulado.
            </p>
          </div>
          <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Crear primera meta
          </Button>
        </div>
      )}

      {goals.map((goal) => {
        const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
        const remaining = goal.target_amount - goal.current_amount;
        const isAdding = addingToGoal?.id === goal.id;
        return (
          <Card key={goal.id} className={goal.completed ? "border-success/30 bg-success-container" : ""}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{goal.icon}</span>
                  <div>
                    <p className="font-semibold text-sm">{goal.name}</p>
                    {goal.category_id && goal.categories && (
                      <p className="text-xs text-muted-foreground">
                        {goal.categories.icon} {goal.categories.name}
                      </p>
                    )}
                    {goal.deadline && (
                      <p className="text-xs text-muted-foreground">
                        Fecha límite: {new Date(goal.deadline + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {goal.completed && <Badge className="bg-success text-xs mr-1">Completada</Badge>}
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" aria-label="Editar" onClick={() => openEdit(goal)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-error" aria-label="Eliminar" onClick={() => setConfirmId(goal.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{fmt(goal.current_amount)} ahorrado</span>
                  <span>{Math.round(pct)}% — faltan {fmt(remaining)}</span>
                </div>
                <Progress value={pct} className="h-2" />
                <p className="text-xs text-right text-muted-foreground mt-1">Meta: {fmt(goal.target_amount)}</p>
              </div>

              {!goal.completed && (
                isAdding ? (
                  <div className="space-y-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="Monto a ahorrar"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      className="h-9 text-sm"
                      autoFocus
                    />
                    <select
                      value={addCategoryId}
                      onChange={(e) => setAddCategoryId(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Sin categoría (solo actualiza el ahorro)</option>
                      {rootCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                    {addCategoryId && (
                      <p className="text-xs text-muted-foreground">
                        Se registrará un gasto en <strong>{rootCategories.find(c => c.id === addCategoryId)?.name}</strong> para descontar del presupuesto.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-success hover:bg-success/90 flex-1" onClick={handleAddAmount}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Guardar ahorro
                      </Button>
                      <Button size="sm" variant="outline" className="shrink-0" onClick={closeAddSaving}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => openAddSaving(goal)}>
                    <PlusCircle className="w-3.5 h-3.5 mr-1" /> Agregar ahorro
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        );
      })}

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="font-semibold text-sm">{editingGoal ? "Editar meta" : "Nueva meta financiera"}</p>

            <div className="space-y-1">
              <Label>Icono</Label>
              <div className="flex flex-wrap gap-1.5">
                {ICONS.map((ic) => (
                  <button key={ic} type="button" onClick={() => setIcon(ic)}
                    className={`text-xl p-1.5 rounded-lg transition-all ${icon === ic ? "bg-primary-container ring-2 ring-primary scale-110" : "hover:bg-surface-container"}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Nombre de la meta</Label>
              <Input placeholder="Ej: Viaje a la playa, Fondo de emergencia…" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>

            <div className="space-y-1">
              <Label>Monto objetivo</Label>
              <Input type="number" inputMode="decimal" placeholder="0" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>{editingGoal ? "Monto ahorrado hasta ahora" : "Ahorro inicial"} <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
              <Input type="number" inputMode="decimal" placeholder="0" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Fecha límite <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Categoría fuente por defecto <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sin categoría predeterminada</option>
                {rootCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Al agregar ahorros se preseleccionará esta categoría para descontar del presupuesto.</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={closeForm}>Cancelar</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleSave}
                disabled={loading || !name || !target || Number(target) <= 0}>
                {loading ? "Guardando..." : editingGoal ? "Guardar cambios" : "Crear meta"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!showForm && goals.length > 0 && (
        <Button variant="outline" className="w-full" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Nueva meta
        </Button>
      )}
      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => !open && setConfirmId(null)}
        title="¿Eliminar esta meta?"
        description={confirmGoal ? `${confirmGoal.icon} ${confirmGoal.name} · ${fmt(Number(confirmGoal.current_amount))} ahorrados. Esta acción no se puede deshacer.` : "Esta acción no se puede deshacer."}
        loading={deletingGoal}
        onConfirm={async () => { if (confirmId) await handleDelete(confirmId); }}
      />
    </div>
  );
}
