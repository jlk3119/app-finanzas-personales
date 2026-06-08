import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";
import { friendlyAIError } from "@/utils/ai-error";

export const runtime = "nodejs";

const schema = z.object({
  amount: z.number().describe("Monto del gasto en pesos colombianos, solo el número, sin símbolos"),
  description: z.string().describe("Descripción breve de en qué se gastó"),
  categoryName: z
    .string()
    .nullable()
    .describe("Nombre exacto de una de las categorías disponibles, o null si ninguna aplica"),
  date: z.string().describe("Fecha del gasto en formato YYYY-MM-DD"),
});

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const data = (body ?? {}) as Record<string, unknown>;
  const text = typeof data.text === "string" ? data.text.trim() : "";
  const categoryNames = Array.isArray(data.categories)
    ? data.categories.filter((c): c is string => typeof c === "string")
    : [];
  const today =
    typeof data.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.today)
      ? data.today
      : new Date().toISOString().slice(0, 10);

  if (!text) return NextResponse.json({ error: "Escribe el gasto" }, { status: 400 });
  if (text.length > 300) return NextResponse.json({ error: "El texto es demasiado largo" }, { status: 400 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "La interpretación con IA no está disponible" }, { status: 503 });

  const groq = createGroq({ apiKey });

  try {
    const { object } = await generateObject({
      model: groq("openai/gpt-oss-20b"),
      schema,
      prompt: `Extrae los datos de un gasto personal a partir de un texto en español colombiano.
Hoy es ${today}.
Categorías disponibles: ${categoryNames.length ? categoryNames.join(", ") : "(ninguna)"}.

Reglas:
- amount: interpreta montos coloquiales — "20 mil"=20000, "20k"=20000, "1.500"=1500, "2 lucas"=2000, "medio millón"=500000. Devuelve solo el número.
- description: resume en pocas palabras qué se compró o pagó.
- categoryName: elige el nombre que mejor encaje de la lista de categorías disponibles, copiándolo tal cual. Si ninguna encaja, usa null.
- date: resuelve expresiones relativas ("hoy", "ayer", "antier", "el lunes") respecto a ${today}. Si no se menciona fecha, usa ${today}. Devuelve formato YYYY-MM-DD.

Texto del usuario: "${text}"`,
    });

    return NextResponse.json(object);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    console.error("parse-expense error:", raw);
    const { message, status } = friendlyAIError(raw);
    return NextResponse.json({ error: message }, { status });
  }
}
