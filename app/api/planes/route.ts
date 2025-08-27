import { NextResponse } from "next/server";

// Evita que Next.js cachee este endpoint en build/ISR
export const dynamic = "force-dynamic";

// Fallback local (cámbialo cuando conectes a Supabase)
// Asumimos 5 imágenes por evaluación para calcular "equivEvaluaciones".
const FALLBACK_PLANS = [
  { id: "free",  nombre: "Plan Gratuito",             precioCLP: 0,     creditos: 10,  vigenciaDias: 30, equivEvaluaciones: 2  },  // 10 imágenes ≈ 2 evaluaciones
  { id: "basic", nombre: "Plan Básico (90 imágenes)", precioCLP: 5000,  creditos: 90,  vigenciaDias: 30, equivEvaluaciones: 18 },  // 90 imágenes ≈ 18 evaluaciones
  { id: "pro",   nombre: "Plan Colegio (560)",        precioCLP: 29900, creditos: 560, vigenciaDias: 90, equivEvaluaciones: 112 }, // 560 imágenes ≈ 112 evaluaciones
];

export async function GET() {
  try {
    // TODO: aquí pides a Supabase (cuando Studio esté ok)
    // const { data, error } = await supabase.from("plans").select("*").eq("is_active", true);
    // if (error) throw error;
    // return new NextResponse(JSON.stringify(data), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

    // Por ahora: devolver fallback como array, sin cache
    return NextResponse.json(FALLBACK_PLANS, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    // Ante error: igual devolvemos fallback para que la UI no muera, sin cache
    return NextResponse.json(FALLBACK_PLANS, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
