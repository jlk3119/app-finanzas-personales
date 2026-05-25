"use client";

import { useState } from "react";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { createClient } from "@/utils/supabase/client";
import type { Category } from "@/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pencil, Trash2, Plus, Check, X, ChevronLeft, Lock } from "lucide-react";

type Props = {
  categories: Category[];
  companyId: string;
  role: "owner" | "employee";
  onClose: () => void;
  onRefresh: () => void;
};

const ICONS = [
  "🍽️","☕","🍔","🍕","🍜","🥗","🍺","🧃","🍰","🛒",
  "🚌","🚗","🚕","✈️","🚇","🛵","⛽","🅿️",
  "🏠","🛋️","🔧","🚿","⚡","📦","🧹","🔑",
  "💊","🏥","🧴","🏋️","🧘","💉","🦷","👁️",
  "🎬","🎮","🎵","🎭","📺","🎲","🎯","🎪",
  "👕","👟","💅","💍","👜","🕶️","💄",
  "📚","🎓","💻","📱","🖊️","📐","🔬","📊",
  "🐶","🐱","🐾","🦮","🐠","🐰",
  "👶","🎁","🎂","💐","❤️","👨‍👩‍👧",
  "💰","💳","🏦","📈","🏆",
  "🛡️","⛑️","🚨","🧯","🆘",
  "🌿","⚽","🏖️","🌍","🔖",
];
const AUTO_COLORS = ["#f59e0b","#3b82f6","#8b5cf6","#ef4444","#ec4899","#14b8a6","#f97316","#6b7280","#10b981","#06b6d4","#84cc16","#a855f7"];

type FormState = { name: string; icon: string; color: string; parent_id: string };
const EMPTY: FormState = { name: "", icon: "📦", color: "#6b7280", parent_id: "" };

export default function CategoryManager({ categories, companyId, role, onClose, onRefresh }: Props) {
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmCat = confirmId ? categories.find((c) => c.id === confirmId) : null;
  const confirmChildrenCount = confirmCat ? categories.filter((c) => c.parent_id === confirmCat.id).length : 0;

  const parents = categories.filter((c) => !c.parent_id);
  const childrenOf = (pid: string) => categories.filter((c) => c.parent_id === pid);

  const openCreate = () => {
    const autoColor = AUTO_COLORS[categories.filter(c => !c.parent_id).length % AUTO_COLORS.length];
    setForm({ ...EMPTY, color: autoColor });
    setEditingId(null);
    setShowForm(true);
  };
  const openCreateSub = (parentCat: Category) => {
    setForm({ name: "", icon: parentCat.icon, color: parentCat.color, parent_id: parentCat.id });
    setEditingId(null);
    setShowForm(true);
  };
  const openEdit = (cat: Category) => {
    setForm({ name: cat.name, icon: cat.icon, color: cat.color, parent_id: cat.parent_id ?? "" });
    setEditingId(cat.id);
    setShowForm(true);
  };
  const cancel = () => { setShowForm(false); setEditingId(null); setForm(EMPTY); };

  useBackButtonClose(showForm, cancel);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    if (editingId) {
      await supabase.from("categories").update({
        name: form.name.trim(), icon: form.icon, color: form.color,
      }).eq("id", editingId);
    } else {
      await supabase.from("categories").insert({
        name: form.name.trim(), icon: form.icon, color: form.color,
        company_id: companyId,
        parent_id: form.parent_id || null,
      });
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

  const selectedParentCat = form.parent_id ? categories.find((c) => c.id === form.parent_id) : null;
  const formTitle = showForm
    ? editingId ? "Editar categoría" : selectedParentCat ? "Nueva subcategoría" : "Nueva categoría"
    : "Categorías";

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] flex flex-col gap-0 p-0 pb-8" showCloseButton={false}>
        <SheetHeader className="sticky top-0 z-10 bg-white rounded-t-2xl flex-row items-center justify-between px-4 py-3 border-b mb-0 gap-0">
          <div className="flex items-center gap-1">
            {showForm && (
              <Button variant="ghost" size="icon" className="w-8 h-8 -ml-1 text-muted-foreground" onClick={cancel}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            <SheetTitle className="text-base">{formTitle}</SheetTitle>
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground" onClick={showForm ? cancel : onClose}>
            <X className="w-4 h-4" />
          </Button>
        </SheetHeader>

        <div className="overflow-y-auto flex-1 px-4 pt-4">

          {/* ── Lista jerárquica ── */}
          {!showForm && (
            <div className="space-y-3 pb-4">
              {parents.map((cat) => {
                const children = childrenOf(cat.id);
                return (
                  <div key={cat.id}>
                    {/* Categoría padre */}
                    <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${cat.is_system ? "bg-emerald-50 border border-emerald-100" : "bg-gray-50"}`}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: cat.color + "33" }}>
                          {cat.icon}
                        </div>
                        <div>
                          <span className="font-medium text-sm">{cat.name}</span>
                          {cat.is_system && (
                            <p className="text-xs text-emerald-600 flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> Sistema
                            </p>
                          )}
                          {children.length > 0 && (
                            <p className="text-xs text-muted-foreground">{children.length} subcategoría{children.length !== 1 ? "s" : ""}</p>
                          )}
                        </div>
                      </div>
                      {!cat.is_system && (
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-emerald-500"
                            title="Agregar subcategoría" onClick={() => openCreateSub(cat)}>
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground" aria-label="Editar" onClick={() => openEdit(cat)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-red-400" aria-label="Eliminar"
                            onClick={() => setConfirmId(cat.id)} disabled={deletingId === cat.id}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Subcategorías */}
                    {children.map((child) => (
                      <div key={child.id} className="flex items-center justify-between rounded-xl px-3 py-2 bg-white border border-gray-100 ml-5 mt-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">↳</span>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-base shrink-0" style={{ backgroundColor: child.color + "33" }}>
                            {child.icon}
                          </div>
                          <span className="text-sm text-gray-700">{child.name}</span>
                        </div>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" aria-label="Editar" onClick={() => openEdit(child)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-red-400" aria-label="Eliminar"
                            onClick={() => setConfirmId(child.id)} disabled={deletingId === child.id}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              <Button variant="outline" className="w-full mt-1" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1" /> Nueva categoría
              </Button>
            </div>
          )}

          {/* ── Formulario ── */}
          {showForm && (
            <div className="space-y-4 pb-4">

              {/* Badge: subcategoría de [padre] */}
              {!editingId && selectedParentCat && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: selectedParentCat.color + "33" }}>
                    {selectedParentCat.icon}
                  </div>
                  <span className="text-sm text-emerald-700 flex-1">
                    Subcategoría de <strong>{selectedParentCat.name}</strong>
                  </span>
                  <button type="button" onClick={() => setForm({ ...form, parent_id: "" })} className="text-emerald-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Selector de categoría padre (solo al crear, sin padre seleccionado) */}
              {!editingId && !form.parent_id && parents.filter((p) => !p.is_system).length > 0 && (
                <div className="space-y-1.5">
                  <Label>¿Es subcategoría de…? <span className="font-normal text-muted-foreground text-xs">(opcional)</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {parents.filter((p) => !p.is_system).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setForm({ ...form, parent_id: p.id, icon: p.icon, color: p.color })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-sm text-gray-700 hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
                      >
                        {p.icon} {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label>Nombre</Label>
                <Input
                  placeholder={selectedParentCat ? "Ej: Restaurantes, Mercado, Domicilios…" : "Ej: Mascotas, Deportes, Salud…"}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Icono</Label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map((ic) => (
                    <button key={ic} type="button" onClick={() => setForm({ ...form, icon: ic })}
                      className={`text-2xl p-1.5 rounded-xl transition-all ${form.icon === ic ? "ring-2 ring-emerald-500 bg-emerald-50 scale-110" : "hover:bg-gray-100"}`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: form.color + "33" }}>
                  {form.icon}
                </div>
                <div>
                  {selectedParentCat && <p className="text-xs text-muted-foreground">{selectedParentCat.name} ›</p>}
                  <span className="font-medium text-sm">{form.name || "Vista previa"}</span>
                </div>
              </div>

              <div className="flex gap-2 pb-2">
                <Button variant="outline" className="flex-1" onClick={cancel}>
                  <X className="w-4 h-4 mr-1" /> Cancelar
                </Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={loading || !form.name.trim()}>
                  <Check className="w-4 h-4 mr-1" /> {loading ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => !open && setConfirmId(null)}
        title="¿Eliminar esta categoría?"
        description={confirmCat ? `${confirmCat.icon} ${confirmCat.name}${confirmChildrenCount > 0 ? ` y sus ${confirmChildrenCount} subcategoría${confirmChildrenCount > 1 ? "s" : ""}` : ""}. Los gastos asociados quedarán sin categoría. Esta acción no se puede deshacer.` : "Esta acción no se puede deshacer."}
        loading={deletingId === confirmId}
        onConfirm={async () => { if (confirmId) await handleDelete(confirmId); }}
      />
    </Sheet>
  );
}
