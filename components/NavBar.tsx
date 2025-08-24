"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function NavBar() {
  const [email, setEmail] = useState<string | null>(null);
  const [saldo, setSaldo] = useState<number | null>(null);

  const loadEmail = () => {
    const e = localStorage.getItem("userEmail");
    setEmail(e);
  };

  const fetchSaldo = async (e: string) => {
    try {
      const r = await fetch("/api/credits/saldo?userEmail=" + encodeURIComponent(e), { cache: "no-store" });
      const data = await r.json();
      setSaldo(Number(data?.saldo ?? 0));
    } catch {
      setSaldo(null);
    }
  };

  useEffect(() => {
    loadEmail();
    const onVisible = () => document.visibilityState === "visible" && loadEmail();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (email && /\S+@\S+\.\S+/.test(email)) {
      fetchSaldo(email);
      const id = setInterval(() => fetchSaldo(email), 30000);
      return () => clearInterval(id);
    } else {
      setSaldo(null);
    }
  }, [email]);

  const clearEmail = () => {
    localStorage.removeItem("userEmail");
    setEmail(null);
    setSaldo(null);
  };

  return (
    <nav className="bg-black text-white px-6 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <Link href="/" className="font-semibold hover:opacity-80">LibelIA</Link>
          <Link href="/planes" className="hover:underline">Planes</Link>
          <Link href="/evaluar" className="hover:underline">Evaluar</Link>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {email ? (
            <>
              <span className="opacity-80">
                {saldo === null ? "Saldo: …" : `Saldo: ${saldo}`}
              </span>
              <button onClick={clearEmail} className="px-3 py-1.5 rounded border border-white/30 hover:bg-white/10">
                Cambiar correo
              </button>
            </>
          ) : (
            <Link href="/planes" className="underline">Definir correo</Link>
          )}
          <Link href="/pagos" className="px-3 py-1.5 rounded bg-white text-black hover:opacity-90">
            Comprar créditos
          </Link>
        </div>
      </div>
    </nav>
  );
}