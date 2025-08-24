"use client";

import { useEffect, useMemo, useState } from "react";

export default function PlanesPage() {
  // ===== estados =====
  const [savedEmail, setSavedEmail] = useState<string | null>(null); // detectado en localStorage
  const [email, setEmail] = useState(""); // correo en uso (solo si usuario lo confirma o lo escribe)
  const [saldo, setSaldo] = useState<number | null>(null);
  const [loadingFree, setLoadingFree] = useState(false);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "error" | "info"; text: string } | null>(null);
  const [forceBuy, setForceBuy] = useState(false);

  // lee correo guardado pero NO lo usa automáticamente
  useEffect(() => {
    const stored = localStorage.getItem("userEmail");
    if (stored) setSavedEmail(stored);
  }, []);

  const emailOk = useMemo(() => /\S+@\S+\.\S+/.test(email), [email]);

  // cuando el usuario define o confirma un correo, lo guardamos
  useEffect(() => {
    if (emailOk) localStorage.setItem("userEmail", email);
  }, [email, emailOk]);

  // traer saldo del correo EN USO (no del guardado)
  const fetchSaldo = async () => {
    if (!emailOk) {
      setSaldo(null);
      return;
    }
    try {
      setLoadingSaldo(true);
      const r = await fetch("/api/credits/saldo?userEmail=" + encodeURIComponent(email), { cache: "no-store" });
      const data = await r.json();
      setSaldo(Number(data?.saldo ?? 0));
    } catch {
      setSaldo(null);
    } finally {
      setLoadingSaldo(false);
    }
  };

  useEffect(() => {
    fetchSaldo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const useSavedEmail = () => {
    if (savedEmail) {
      setEmail(savedEmail);
      setMsg(null);
    }
  };

  const clearSavedEmail = () => {
    localStorage.removeItem("userEmail");
    setSavedEmail(null);
    // si además estaba en uso, lo limpiamos
    setEmail((prev) => (prev === savedEmail ? "" : prev));
    setSaldo(null);
    setMsg({ type: "info", text: "Correo borrado. Ingresa uno nuevo." });
  };

  // ===== acciones =====
  const activarGratis = async () => {
    try {
      if (!emailOk) {
        setMsg({ type: "error", text: "Escribe un correo válido." });
        return;
      }
      if ((saldo ?? 0) > 0) {
        setMsg({ type: "info", text: "Ya tienes créditos. Úsalos antes de activar más." });
        return;
      }
      setLoadingFree(true);
      setMsg(null);

      const r = await fetch("/api/credits/gratis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: email }),
      });
      const data = await r.json();

      if (!r.ok || !data.ok) {
        setMsg({ type: "error", text: data?.error || "No se pudo activar el plan gratuito." });
        return;
      }

      setMsg({
        type: "ok",
        text:
          data.creditsGranted > 0
            ? `¡Listo! Se activaron ${data.creditsGranted} créditos en ${email}.`
            : `Este correo ya había activado el plan gratuito.`,
      });

      setTimeout(() => (window.location.href = "/evaluar"), 1000);
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Error inesperado." });
    } finally {
      setLoadingFree(false);
      fetchSaldo();
    }
  };

  const irAComprar = (packId: string) => {
    if (!emailOk) {
      setMsg({ type: "error", text: "Escribe un correo válido para comprar." });
      return;
    }
    if ((saldo ?? 0) > 0 && !forceBuy) {
      setMsg({
        type: "info",
        text: "Ya tienes créditos disponibles. Úsalos primero o presiona “Comprar igual” para recargar.",
      });
      return;
    }
    const qs = `?pack=${encodeURIComponent(packId)}&email=${encodeURIComponent(email)}`;
    window.location.href = `/pagos${qs}`;
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
            <button onClick={useSavedEmail} className="px-3 py-1.5 rounded bg-black text-white text-sm">
              Usar este correo
            </button>
            <button onClick={clearSavedEmail} className="px-3 py-1.5 rounded border text-sm">
              Cambiar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold">Elige tu plan</h1>
        <p className="text-base md:text-lg opacity-80">
          Comienza con 15 créditos gratis. Cuando los necesites, compra más.
        </p>
      </header>

      {/* Email + saldo (solo del correo EN USO) */}
      <section className="max-w-xl mx-auto w-full space-y-3">
        <label className="block text-sm font-medium">Tu correo</label>
        <input
          type="email"
          placeholder="ej: profesor@colegio.cl"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/30"
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
          {msg.type === "info" && (saldo ?? 0) > 0 && (
            <div className="mt-2 flex items-center gap-3">
              <button onClick={() => setForceBuy(true)} className="px-3 py-1.5 rounded border">
                Comprar igual
              </button>
              <a href="/evaluar" className="px-3 py-1.5 rounded bg-black text-white">
                Ir a Evaluar
              </a>
            </div>
          )}
        </div>
      )}

      {/* Cards de planes */}
      <section className="grid gap-5 md:grid-cols-3">
        <PackCard
          title="Plan gratuito"
          price="0 CLP"
          subtitle="15 créditos • 30 días"
          bullets={["Ideal para probar", "Corrección automática", "Sin tarjeta de crédito"]}
          cta={loadingFree ? "Activando…" : "Probar gratis"}
          onClick={activarGratis}
          disabled={(saldo ?? 0) > 0 || loadingFree || !emailOk}
          note={
            !emailOk
              ? "Ingresa un correo válido"
              : (saldo ?? 0) > 0
              ? "Ya tienes créditos activos"
              : undefined
          }
        />

        <PackCard
          title="Pack 120"
          price="$ —"
          subtitle="120 evaluaciones • 6 meses"
          bullets={["Para 3 cursos de 40", "Soporte por email", "Renovable cuando quieras"]}
          cta="Comprar"
          onClick={() => irAComprar("120")}
          disabled={(!emailOk) || ((saldo ?? 0) > 0 && !forceBuy)}
          note={
            !emailOk
              ? "Ingresa un correo válido"
              : (saldo ?? 0) > 0 && !forceBuy
              ? "Usa tus créditos antes de comprar"
              : undefined
          }
          highlight
        />

        <PackCard
          title="Pack 560"
          price="$ —"
          subtitle="560 evaluaciones • 12 meses"
          bullets={["Para 8–12 cursos", "Soporte prioritario", "Mejor precio por evaluación"]}
          cta="Comprar"
          onClick={() => irAComprar("560")}
          disabled={(!emailOk) || ((saldo ?? 0) > 0 && !forceBuy)}
          note={
            !emailOk
              ? "Ingresa un correo válido"
              : (saldo ?? 0) > 0 && !forceBuy
              ? "Usa tus créditos antes de comprar"
              : undefined
          }
        />
      </section>

      {/* Ayuda */}
      <section className="rounded-xl border px-5 py-4 text-sm bg-gray-50">
        <p className="font-medium mb-1">¿Cómo funciona?</p>
        <ul className="list-disc pl-5 space-y-1 opacity-80">
          <li>Si hay un correo guardado, puedes “Usar este correo” o “Cambiar”.</li>
          <li>Activa el plan gratuito para probar (15 créditos) o compra un pack.</li>
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
  disabled,
  note,
  highlight,
}: {
  title: string;
  price: string;
  subtitle: string;
  bullets: string[];
  cta: string;
  onClick: () => void;
  disabled?: boolean;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 flex flex-col gap-4 ${
        highlight ? "shadow-lg border-black/20" : "border-gray-200"
      } ${disabled ? "opacity-60" : ""}`}
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

      {note && <div className="text-xs opacity-70">{note}</div>}

      <button
        onClick={onClick}
        disabled={disabled}
        className={`mt-2 px-4 py-3 rounded-xl text-sm font-medium ${
          disabled ? "border cursor-not-allowed" : highlight ? "bg-black text-white" : "border hover:bg-black/5"
        }`}
      >
        {cta}
      </button>
    </div>
  );
}