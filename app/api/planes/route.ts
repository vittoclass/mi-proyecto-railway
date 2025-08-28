import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 1 crédito = 1 imagen evaluada
// Estructura uniforme: equivEvaluaciones SIEMPRE es un objeto {cursos3imgs,cursos4imgs,cursos5imgs}
const PLANS = [
  {
    id: "free",
    nombre: "Plan Gratuito",
    precioCLP: 0,
    creditos: 10,
    vigenciaDias: 30,
    equivEvaluaciones: {
      cursos3imgs: "Prueba: ~0,08 cursos (3 imágenes/est.)",
      cursos4imgs: "Prueba: ~0,06 cursos (4 imágenes/est.)",
      cursos5imgs: "Prueba: ~0,05 cursos (5 imágenes/est.)"
    },
    bullets: [
      "Calidad superior (Mistral Large + Azure Vision)",
      "1 crédito = 1 imagen evaluada",
      "Ideal para probar (sin tarjeta)",
      "⚠️ Si refrescas o cierras el link, no podrás recuperar la información"
    ],
    descripcion:
      "Plan de prueba para validar el flujo de evaluación con IA. Sube pocas imágenes y revisa resultados.",
    policy:
      "Al activar confirmas que aceptas las Condiciones de Uso. Importante: si se refresca o cierras el link, no se podrá recuperar la información."
  },
  {
    id: "basic", // Khipu
    nombre: "Plan Básico",
    precioCLP: 5000,
    creditos: 90,
    vigenciaDias: 30,
    equivEvaluaciones: {
      cursos3imgs: "≈ 0,75 cursos (3 imágenes/est.)",
      cursos4imgs: "≈ 0,56 cursos (4 imágenes/est.)",
      cursos5imgs: "≈ 0,45 cursos (5 imágenes/est.)"
    },
    bullets: [
      "Calidad superior (Mistral Large + Azure Vision)",
      "1 crédito = 1 imagen evaluada",
      "Ideal 5 imágenes por estudiante para mayor precisión",
      "⚠️ Si refrescas o cierras el link, no podrás recuperar la información"
    ],
    descripcion:
      "Plan de entrada para pruebas pequeñas. Para cursos completos, prefiere Intermedio o Pro.",
    policy:
      "Al comprar confirmas que aceptas las Condiciones de Uso. Créditos no transferibles. Sin almacenamiento permanente tras cerrar o refrescar."
  },
  {
    id: "intermediate", // Flow
    nombre: "Plan Intermedio",
    precioCLP: 29900,
    creditos: 640,
    vigenciaDias: 60,
    equivEvaluaciones: {
      cursos3imgs: "≈ 5 cursos (3 imágenes/est.)",
      cursos4imgs: "≈ 4 cursos (4 imágenes/est.)",
      cursos5imgs: "≈ 3,2 cursos (5 imágenes/est.)"
    },
    bullets: [
      "Calidad superior (Mistral Large + Azure Vision)",
      "1 crédito = 1 imagen evaluada",
      "Ideal 5 imágenes por estudiante para mayor precisión",
      "Cobertura garantizada: al menos 4 cursos usando 4 imágenes/est.",
      "⚠️ Si refrescas o cierras el link, no podrás recuperar la información"
    ],
    descripcion:
      "Equilibrio perfecto entre costo y cobertura. Cubre múltiples cursos con holgura incluso a 5 imágenes por estudiante.",
    policy:
      "Al comprar confirmas que aceptas las Condiciones de Uso. Créditos no transferibles. Sin reembolsos parciales. No se garantiza persistencia de datos al cerrar o refrescar el link."
  },
  {
    id: "pro", // Flow
    nombre: "Plan Pro",
    precioCLP: 49900,
    creditos: 1280,
    vigenciaDias: 90,
    equivEvaluaciones: {
      cursos3imgs: "≈ 10 cursos (3 imágenes/est.)",
      cursos4imgs: "≈ 8 cursos (4 imágenes/est.)",
      cursos5imgs: "≈ 6 cursos (5 imágenes/est.)"
    },
    bullets: [
      "Calidad superior (Mistral Large + Azure Vision)",
      "1 crédito = 1 imagen evaluada",
      "Ideal 5 imágenes por estudiante para mayor precisión",
      "Cobertura amplia para varios cursos y paralelos",
      "⚠️ Si refrescas o cierras el link, no podrás recuperar la información"
    ],
    descripcion:
      "Pensado para colegios e instituciones. Rinde muy bien incluso con evaluaciones de 5 páginas.",
    policy:
      "Al comprar confirmas que aceptas las Condiciones de Uso. Créditos no transferibles. Sin reembolsos parciales. No se garantiza persistencia de datos al cerrar o refrescar el link."
  }
];

export async function GET() {
  // sin caché para evitar datos pegados
  return NextResponse.json(PLANS, { headers: { "Cache-Control": "no-store" } });
}
