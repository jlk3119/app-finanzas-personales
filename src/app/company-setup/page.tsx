"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Users, Check, Copy, ArrowLeft } from "lucide-react";

type Mode = "choose" | "create" | "join";

export default function CompanySetupPage() {
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("choose");
  const [companyName, setCompanyName] = useState("");
  const [nit, setNit] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (joinCode.length === 8) {
      supabase.rpc("get_company_by_join_code", { code: joinCode }).then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        setPreviewName(row?.name ?? null);
      });
    } else {
      // Reset preview when code is incomplete — must be in else branch to avoid no-op on length===8
      void Promise.resolve().then(() => setPreviewName(null));
    }
  }, [joinCode, supabase]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setLoading(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: company, error: compErr } = await supabase
      .from("companies")
      .insert({ name: companyName.trim(), nit: nit.trim() || null })
      .select()
      .single();

    if (compErr || !company) {
      setError("Error al crear la empresa. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    const { error: memberErr } = await supabase.from("company_members").insert({
      company_id: company.id,
      user_id: user.id,
      role: "owner",
    });

    if (memberErr) {
      setError("Error al configurar el rol. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    try {
      localStorage.setItem("minegocio_company", JSON.stringify({ companyId: company.id, role: "owner" }));
    } catch { /* ignore */ }

    setCreatedCode(company.join_code);
    setLoading(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.length !== 8 || !previewName) return;
    setLoading(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: companies } = await supabase.rpc("get_company_by_join_code", { code: joinCode });
    const company = Array.isArray(companies) ? companies[0] : companies;

    if (!company) {
      setError("Código inválido. Verifica con el dueño de la empresa.");
      setLoading(false);
      return;
    }

    const { error: memberErr } = await supabase.from("company_members").insert({
      company_id: company.id,
      user_id: user.id,
      role: "employee",
    });

    if (memberErr) {
      setError("No se pudo unir a la empresa. Quizás ya eres miembro.");
      setLoading(false);
      return;
    }

    try {
      localStorage.setItem("minegocio_company", JSON.stringify({ companyId: company.id, role: "employee" }));
      document.cookie = "has_company=1; path=/; max-age=2592000";
    } catch { /* ignore */ }

    location.href = "/";
  };

  const copyCode = async () => {
    if (!createdCode) return;
    await navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const goToDashboard = () => {
    try {
      document.cookie = "has_company=1; path=/; max-age=2592000";
    } catch { /* ignore */ }
    location.href = "/";
  };

  if (createdCode) {
    return (
      <Wrapper>
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold">¡Empresa creada!</h2>
              <p className="text-sm text-muted-foreground">
                Comparte este código con tus empleados para que puedan unirse.
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Código de empresa</p>
              <p className="text-3xl font-mono font-bold text-emerald-700 tracking-widest">{createdCode}</p>
              <Button variant="outline" size="sm" onClick={copyCode} className="text-xs">
                {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? "¡Copiado!" : "Copiar código"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              También puedes compartirlo más tarde desde Configuración.
            </p>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={goToDashboard}>
              Ir al panel de control
            </Button>
          </CardContent>
        </Card>
      </Wrapper>
    );
  }

  if (mode === "create") {
    return (
      <Wrapper>
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="text-4xl mb-2">🏢</div>
            <CardTitle className="text-xl">Crear empresa</CardTitle>
            <CardDescription>Serás el dueño y administrador</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="name">Nombre de la empresa *</Label>
                <Input
                  id="name"
                  placeholder="Ej: Taller Juan García"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nit">NIT / RUT <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                <Input
                  id="nit"
                  placeholder="Ej: 900123456-7"
                  value={nit}
                  onChange={(e) => setNit(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={loading || !companyName.trim()}
              >
                {loading ? "Creando…" : "Crear empresa"}
              </Button>
            </form>
            <button
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mx-auto"
              onClick={() => { setMode("choose"); setError(""); }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver
            </button>
          </CardContent>
        </Card>
      </Wrapper>
    );
  }

  if (mode === "join") {
    return (
      <Wrapper>
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="text-4xl mb-2">🤝</div>
            <CardTitle className="text-xl">Unirme a una empresa</CardTitle>
            <CardDescription>Ingresa el código que te dio el dueño</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleJoin} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="code">Código de empresa (8 caracteres)</Label>
                <Input
                  id="code"
                  placeholder="Ej: A1B2C3D4"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 8))}
                  className="text-center text-xl tracking-widest font-mono h-12"
                  autoFocus
                  autoComplete="off"
                />
              </div>
              {previewName && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-muted-foreground">Empresa encontrada</p>
                  <p className="font-semibold text-emerald-700">{previewName}</p>
                </div>
              )}
              {joinCode.length === 8 && !previewName && (
                <p className="text-sm text-amber-600 text-center">Código no encontrado. Verifica con el dueño.</p>
              )}
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={loading || !previewName}
              >
                {loading ? "Uniéndome…" : "Unirme a la empresa"}
              </Button>
            </form>
            <button
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mx-auto"
              onClick={() => { setMode("choose"); setError(""); setJoinCode(""); }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver
            </button>
          </CardContent>
        </Card>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-2">
          <div className="text-5xl">🏢</div>
          <h1 className="text-2xl font-bold">MiNegocio</h1>
          <p className="text-muted-foreground text-sm">
            Para continuar, crea tu empresa o únete a una existente.
          </p>
        </div>
        <Card
          className="cursor-pointer hover:border-emerald-300 transition-colors active:bg-emerald-50"
          onClick={() => setMode("create")}
        >
          <CardContent className="pt-5 pb-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold">Crear mi empresa</p>
              <p className="text-sm text-muted-foreground">Soy dueño o administrador</p>
            </div>
            <span className="ml-auto text-emerald-400 text-xl">›</span>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-teal-300 transition-colors active:bg-teal-50"
          onClick={() => setMode("join")}
        >
          <CardContent className="pt-5 pb-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <p className="font-semibold">Unirme a una empresa</p>
              <p className="text-sm text-muted-foreground">Tengo un código de empresa</p>
            </div>
            <span className="ml-auto text-teal-400 text-xl">›</span>
          </CardContent>
        </Card>
      </div>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
      {children}
    </div>
  );
}
