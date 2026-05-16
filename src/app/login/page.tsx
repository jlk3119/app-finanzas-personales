"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Eye, EyeOff, ArrowLeft, CheckCircle2 } from "lucide-react";

type Mode = "signin" | "signup" | "forgot" | "forgot-sent" | "confirm-sent";

const ERRORS: Record<string, string> = {
  "invalid login credentials":      "Correo o contraseña incorrectos.",
  "email not confirmed":             "Debes confirmar tu correo. Revisa tu bandeja de entrada.",
  "user already registered":         "Ya existe una cuenta con este correo.",
  "password should be at least 6":   "La contraseña debe tener al menos 6 caracteres.",
  "unable to validate email address": "El formato del correo no es válido.",
  "email rate limit exceeded":       "Demasiados intentos. Espera unos minutos.",
  "over_email_send_rate_limit":      "Límite de correos alcanzado. Intenta más tarde.",
  "link_invalido":                   "El enlace es inválido o ya expiró. Solicita uno nuevo.",
};

function translateError(raw: string): string {
  const lower = raw.toLowerCase();
  for (const [key, msg] of Object.entries(ERRORS)) {
    if (lower.includes(key)) return msg;
  }
  return raw;
}

export default function LoginPage() {
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "info" }>({ text: "", type: "info" });

  // Mostrar error si llega desde auth/callback con ?error=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setMessage({ text: translateError(err), type: "error" });
  }, []);

  const reset = (m: Mode) => { setMode(m); setMessage({ text: "", type: "info" }); };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "info" });

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ text: translateError(error.message), type: "error" });
      } else {
        location.href = "/";
        return;
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) {
        setMessage({ text: translateError(error.message), type: "error" });
      } else {
        setMode("confirm-sent");
      }
    }
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/reset-password`,
    });
    // Siempre mostrar éxito (no revelar si el correo existe o no)
    setMode("forgot-sent");
    setLoading(false);
  };

  // ── Pantallas de confirmación ──────────────────────────────────────────

  if (mode === "confirm-sent") {
    return (
      <Screen>
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
        <h2 className="text-lg font-semibold text-center">¡Revisa tu correo!</h2>
        <p className="text-sm text-muted-foreground text-center">
          Te enviamos un enlace de confirmación a <strong>{email}</strong>.
          Haz clic en el enlace para activar tu cuenta y comenzar a usar MisFinanzas.
        </p>
        <p className="text-xs text-muted-foreground text-center">
          ¿No lo ves? Revisa la carpeta de spam.
        </p>
        <Button variant="outline" className="w-full" onClick={() => reset("signin")}>
          Volver al inicio de sesión
        </Button>
      </Screen>
    );
  }

  if (mode === "forgot-sent") {
    return (
      <Screen>
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
        <h2 className="text-lg font-semibold text-center">Correo enviado</h2>
        <p className="text-sm text-muted-foreground text-center">
          Si existe una cuenta con <strong>{email}</strong>, recibirás instrucciones para restablecer tu contraseña.
        </p>
        <Button variant="outline" className="w-full" onClick={() => reset("signin")}>
          Volver al inicio de sesión
        </Button>
      </Screen>
    );
  }

  // ── Formulario de recuperación ─────────────────────────────────────────

  if (mode === "forgot") {
    return (
      <Wrapper>
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="text-4xl mb-2">🔑</div>
            <CardTitle className="text-xl">Recuperar contraseña</CardTitle>
            <CardDescription>Te enviaremos un enlace por correo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleForgot} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" type="email" placeholder="tu@correo.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
              {message.text && <p className="text-sm text-red-500">{message.text}</p>}
              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={loading}>
                {loading ? "Enviando…" : "Enviar instrucciones"}
              </Button>
            </form>
            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mx-auto"
              onClick={() => reset("signin")}>
              <ArrowLeft className="w-3.5 h-3.5" /> Volver
            </button>
          </CardContent>
        </Card>
      </Wrapper>
    );
  }

  // ── Formulario principal (signin / signup) ─────────────────────────────

  return (
    <Wrapper>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">💸</div>
          <CardTitle className="text-2xl">MisFinanzas</CardTitle>
          <CardDescription>
            {mode === "signin" ? "Inicia sesión en tu cuenta" : "Crea tu cuenta gratis"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAuth} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" placeholder="tu@correo.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Contraseña</Label>
                {mode === "signup" && (
                  <span className="text-xs text-muted-foreground">mínimo 6 caracteres</span>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button type="button" tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPwd(!showPwd)}>
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {message.text && (
              <p className={`text-sm ${message.type === "error" ? "text-red-500" : "text-muted-foreground"}`}>
                {message.text}
              </p>
            )}

            <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={loading}>
              {loading ? "Cargando…" : mode === "signin" ? "Entrar" : "Crear cuenta"}
            </Button>
          </form>

          {mode === "signin" && (
            <button className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
              onClick={() => reset("forgot")}>
              ¿Olvidaste tu contraseña?
            </button>
          )}

          <div className="border-t pt-3">
            <Button variant="ghost" className="w-full text-sm"
              onClick={() => reset(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-100 p-4">
      {children}
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <Wrapper>
      <Card className="w-full max-w-sm">
        <CardContent className="pt-8 pb-6 space-y-4">{children}</CardContent>
      </Card>
    </Wrapper>
  );
}
