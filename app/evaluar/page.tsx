"use client";

import { useEffect, useState } from "react";
import PaywallGuard from "@/components/PaywallGuard";

const USER_EMAIL = "profesor@colegio.cl"; // pon el correo del usuario (luego lo cambias por el de tu auth)

export default function EvaluarPage() {
  const [saldo, setSaldo] = useState<number | null>(null);

  const fetchSaldo = async () => {
    const r = await fetch("/api/credits/saldo?userEmail=" + encodeURIComponent(USER_EMAIL));
    const data = await r.json();
    setSaldo(Number(data?.saldo ?? 0));
  };

  useEffect(() => {
    fetchSaldo();
  }, []);

  const [files, setFiles] = useState<File[]>([]);
  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(e.target.files || []));
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve((fr.result as string) || "");
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });

  const evaluar = async () => {
    const fileUrls = await Promise.all(files.map(fileToBase64));
    const resp = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileUrls,
        rubrica: "Criterios de evaluación",
        pauta: "Pauta por defecto",
        areaConocimiento: "general",
        userEmail: USER_EMAIL, // necesario para descontar 1 crédito
      }),
    });
    const data = await resp.json();
    alert(JSON.stringify(data, null, 2));
    await fetchSaldo();
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Evaluar</h1>
        <div className="text-sm opacity-80">
          {saldo === null ? "Cargando saldo…" : `Saldo: ${saldo} crédito(s)`}
        </div>
      </div>

      <PaywallGuard userEmail={USER_EMAIL} redirect={false}>
        <div className="space-y-3 border rounded-xl p-4">
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.pdf,.tif,.tiff,.bmp,image/*,application/pdf"
            onChange={onPickFiles}
          />
          <button
            onClick={evaluar}
            disabled={!files.length}
            className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
          >
            Evaluar ahora
          </button>
          <button onClick={fetchSaldo} className="px-3 py-2 text-sm rounded-lg border">
            Refrescar saldo
          </button>
          <a href="/pagos" className="px-3 py-2 text-sm rounded-lg border">
            Comprar créditos
          </a>
        </div>
      </PaywallGuard>
    </main>
  );
}
