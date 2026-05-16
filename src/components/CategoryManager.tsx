"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { Category } from "@/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";

type Props = {
  categories: Category[];
  onClose: () => void;
  onRefresh: () => void;
};

const ICONS = ["🍽️","🚌","🏠","💊","🎬","👕","📚","📦","☕","🛒","💅","🐶","⚽","🎮","💻","📱","✈️","🎁","🏋️","🎓","💈","🚿","⚡","🅿️"];
const COLORS = ["#f59e0b","#3b82f6","#8b5cf6","#ef4444","#ec4899","#14b8a6","#f97316","#6b7280","#10b981","#06b6d4","#84cc16","#a855f7"];

type FormState = { name: string; icon: string; color: string };
const EMPTY: FormState = { name: "", icon: "📦", color: "#6b7280" };

export default function CategoryManager({ categories, onClose, onRefresh }: Props) {
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openCreate = () => { setForm(EMPTY); setEditingId(null); setShowForm(true); };
  const openEdit = (cat: Category) => { setForm({ name: cat.name, icon: cat.icon, color: cat.color }); setEditingId(cat.id); setShowForm(true); };
  const cancel = () => { setShowForm(false); setEditingId(null); setForm(EMPTY); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    if (editingId) {
      await supabase.from("categories").update({ name: form.name.trim(), icon: form.icon, color: form.color }).eq("id", editingId);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      await supabase.from("categories").insert({ name: form.name.trim(), icon: form.icon, color: form.color, user_id: user.id });
    }
    setLoading(false);
    cancel();
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from("categories").delete().eq("id", id);
    setDeletingId(null);
    onRefresh();
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle>Gestionar categorías</SheetTitle>
        </SheetHeader>

        {/* Category list */}
        {!showForm && (
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: cat.color + "33" }}>
                    {cat.icon}
                  </div>
                  <span className="font-medium text-sm">{cat.name}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground" onClick={() => openEdit(cat)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-red-400" onClick={() => handleDelete(cat.id)} disabled={deletingId === cat.id}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            <Button variant="outline" className="w-full mt-2" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Nueva categoría
            </Button>
          </div>
        )}

        {/* Create / Edit form */}
        {showForm && (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                placeholder="Ej: Mascotas"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Icono</Label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setForm({ ...form, icon: ic })}
                    className={`text-2xl p-1.5 rounded-xl transition-all ${form.icon === ic ? "ring-2 ring-violet-500 bg-violet-50 scale-110" : "hover:bg-gray-100"}`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                    style={{ backgroundColor: c }}
                  >
                    {form.color === c && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: form.color + "33" }}>
                {form.icon}
              </div>
              <span className="font-medium text-sm">{form.name || "Vista previa"}</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={cancel}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
              <Button className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={handleSave} disabled={loading || !form.name.trim()}>
                <Check className="w-4 h-4 mr-1" /> {loading ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
