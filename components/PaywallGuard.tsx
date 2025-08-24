"use client";
import { useEffect, useState } from "react";

type Props = {
  userEmail?: string | null;
  children: React.ReactNode;
  redirect?: boolean; // si true, redirige a /pagos
};

export default function PaywallGuard({ userEmail, children, redirect = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [saldo, setSaldo] = useState<number>(0);

  useEffect(() => {
    const run = async () => {
      if (!userEmail) {
        setSaldo(0);
        setLoading(false);
        return;
      }
      try {
        const r = await fetch("/api/credits/saldo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userEmail })
        });
        const data = await r.json();
        setSaldo(Number(data?.saldo || 0));
      } catch {
        setSaldo(0);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [userEmail]);

  if (loading) return <div className="p-6 text-sm opacity-70">Comprobando acceso…</div>;

  if (saldo <= 0) {
    if (redirect) {
      if (typeof window !== "undefined") window.location.href = "/pagos";
      return null;
    }
    return (
      <div className="p-6 border rounded-xl max-w-xl mx-auto text-center space-y-3">
        <h2 className="text-xl font-semibold">Necesitas un pack activo</h2>
        <p className="opacity-80 text-sm">
          No tienes créditos disponibles. Compra un pack para continuar.
        </p>
        <a href="/pagos" className="inline-block px-4 py-2 rounded-lg bg-black text-white">Ir a Pagos</a>
      </div>
    );
  }

  return <>{children}</>;
}
