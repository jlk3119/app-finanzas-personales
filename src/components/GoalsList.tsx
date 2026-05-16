"use client";

import { useState } from "react";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { createClient } from "@/utils/supabase/client";
import type { Goal } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, PlusCircle, CheckCircle2 } from "lucide-react";

type Props = { goals: Goal[]; onRefresh: () => void };

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const ICONS = ["🎯","🏠","✈️","🚗","📱","💻","🎓","💍","👶","🏖️","💰","🏋️"];

export default function GoalsList({ goals, onRefresh }: Props) {
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [deadline, setDeadline] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [loading, setLoading] = useState(false);
  const [addingToGoal, setAddingToGoal] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState("");

  useBackButtonClose(showForm, () => setShowForm(false));
  useBackButtonClose(addingToGoal !== null, () => { setAddingToGoal(null); setAddAmount(""); });

  const handleCreate = async () => {
    if (!name || !target || Number(target) <= 0) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    await supabase.from("goals").insert({
      user_id: user.id,
      name,
      target_amount: Number(target),
      current_amount: Number(current) || 0,
      deadline: deadline || null,
      icon,
    });
    setShowForm(false);
    setName(""); setTarget(""); setCurrent("0"); setDeadline(""); setIcon("🎯");
    setLoading(false);
    onRefresh();
  };

  const handleAddAmount = async (goal: Goal) => {
    const n = Number(addAmount);
    if (!n || n <= 0) return;
    await supabase.from("goals").update({
      current_amount: Math.min(goal.current_amount + n, goal.target_amount),
      completed: goal.current_amount + n >= goal.target_amount,
    }).eq("id", goal.id);
    setAddingToGoal(null);
    setAddAmount("");
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("goals").delete().eq("id", id);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {goals.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-6">Sin metas financieras. ¡Crea una!</p>
      )}

      {goals.map((goal) => {
        const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
        const remaining = goal.target_amount - goal.current_amount;
        return (
          <Card key={goal.id} className={goal.completed ? "border-green-200 bg-green-50" : ""}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{goal.icon}</span>
                  <div>
                    <p className="font-semibold text-sm">{goal.name}</p>
                    {goal.deadline && (
                      <p className="text-xs text-muted-foreground">
                        Meta: {new Date(goal.deadline + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {goal.completed && <Badge className="bg-green-500 text-xs">Completada</Badge>}
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-red-400" onClick={() => handleDelete(goal.id)}>
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
                addingToGoal === goal.id ? (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="Monto a agregar"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <Button size="sm" className="bg-violet-600 hover:bg-violet-700" onClick={() => handleAddAmount(goal)}>
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setAddingToGoal(null); setAddAmount(""); }}>
                      ✕
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setAddingToGoal(goal.id)}>
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
            <p className="font-semibold text-sm">Nueva meta financiera</p>
            <div className="space-y-1">
              <Label>Icono</Label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map((ic) => (
                  <button key={ic} type="button" onClick={() => setIcon(ic)}
                    className={`text-xl p-1 rounded-lg ${icon === ic ? "bg-violet-100 ring-2 ring-violet-400" : ""}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nombre de la meta</Label>
              <Input placeholder="Ej: Viaje a la playa" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Monto objetivo</Label>
              <Input type="number" inputMode="decimal" placeholder="0" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Ya tengo ahorrado</Label>
              <Input type="number" inputMode="decimal" placeholder="0" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fecha límite (opcional)</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={handleCreate} disabled={loading}>
                {loading ? "Guardando..." : "Crear meta"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!showForm && (
        <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nueva meta
        </Button>
      )}
    </div>
  );
}
