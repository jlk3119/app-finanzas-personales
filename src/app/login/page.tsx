"use client";

import { createClient } from "@/utils/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/` } })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
    } else if (isSignUp) {
      setMessage("Revisa tu correo para confirmar tu cuenta.");
    } else {
      location.href = "/";
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-100 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">💸</div>
          <CardTitle className="text-2xl">MisFinanzas</CardTitle>
          <CardDescription>
            {isSignUp ? "Crea tu cuenta" : "Inicia sesión en tu cuenta"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAuth} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {message && (
              <p className="text-sm text-center text-muted-foreground">{message}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Cargando..." : isSignUp ? "Crear cuenta" : "Entrar"}
            </Button>
          </form>

          <Button
            variant="ghost"
            className="w-full text-sm"
            onClick={() => { setIsSignUp(!isSignUp); setMessage(""); }}
          >
            {isSignUp ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
