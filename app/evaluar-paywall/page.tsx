"use client";

import { Suspense } from "react";

// ⚠️ IMPORTANTE: no importes `revalidate` desde "next/cache" aquí.
// Este archivo es CLIENTE, así que define las flags como constantes:
export const dynamic = "force-dynamic"; // evita SSG/SSR para esta página
export const revalidate = 0 as const;   // no cachear

// ⬇️ Pon aquí tu UI real que usa useSearchParams / PaywallGuard / Evaluator
function EvaluarPaywallInner() {
  // Ejemplo mínimo; reemplaza por tu contenido real:
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Evaluar (Paywall)</h1>
      <p className="opacity-80 text-sm">Página lista para hooks de router (useSearchParams) sin prerender.</p>
    </div>
  );
}

export default function Page() {
  // ✅ useSearchParams SOLO dentro de un <Suspense>
  return (
    <Suspense fallback={<div className="p-6">Cargando…</div>}>
      <EvaluarPaywallInner />
    </Suspense>
  );
}
