"use client";
import { useEffect, useState } from "react";

type Plan = { id: string; nombre: string; precioCLP: number; creditos: number; vigenciaDias: number };

export default function PagosPage() {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [comprando, setComprando] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<{ status?: number; raw?: string; data?: any } | null>(null);

  // Cargar correo guardado
  useEffect(() => {
    try {
      const saved = (localStorage.getItem("userEmail") || "").toLowerCase();
      setEmail(saved);
    } catch {}
  }, []);

  // Cargar planes (acepta /api/planes con {plans:[...]} o un array directo)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/planes");
        const data = await r.json().catch(() => null);
        const arr = Array.isArray(data) ? data : Array.isArray((data as any)?.plans) ? (data as any).plans : [];
        setPlanes(arr as Plan[]);
      } catch (e) {
        console.error("Error cargando planes:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const guardarEmail = () => {
    const ok = /\S+@\S+\.\S+/.test(email);
    if (!ok) { alert("Ingresa un correo válido (ej: profe@colegio.cl)"); return; }
    localStorage.setItem("userEmail", email.toLowerCase());
    alert("Correo guardado ✔");
  };

  // ===== comprar (con panel de depuración) =====
  const comprar = async (plan: Plan) => {
    setError(null);
    setDebug(null);
    if (!/\S+@\S+\.\S+/.test(email)) { alert("Primero guarda tu correo (arriba)."); return; }
    setComprando(plan.id);
    try {
      const precioNum = Number(plan.precioCLP); // asegura número
      const r = await fetch("/api/pagos/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          userEmail: email,
          planId: plan.id,
          precioCLP: precioNum,
        }),
      });

      const raw = await r.text(); // leer crudo SIEMPRE
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; }
      catch { data = { raw }; }

      console.log("STATUS:", r.status);
      console.log("RAW:", raw);
      console.log("DATA:", data);
      setDebug({ status: r.status, raw, data });

      if (!r.ok || !data?.url) {
        setError(data?.error || `No se pudo crear el pago (HTTP ${r.status})`);
        return;
      }

      window.location.href = data.url; // Redirige a Khipu
    } catch (e: any) {
      setError(e?.message || String(e));
      setDebug({ data: { exception: String(e) } });
    } finally {
      setComprando(null);
    }
  };

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Planes</h1>

      {/* Email del usuario */}
      <div className="border rounded-lg p-4 flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium">Tu correo</label>
        <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="profe@colegio.cl"
            className="mt-1 w-full border rounded px-3 py-2"
          />
          <p className="text-xs opacity-70 mt-1">
            Usamos tu correo para asociar el pago y acreditar los créditos. (Siempre puedes ir a <a className="underline" href="/pagos">/pagos</a>)
          </p>
        </div>
        <button onClick={guardarEmail} className="px-4 py-2 rounded bg-black text-white">Guardar</button>
      </div>

      {loading && <p>Cargando planes…</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      {/* Panel de depuración visible si hay error */}
      {error && debug && (
        <pre className="text-xs bg-neutral-100 p-3 rounded border overflow-auto max-h-64">
{JSON.stringify(debug, null, 2)}
        </pre>
      )}

      <div className="space-y-4">
        {planes.map((plan) => (
          <div key={plan.id} className="border rounded-lg p-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{plan.nombre}</h2>
              <p className="text-sm opacity-80">{plan.creditos} créditos · {plan.vigenciaDias} días</p>
              <p className="font-bold mt-1">${Number(plan.precioCLP).toLocaleString("es-CL")} CLP</p>
            </div>
            <button
              onClick={() => comprar(plan)}
              disabled={!!comprando}
              className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            >
              {comprando === plan.id ? "Creando pago..." : (Number(plan.precioCLP) ? "Comprar" : "Obtener gratis")}
            </button>
          </div>
        ))}
        {!loading && planes.length === 0 && <p>No hay planes disponibles.</p>}
      </div>
    </main>
  );
}
