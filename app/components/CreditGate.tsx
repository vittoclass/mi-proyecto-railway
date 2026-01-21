"use client";

import { useEffect, useState } from "react";

export default function CreditGate({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string>("");
  const [saldo, setSaldo] = useState<number | null>(null);
  const [checking, setChecking] = useState(true);

  // toma el correo que definiste en /planes (minúsculas)
  useEffect(() => {
    const saved = (localStorage.getItem("userEmail") || "").toLowerCase();
    setEmail(saved);
  }, []);

  useEffect(() => {
    const check = async () => {
      if (!email || !/\S+@\S+\.\S+/.test(email)) {
        setSaldo(0);
        setChecking(false);
        return;
      }
      try {
        const r = await fetch(`/api/credits/saldo?userEmail=${encodeURIComponent(email)}`, { cache: "no-store" });
        const d = await r.json();
        setSaldo(Number(d?.saldo ?? 0));
      } catch {
        setSaldo(null);
      } finally {
        setChecking(false);
      }
    };
    check();
  }, [email]);

  // badge pequeño arriba a la derecha (informativo)
  const SaldoBadge = () => (
    <div className="fixed top-3 right-3 z-[60] text-xs px-3 py-1.5 rounded-full bg-black text-white">
      {checking ? "Saldo: …" : `Saldo: ${saldo ?? 0}`}
    </div>
  );

  return (
    <>
      <SaldoBadge />
      {children}

      {/* overlay solo si NO hay créditos */}
      {!checking && (saldo ?? 0) <= 0 && (
        <div className="fixed inset-0 z-50 bg-white/85 backdrop-blur-sm flex items-center justify-center">
          <div className="max-w-md w-full mx-4 rounded-2xl border bg-white p-6 text-center space-y-3 shadow-lg">
            <h2 className="text-xl font-semibold">Necesitas créditos para continuar</h2>
            <p className="text-sm opacity-80">
              Tu cuenta {email || "—"} no tiene créditos activos. Puedes activar el plan gratuito o comprar un pack.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <a href="/planes" className="px-4 py-2 rounded-xl bg-black text-white">Ver planes</a>
              <button
                onClick={() => location.reload()}
                className="px-4 py-2 rounded-xl border"
                title="Actualizar saldo"
              >
                Actualizar
              </button>
            </div>
            <div className="text-xs opacity-70">
              Consejo: define/confirmar correo en <a className="underline" href="/planes">/planes</a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
