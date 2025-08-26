import { NextResponse } from "next/server";

// Fallback local (cámbialo cuando conectes a Supabase)
const FALLBACK_PLANS = [
  { id: "free",  nombre: "Plan Gratuito",         precioCLP: 0,     creditos: 15,  vigenciaDias: 30 },
  { id: "basic", nombre: "Plan Docente (120)",    precioCLP: 9900,  creditos: 120, vigenciaDias: 60 },
  { id: "pro",   nombre: "Plan Colegio (560)",    precioCLP: 29900, creditos: 560, vigenciaDias: 90 },
];

export async function GET() {
  try {
    // TODO: aquí pides a Supabase (cuando Studio esté ok)
    // const { data, error } = await supabase.from("plans").select("*").eq("is_active", true);
    // if (error) throw error;
    // return NextResponse.json(data);

    // Por ahora: devolver fallback como array
    return NextResponse.json(FALLBACK_PLANS);
  } catch {
    // Ante error: igual devolvemos fallback para que la UI no muera
    return NextResponse.json(FALLBACK_PLANS);
  }
}
