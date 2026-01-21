"use client";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email"|"code">("email");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true); setMsg(null);
    const r = await fetch("/api/auth/start", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const j = await r.json();
    setLoading(false);
    if (j.ok) { setStep("code"); setMsg("Te enviamos un código a tu correo"); }
    else setMsg(j.error || "Error");
  };

  const verify = async () => {
    setLoading(true); setMsg(null);
    const r = await fetch("/api/auth/verify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const j = await r.json();
    setLoading(false);
    if (j.ok) {
      setMsg("¡Listo! Ingresando...");
      window.location.href = "/evaluar"; // o a la página que quieras
    } else setMsg(j.error || "Error");
  };

  return (
    <main className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Ingresar</h1>

      {step === "email" && (
        <>
          <input className="border p-2 w-full" placeholder="tu@correo.com"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="bg-black text-white px-4 py-2 rounded"
            onClick={start} disabled={loading}>
            {loading ? "Enviando..." : "Enviar código"}
          </button>
        </>
      )}

      {step === "code" && (
        <>
          <input className="border p-2 w-full" placeholder="Código de 6 dígitos"
            value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="bg-black text-white px-4 py-2 rounded"
            onClick={verify} disabled={loading}>
            {loading ? "Verificando..." : "Ingresar"}
          </button>
        </>
      )}

      {msg && <p className="text-sm opacity-80">{msg}</p>}
    </main>
  );
}
