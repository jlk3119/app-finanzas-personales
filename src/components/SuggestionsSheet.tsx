"use client";

import { useEffect, useState } from "react";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { createClient } from "@/utils/supabase/client";
import type { Suggestion, SuggestionStatus } from "@/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Lightbulb, Send, Trash2, X, CheckCircle2, AlertCircle } from "lucide-react";

type Props = {
  onClose: () => void;
};

const MAX_LENGTH = 1000;

const STATUS_META: Record<SuggestionStatus, { label: string; className: string }> = {
  pending: { label: "En revisión", className: "bg-surface-container-highest text-on-surface-variant" },
  planned: { label: "Planeada", className: "bg-secondary-container text-on-secondary-container" },
  done: { label: "Implementada", className: "bg-success-container text-success" },
  declined: { label: "Descartada", className: "bg-error/10 text-error" },
};

export default function SuggestionsSheet({ onClose }: Props) {
  const supabase = createClient();
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Suggestion | null>(null);
  const [deleting, setDeleting] = useState(false);

  useBackButtonClose(true, onClose);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("suggestions")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (active) setSuggestions((data as Suggestion[]) ?? []);
      } catch (err) {
        console.error("Error al cargar sugerencias", err);
        if (active) setFeedback({ type: "error", message: "No se pudieron cargar tus sugerencias." });
      } finally {
        if (active) setLoadingList(false);
      }
    })();
    return () => { active = false; };
  }, [supabase]);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión no encontrada");
      const { data, error } = await supabase
        .from("suggestions")
        .insert({ user_id: user.id, text: trimmed })
        .select()
        .single();
      if (error) throw error;
      setSuggestions((prev) => [data as Suggestion, ...prev]);
      setText("");
      setFeedback({ type: "success", message: "¡Gracias! Tu sugerencia fue enviada." });
    } catch (err) {
      console.error("Error al enviar sugerencia", err);
      setFeedback({ type: "error", message: "No se pudo enviar tu sugerencia. Intenta de nuevo." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (suggestion: Suggestion) => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("suggestions").delete().eq("id", suggestion.id);
      if (error) throw error;
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    } catch (err) {
      console.error("Error al eliminar sugerencia", err);
      setFeedback({ type: "error", message: "No se pudo eliminar la sugerencia." });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[90vh] flex flex-col gap-0 p-0 pb-8"
        showCloseButton={false}
      >
        <SheetHeader className="sticky top-0 z-10 bg-surface-container-lowest rounded-t-2xl flex-row items-center justify-between px-4 py-3 border-b mb-0 gap-0">
          <SheetTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" /> Sugerencias
          </SheetTitle>
          <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose} className="h-8 w-8">
            <X className="w-5 h-5" />
          </Button>
        </SheetHeader>

        <div className="overflow-y-auto px-4 py-4 space-y-5">
          <p className="text-sm text-on-surface-variant">
            ¿Qué te gustaría que la app pudiera hacer? Escribe tus ideas y las revisaré para
            futuras versiones.
          </p>

          <div className="space-y-2">
            <Textarea
              aria-label="Tu sugerencia"
              placeholder="Ej.: Me gustaría poder exportar mis gastos a PDF…"
              value={text}
              maxLength={MAX_LENGTH}
              onChange={(e) => setText(e.target.value)}
              className="min-h-24"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">{text.length}/{MAX_LENGTH}</span>
              <Button
                onClick={handleSubmit}
                disabled={!text.trim() || submitting}
                className="bg-primary hover:bg-primary/90"
              >
                <Send className="w-4 h-4 mr-1.5" />
                {submitting ? "Enviando…" : "Enviar sugerencia"}
              </Button>
            </div>
            {feedback && (
              <div
                role="status"
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                  feedback.type === "success"
                    ? "bg-success-container text-success"
                    : "bg-error/10 text-error"
                }`}
              >
                {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{feedback.message}</span>
              </div>
            )}
          </div>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Tus sugerencias
            </h3>
            {loadingList ? (
              <p className="text-sm text-on-surface-variant py-4 text-center">Cargando…</p>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-on-surface-variant py-4 text-center">
                Aún no has enviado sugerencias.
              </p>
            ) : (
              <ul className="space-y-2">
                {suggestions.map((s) => {
                  const meta = STATUS_META[s.status];
                  return (
                    <li
                      key={s.id}
                      className="flex items-start gap-2 rounded-2xl border border-outline-variant px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-sm text-on-surface whitespace-pre-wrap break-words">{s.text}</p>
                        <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.className}`}>
                          {meta.label}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(s)}
                        aria-label="Eliminar sugerencia"
                        className="shrink-0 grid place-items-center w-9 h-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="¿Eliminar esta sugerencia?"
        description="Se eliminará de tu lista. Esta acción no se puede deshacer."
        loading={deleting}
        onConfirm={async () => { if (confirmDelete) await handleDelete(confirmDelete); }}
      />
    </>
  );
}
