"use client";

import { useEffect, useState } from "react";
import PaywallGuard from "@/components/PaywallGuard";

// TODO: si tienes auth real (Supabase Auth), reemplaza esta constante por session.user.email
const USER_EMAIL = "profesor@colegio.cl";

export default function EvaluarPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saldo, setSaldo] = useState<number | null>(null);

  const fetchSaldo = async () => {
    try {
      const r = await fetch("/api/credits/saldo?userEmail=" + encodeURIComponent(USER_EMAIL));
      const data = await r.json();
      setSaldo(Number(data?.saldo ?? 0));
    } catch {
      setSaldo(null);
    }
  };

  useEffect(() => {
    fetchSaldo();
  }, []);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
    setResultado(null);
    setErrorMsg(null);
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || "");
      reader.onerror = reject;
      reader.readAsDataURL(file); // genera data:<mime>;base64,...
    });

  const evaluar = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setResultado(null);

      if (!files.length) {
        setErrorMsg("Selecciona al menos un archivo (JPG, PNG, PDF, TIFF o BMP).");
        return;
      }

      // convierte todos los archivos a dataURL base64 (lo que espera tu /api/evaluate)
      const fileUrls = await Promise.all(files.map(fileToBase64));

      const resp = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrls,
          rubrica: "Criterios de evaluación",
          pauta: "Pauta por defecto",
          areaConocimiento: "general",
          userEmail: USER_EMAIL, // 👈 importante para descontar 1 crédito
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data?.error || "No se pudo evaluar.");
        return;
      }

      setResultado(data);
      await fetchSaldo(); // refresca saldo en pantalla después de evaluar
    } catch (e: any) {
      setErrorMsg(e?.message || "Error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Evaluar</h1>
        <div className="text-sm opacity-80">
          {saldo === null ? "Cargando saldo…" : `Saldo: ${saldo} crédito(s)`}
        </div>
      </div>

      {/* Paywall: si no hay créditos, muestra cartel y botón a /pagos */}
      <PaywallGuard userEmail={USER_EMAIL} redirect={false}>
        <div className="space-y-4 border rounded-xl p-4">
          <div className="space-y-2">
            <label className="block font-medium">
              Subir archivo(s) (JPG, PNG, PDF, TIFF, BMP)
            </label>
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.pdf,.tif,.tiff,.bmp,image/*,application/pdf"
              onChange={onPickFiles}
              className="block w-full"
            />
            {files.length > 0 && (
              <div className="text-sm opacity-70">
                {files.length} archivo(s) listo(s) para evaluar.
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={evaluar}
              disabled={loading || files.length === 0}
              className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
            >
              {loading ? "Evaluando…" : "Evaluar ahora"}
            </button>

            <button
              onClick={fetchSaldo}
              className="px-3 py-2 text-sm rounded-lg border"
            >
              Refrescar saldo
            </button>

            <a
              href="/pagos"
              className="px-3 py-2 text-sm rounded-lg border"
            >
              Comprar créditos
            </a>
          </div>

          {errorMsg && (
            <div className="p-3 rounded bg-red-50 text-red-700 text-sm">
              {errorMsg}
            </div>
          )}

          {resultado && (
            <div className="p-3 rounded bg-green-50 text-green-800 text-sm overflow-auto">
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(resultado, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </PaywallGuard>
    </main>
  );
}
