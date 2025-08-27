"use client";

import { useEffect, useMemo, useState } from "react";

type Plan = {
  id: string;
  nombre: string;
  precioCLP: number;
  creditos: number;
  vigenciaDias: number;
  equivEvaluaciones?: number;
};

const isEmailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function PlanesPage() {
  // ===== estado =====
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [saldo, setSaldo] = useState<number | null>(null);
  const [loadingFree, setLoadingFree] = useState(false);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [loadingBuy, setLoadingBuy] = useState<string | null>(null); // planId en compra
  const [msg, setMsg] = useState<{ type: "ok" | "error" | "info"; text: string } | null>(null);

  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loadingPlanes, setLoadingPlanes] = useState(true);

  // lee correo guardado
  useEffect(() => {
    try {
      const stored = localStorage.getItem("userEmail");
      if (stored) setSavedEmail(stored);
    } catch {}
  }, []);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const emailOk = useMemo(() => isEmailValid(normalizedEmail), [normalizedEmail]);

  // guarda cuando sea válido
  useEffect(() => {
    if (emailOk) {
      try { localStorage.setItem("userEmail", normalizedEmail); } catch {}
    }
  }, [emailOk, normalizedEmail]);

  // trae planes desde backend (sin caché)
  useEffect(() => {
    const run = async () => {
      try {
        setLoadingPlanes(true);
        const r = await fetch("/api/planes", { cache: "no-store" });
        const data = await r.json();
        setPlanes(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("No se pudieron cargar los planes", e);
        setPlanes([]);
      } finally {
        setLoadingPlanes(false);
      }
    };
    run();
  }, []);

  // trae saldo del correo EN USO
  const fetchSaldo = async () => {
    if (!emailOk) { setSaldo(null); return; }
    try {
      setLoadingSaldo(true);
      const r = await fetch("/api/credits/saldo?userEmail=" + encodeURIComponent(normalizedEmail), { cache: "no-store" });
      const data = await r.json();
      setSaldo(Number(data?.saldo ?? 0));
    } catch {
      setSaldo(null);
    } finally {
      setLoadingSaldo(false);
    }
  };
  useEffect(() => { fetchSaldo(); /* eslint-disable-next-line */ }, [emailOk, normalizedEmail]);

  const useSavedEmail = () => {
    if (savedEmail) {
      setEmail(savedEmail);
      setMsg(null);
    }
  };
  const clearSavedEmail = () => {
    try { localStorage.removeItem("userEmail"); } catch {}
    setSavedEmail(null);
    setEmail((prev) => (prev === savedEmail ? "" : prev));
    setSaldo(null);
    setMsg({ type: "info", text: "Correo borrado. Ingresa uno nuevo." });
  };

  // ===== acciones =====
  // FREE: activar créditos gratis (10)
  const activarGratis = async () => {
    if (!isEmailValid(normalizedEmail)) {
      setMsg({ type: "error", text: "Escribe un correo válido." });
      return;
    }
    try {
      setLoadingFree(true);
      setMsg(null);
      const r = await fetch("/api/credits/gratis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: normalizedEmail }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        setMsg({ type: "error", text: data?.error || "No se pudo activar el plan gratuito." });
        return;
      }
      setMsg({
        type: "ok",
        text:
          data.creditsGranted > 0
            ? `¡Listo! Se activaron ${data.creditsGranted} créditos en ${normalizedEmail}.`
            : `Este correo ya había activado el plan gratuito.`,
      });
      setTimeout(() => { window.location.href = "/evaluar"; }, 600);
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Error inesperado." });
    } finally {
      setLoadingFree(false);
      fetchSaldo();
    }
  };

  // COMPRA: llamado directo al backend → Khipu URL
  const comprarPlan = async (packId: string) => {
    if (!isEmailValid(normalizedEmail)) {
      setMsg({ type: "error", text: "Escribe un correo válido para comprar." });
      return;
    }
    const plan = planes.find(p => p.id === packId);
    if (!plan) {
      setMsg({ type: "error", text: "Plan no encontrado." });
      return;
    }
    try {
      setLoadingBuy(packId);
      setMsg(null);

      try { localStorage.setItem("userEmail", normalizedEmail); } catch {}

      const resp = await fetch("/api/pagos/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: normalizedEmail,
          planId: plan.id,
          precioCLP: plan.precioCLP,  // usa el precio REAL del backend
        }),
      });

      let data: any = null;
      let raw = "";
      try { data = await resp.clone().json(); } catch { try { raw = await resp.text(); } catch {} }

      if (!resp.ok) {
        console.error("Pago falló:", data || raw || { status: resp.status });
        const msg =
          (data && (data.error || data.message)) ||
          raw ||
          `No se pudo iniciar el pago (HTTP ${resp.status}).`;
        setMsg({ type: "error", text: msg });
        return;
      }

      const url = (data && (data.url || data.payment_url || data.transfer_url)) || null;
      if (!url) {
        console.error("Respuesta Khipu sin URL:", data || raw);
        setMsg({ type: "error", text: "Khipu no devolvió URL de pago." });
        return;
      }

      window.location.href = url; // redirige a Khipu
    } catch (e: any) {
      console.error("Excepción al iniciar pago:", e);
      setMsg({ type: "error", text: e?.message || "Error inesperado al iniciar el pago." });
    } finally {
      setLoadingBuy(null);
    }
  };

  // ===== UI =====
  return (
    <main className="max-w-5xl mx-auto px-5 py-10 space-y-8">
      {/* Banner si detectamos correo guardado */}
      {savedEmail && !email && (
        <div className="rounded-xl border px-5 py-4 bg-gray-50 flex items-center justify-between gap-3">
          <div className="text-sm">
            Se encontró un correo guardado: <b>{savedEmail}</b>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={useSavedEmail} className="px-3 py-1.5 rounded bg-black text-white text-sm">
              Usar este correo
            </button>
            <button type="button" onClick={clearSavedEmail} className="px-3 py-1.5 rounded border text-sm">
              Cambiar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold">Elige tu plan</h1>
        <p className="text-base md:text-lg opacity-80">
          Activa <b>10</b> créditos gratis (≈ 2 evaluaciones). Cuando los necesites, compra más.
        </p>
      </header>

      {/* Email + saldo (solo del correo EN USO) */}
      <section className="max-w-xl mx-auto w-full space-y-3">
        <label className="block text-sm font-medium">Tu correo</label>
        <input
          type="email"
          placeholder="ej: profesor@colegio.cl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/30"
          autoComplete="email"
        />

        <div className="flex items-center justify-between text-sm">
          <span className="opacity-80">
            {emailOk ? (
              loadingSaldo ? (
                "Consultando saldo…"
              ) : saldo === null ? (
                "Saldo: —"
              ) : (
                <>Saldo: <b>{saldo}</b> crédito(s)</>
              )
            ) : (
              "Escribe un correo válido para ver tu saldo"
            )}
          </span>

          {emailOk && (saldo ?? 0) > 0 && (
            <a
              href="/evaluar"
              className="px-4 py-2 rounded-xl bg-black text-white"
              title="Usar tus créditos ahora"
            >
              Ir a Evaluar
            </a>
          )}
        </div>
      </section>

      {/* Mensajes */}
      {msg && (
        <div
          className={`max-w-xl mx-auto rounded-xl px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "bg-green-50 text-green-700"
              : msg.type === "error"
              ? "bg-red-50 text-red-700"
              : "bg-yellow-50 text-yellow-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Cards de planes: SIEMPRE desde /api/planes */}
      <section className="grid gap-5 md:grid-cols-3">
        {/* Plan gratuito */}
        <PackCard
          title={loadingPlanes ? "Cargando..." : planes.find(p => p.id === "free")?.nombre || "Plan gratuito"}
          price={loadingPlanes ? "—" : `${(planes.find(p => p.id === "free")?.precioCLP ?? 0).toLocaleString("es-CL")} CLP`}
          subtitle={
            loadingPlanes
              ? "—"
              : `${planes.find(p => p.id === "free")?.creditos ?? 0} créditos • ${(planes.find(p => p.id === "free")?.vigenciaDias ?? 0)} días`
          }
          bullets={
            loadingPlanes
              ? ["—", "—", "—"]
              : ["Ideal para probar", "Corrección automática", "Sin tarjeta de crédito"]
          }
          cta={loadingFree ? "Activando…" : "Probar gratis"}
          onClick={activarGratis} // valida adentro
        />

        {/* Plan básico */}
        <PackCard
          title={loadingPlanes ? "Cargando..." : planes.find(p => p.id === "basic")?.nombre || "Plan Básico"}
          price={
            loadingPlanes ? "$ —" : `$ ${(planes.find(p => p.id === "basic")?.precioCLP ?? 0).toLocaleString("es-CL")}`
          }
          subtitle={
            loadingPlanes
              ? "—"
              : `${planes.find(p => p.id === "basic")?.creditos ?? 0} imágenes • ${(planes.find(p => p.id === "basic")?.vigenciaDias ?? 0)} días`
          }
          bullets={
            loadingPlanes
              ? ["—", "—", "—"]
              : [
                  "OCR + IA",
                  (planes.find(p => p.id === "basic")?.equivEvaluaciones ?? 0) > 0
                    ? `≈ ${planes.find(p => p.id === "basic")?.equivEvaluaciones} evaluaciones`
                    : "Créditos por imágenes",
                  "Soporte por email",
                ]
          }
          cta={loadingBuy === "basic" ? "Redirigiendo…" : "Comprar"}
          onClick={() => comprarPlan("basic")}
        />

        {/* Plan pro */}
        <PackCard
          title={loadingPlanes ? "Cargando..." : planes.find(p => p.id === "pro")?.nombre || "Plan Colegio"}
          price={
            loadingPlanes ? "$ —" : `$ ${(planes.find(p => p.id === "pro")?.precioCLP ?? 0).toLocaleString("es-CL")}`
          }
          subtitle={
            loadingPlanes
              ? "—"
              : `${planes.find(p => p.id === "pro")?.creditos ?? 0} imágenes • ${(planes.find(p => p.id === "pro")?.vigenciaDias ?? 0)} días`
          }
          bullets={
            loadingPlanes
              ? ["—", "—", "—"]
              : [
                  "Para 8–12 cursos",
                  (planes.find(p => p.id === "pro")?.equivEvaluaciones ?? 0) > 0
                    ? `≈ ${planes.find(p => p.id === "pro")?.equivEvaluaciones} evaluaciones`
                    : "Mejor precio por imagen",
                  "Soporte prioritario",
                ]
          }
          cta={loadingBuy === "pro" ? "Redirigiendo…" : "Comprar"}
          onClick={() => comprarPlan("pro")}
        />
      </section>

      {/* Ayuda */}
      <section className="rounded-xl border px-5 py-4 text-sm bg-gray-50">
        <p className="font-medium mb-1">¿Cómo funciona?</p>
        <ul className="list-disc pl-5 space-y-1 opacity-80">
          <li>Si hay un correo guardado, puedes “Usar este correo” o “Cambiar”.</li>
          <li>Activa el plan gratuito (10 créditos) o compra un pack.</li>
          <li>Sube tus pruebas en <a className="underline" href="/evaluar">Evaluar</a>.</li>
        </ul>
      </section>
    </main>
  );
}

function PackCard({
  title,
  price,
  subtitle,
  bullets,
  cta,
  onClick,
}: {
  title: string;
  price: string;
  subtitle: string;
  bullets: string[];
  cta: string;
  onClick: () => void;
}) {
  // Tarjeta clickeable + botón explícito
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className="rounded-2xl border p-6 flex flex-col gap-4 cursor-pointer select-none focus:outline-none border-gray-200"
      style={{ pointerEvents: "auto" }}
    >
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="text-3xl font-bold">{price}</div>
        <div className="text-sm opacity-70">{subtitle}</div>
      </div>

      <ul className="space-y-2 text-sm">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-black/70" />
            <span className="opacity-90">{b}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="mt-2 px-4 py-3 rounded-xl text-sm font-medium border hover:bg-black/5"
        style={{ pointerEvents: "auto" }}
      >
        {cta}
      </button>
    </div>
  );
}