"use client";

import Link from "next/link";

export default function StartBanner() {
  return (
    <section className="max-w-3xl mx-auto p-6 my-10 border rounded-xl text-center space-y-4">
      <h1 className="text-3xl md:text-4xl font-bold">Bienvenido a LibelIA</h1>

      <p className="text-base md:text-lg opacity-80">
        Corrige tus pruebas automáticamente. Primero elige tu plan y activa tu cuenta gratis.
      </p>

      <div className="pt-2 flex justify-center gap-4">
        <Link
          href="/planes"
          className="px-6 py-3 rounded-xl bg-black text-white text-base md:text-lg"
        >
          Comenzar gratis
        </Link>

        <Link
          href="/evaluar"
          className="px-6 py-3 rounded-xl border text-base md:text-lg"
        >
          Ir a evaluar
        </Link>
      </div>

      <p className="text-sm opacity-70">
        ¿Sin créditos? Activa el plan gratuito (15 créditos) o compra un pack en{" "}
        <Link href="/planes" className="underline">
          planes
        </Link>
        .
      </p>
    </section>
  );
}
