"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Props = {
  userEmail?: string | null;
  children: React.ReactNode;
  redirect?: boolean;
};

// Componente auxiliar: persiste ?email=... en localStorage y devuelve los children
function SaveEmailFromQuery({ children }: { children: React.ReactNode }) {
  const search = useSearchParams();
  useEffect(() => {
    const qEmail = search.get("email");
    if (qEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(qEmail)) {
      try { localStorage.setItem("userEmail", qEmail); } catch {}
    }
  }, [search]);
  return <>{children}</>;
}

export default function PaywallGuard({ userEmail, children, redirect = false }: Props) {
  // CORRECCIÓN: Todos los hooks se declaran al principio del componente.
  const pathname = usePathname();
  const search = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saldo, setSaldo] = useState<number>(0);
  const [effectiveEmail, setEffectiveEmail] = useState<string | null>(null);

  // Email efectivo: prop -> query -> localStorage
  useEffect(() => {
    const qEmail = search.get("email");
    let chosen = (userEmail ?? "") || "";

    if (!chosen && qEmail) {
      chosen = qEmail;
    }
    if (!chosen) {
      try {
        const ls = localStorage.getItem("userEmail") || "";
        if (ls) chosen = ls;
      } catch {}
    }

    // normalizamos y validamos
    chosen = chosen.trim().toLowerCase();
    if (chosen && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chosen)) {
      setEffectiveEmail(chosen);
      // si vino por query, persiste
      if (qEmail && qEmail.toLowerCase() === chosen) {
        try { localStorage.setItem("userEmail", chosen); } catch {}
      }
    } else {
      setEffectiveEmail(null);
    }
  }, [userEmail, search]);

  // Consulta de saldo (igual que tu versión original, usando POST)
  useEffect(() => {
    const run = async () => {
      if (!effectiveEmail) {
        setSaldo(0);
        setLoading(false);
        return;
      }
      try {
        const r = await fetch("/api/credits/saldo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userEmail: effectiveEmail }),
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
  }, [effectiveEmail]);

  // CORRECCIÓN: La lógica de retorno anticipado ahora se ejecuta DESPUÉS de llamar a todos los hooks.
  // 🔓 Siempre permitir /pagos PERO guardando el email si viene por query
  if (pathname?.startsWith("/pagos")) {
    return <SaveEmailFromQuery>{children}</SaveEmailFromQuery>;
  }

  if (loading) {
    return <div className="p-6 text-sm opacity-70">Comprobando acceso…</div>;
  }

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