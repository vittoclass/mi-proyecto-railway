// app/presentacion/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Presentación | Libel IA",
  description: "Qué es Libel IA y cómo usarla paso a paso",
};

export default function PresentacionPage() {
  return (
    <main className="min-h-[100dvh] bg-white">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-14 pb-10">
        <div className="flex flex-col items-center text-center gap-6">
          {/* LOGO: reemplaza /logo.png por tu ruta real */}
          <div className="relative w-[140px] h-[140px]">
            <Image
              src="/logo.png"
              alt="Logo Libel IA"
              fill
              sizes="140px"
              className="object-contain drop-shadow-sm"
              priority
            />
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Libel IA — Evaluación inteligente de pruebas en imágenes
          </h1>
          <p className="text-base md:text-lg text-gray-600 max-w-3xl">
            Sube fotos de evaluaciones, deja que la IA (Mistral + Azure Vision) extraiga y
            analice las respuestas, y obtén resultados consistentes y rápidos. 1 crédito = 1 imagen.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            <Link
              href="/planes"
              className="inline-flex items-center rounded-xl bg-black text-white px-5 py-3 text-sm font-semibold hover:opacity-90"
            >
              Empezar ahora (activar 10 gratis)
            </Link>
            <Link
              href="/evaluar"
              className="inline-flex items-center rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-black/5"
            >
              Ir a Evaluar
            </Link>
            <Link
              href="/"
              className="inline-flex items-center rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-black/5"
            >
              Inicio
            </Link>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="border-t bg-gray-50/60">
        <div className="max-w-6xl mx-auto px-6 py-10 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "1) Crea tu cuenta rápida",
              desc:
                "Ingresa tu correo y activa 10 créditos gratis para probar el flujo real.",
            },
            {
              title: "2) Sube tus imágenes",
              desc:
                "Cárgalas en /evaluar. Recomendamos 4–5 imágenes por estudiante para mayor precisión.",
            },
            {
              title: "3) Revisa resultados",
              desc:
                "La IA extrae información, evalúa y te muestra un resumen confiable por curso.",
            },
          ].map((c, i) => (
            <div
              key={i}
              className="rounded-2xl border bg-white p-6 hover:shadow-sm transition"
            >
              <div className="text-sm font-semibold text-gray-900">{c.title}</div>
              <p className="text-sm text-gray-600 mt-2">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planes destacados */}
      <section className="max-w-6xl mx-auto px-6 py-10">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-6">
          Planes pensados para colegios
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              name: "Gratuito",
              price: "0 CLP",
              bullets: [
                "10 créditos para probar",
                "Sin tarjeta",
                "Actívalo en 20 segundos",
              ],
              href: "/planes",
              accent: false,
            },
            {
              name: "Intermedio",
              price: "$ 29.990",
              bullets: [
                "Créditos para varios cursos",
                "Optimizado para 4–5 imágenes/est.",
                "Pago por Flow",
              ],
              href: "/planes",
              accent: true,
            },
            {
              name: "Pro",
              price: "$ 49.990",
              bullets: [
                "Mayor cobertura institucional",
                "Mejores descuentos por volumen",
                "Pago por Flow",
              ],
              href: "/planes",
              accent: false,
            },
          ].map((p, i) => (
            <div
              key={i}
              className={`rounded-2xl border p-6 flex flex-col justify-between ${
                p.accent ? "border-black/30 shadow-sm" : ""
              }`}
            >
              <div>
                <div className="text-lg font-semibold">{p.name}</div>
                <div className="text-3xl font-extrabold mt-1">{p.price}</div>
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  {p.bullets.map((b, bi) => (
                    <li key={bi} className="flex gap-2">
                      <span className="mt-1 inline-block w-1.5 h-1.5 bg-black/70 rounded-full" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href={p.href}
                className={`mt-5 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium ${
                  p.accent ? "bg-black text-white" : "border hover:bg-black/5"
                }`}
              >
                Elegir plan
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Trust / Footer mini */}
      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Libel IA — Evaluación asistida por IA.{" "}
          <Link href="/planes" className="underline">
            Ver planes
          </Link>{" "}
          ·{" "}
          <a
            className="underline"
            href="mailto:soporte@tu-dominio.cl"
            target="_blank"
            rel="noreferrer"
          >
            Soporte
          </a>
        </div>
      </footer>
    </main>
  );
}
