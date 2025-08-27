"use client";

import { Suspense } from "react";
// Si tu UI vive en otro archivo, impórtala y úsala dentro del Suspense.
// import PaywallView from "./PaywallView";

export const dynamic = "force-dynamic";   // evita prerender/SSG
export const revalidate = 0;              // sin cache

function EvaluarPaywallInner() {
  // 👇 aquí va tu contenido que usa useSearchParams / PaywallGuard, etc.
  // Ejemplo mínimo (reemplaza por tu UI real):
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Evaluar (Paywall)</h1>
      {/* Tu componente real que usa useSearchParams */}
      {/* <PaywallView /> */}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Cargando…</div>}>
      <EvaluarPaywallInner />
    </Suspense>
  );
}
