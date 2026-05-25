"use client";

import { useState, useEffect } from "react";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { createClient } from "@/utils/supabase/client";
import type { Client } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Trash2, Search, User, Phone, Mail } from "lucide-react";

type Props = {
  clients: Client[];
  companyId: string;
  role: "owner" | "employee";
  onRefresh: () => void;
  onRequestNew?: number;
};

type View = "list" | "form";

type FormState = {
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  notes: string;
};

const EMPTY: FormState = { name: "", contact_name: "", email: "", phone: "", notes: "" };

export default function ClientsManager({ clients, companyId, role, onRefresh, onRequestNew }: Props) {
  const supabase = createClient();
  const [view, setView] = useState<View>("list");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirmClient = confirmId ? clients.find((c) => c.id === confirmId) : null;

  const openCreate = () => {
    setEditingClient(null);
    setForm(EMPTY);
    setView("form");
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if ((onRequestNew ?? 0) > 0 && view === "list") openCreate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRequestNew]);

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      contact_name: client.contact_name ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      notes: client.notes ?? "",
    });
    setView("form");
  };

  const closeForm = () => {
    setView("list");
    setEditingClient(null);
    setForm(EMPTY);
  };

  useBackButtonClose(view === "form", closeForm);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    const payload = {
      name: form.name.trim(),
      contact_name: form.contact_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editingClient) {
      await supabase.from("clients").update(payload).eq("id", editingClient.id);
    } else {
      await supabase.from("clients").insert({ ...payload, company_id: companyId });
    }
    setLoading(false);
    closeForm();
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from("clients").delete().eq("id", id);
    setDeletingId(null);
    onRefresh();
  };

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  if (view === "form") {
    return (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <p className="font-semibold text-sm">{editingClient ? "Editar cliente" : "Nuevo cliente"}</p>

          <div className="space-y-1">
            <Label>Nombre del cliente o empresa <span className="text-rose-500">*</span></Label>
            <Input
              placeholder="Ej: Tienda La Esquina, María Pérez…"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label>Contacto <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
            <Input
              placeholder="Nombre de la persona de contacto"
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label>Teléfono <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
            <Input
              type="tel"
              inputMode="tel"
              placeholder="Ej: 300 123 4567"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label>Email <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
            <Input
              type="email"
              inputMode="email"
              placeholder="Ej: cliente@correo.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label>Notas <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
            <Input
              placeholder="Observaciones, dirección, etc."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={closeForm}>Cancelar</Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSave}
              disabled={loading || !form.name.trim()}
            >
              {loading ? "Guardando..." : editingClient ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {clients.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {clients.length === 0 && (
        <div className="text-center py-8 space-y-3 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <p className="text-4xl">👥</p>
          <div className="px-4">
            <p className="text-sm font-semibold text-gray-700">Sin clientes registrados</p>
            <p className="text-xs text-muted-foreground mt-1">
              Registra tus clientes para asociarlos a pedidos y llevar un mejor control.
            </p>
          </div>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Registrar primer cliente
          </Button>
        </div>
      )}

      {filtered.map((client) => (
        <Card key={client.id}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{client.name}</p>
                  {client.contact_name && (
                    <p className="text-xs text-muted-foreground truncate">{client.contact_name}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {client.phone && (
                      <a href={`tel:${client.phone}`} className="text-xs text-emerald-600 flex items-center gap-0.5">
                        <Phone className="w-3 h-3" /> {client.phone}
                      </a>
                    )}
                    {client.email && (
                      <a href={`mailto:${client.email}`} className="text-xs text-emerald-600 flex items-center gap-0.5">
                        <Mail className="w-3 h-3" /> {client.email}
                      </a>
                    )}
                  </div>
                  {client.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{client.notes}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-0.5 shrink-0 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-muted-foreground"
                  aria-label="Editar"
                  onClick={() => openEdit(client)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {role === "owner" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 text-red-400"
                    aria-label="Eliminar"
                    onClick={() => setConfirmId(client.id)}
                    disabled={deletingId === client.id}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {search && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Sin resultados para &ldquo;{search}&rdquo;
        </p>
      )}

      {clients.length > 0 && (
        <Button variant="outline" className="w-full" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Nuevo cliente
        </Button>
      )}

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => !open && setConfirmId(null)}
        title="¿Eliminar este cliente?"
        description={
          confirmClient
            ? `${confirmClient.name}. Los pedidos asociados quedarán sin cliente. Esta acción no se puede deshacer.`
            : "Esta acción no se puede deshacer."
        }
        loading={deletingId === confirmId}
        onConfirm={async () => { if (confirmId) await handleDelete(confirmId); }}
      />
    </div>
  );
}
