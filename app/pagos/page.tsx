'use client';

import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Sparkles } from 'lucide-react';

type Pack = {
  id: string;
  nombre: string;
  precioCLP: number;   // 0 si es gratis
  creditos: number;    // 1 crédito = 1 imagen
  vigenciaDias: number;
  bullets: string[];   // viñetas cortas
  larga: string[];     // características largas exactas (lo que me enviaste)
  destacado?: boolean;
};

const PACKS: Pack[] = [
  // 1) FREE TRIAL
  {
    id: 'free-trial',
    nombre: 'Plan Gratuito – Prueba Inicial',
    precioCLP: 0,
    creditos: 15,
    vigenciaDias: 30,
    bullets: [
      'Hasta 3 evaluaciones o 15 imágenes (máx. 5 por evaluación).',
      'Procesa evaluaciones físicas o digitales.',
      'Detección automática de nombre y curso.',
      'Retroalimentación profesional con IA.',
      'Informes personalizados por estudiante.',
      'Compatible con cualquier asignatura.',
      '⚠️ Sin almacenamiento permanente; al refrescar se pierden los datos.',
      'Ideal para profesores que quieren probar antes de pagar.',
    ],
    larga: [
      'Incluye: Hasta 3 evaluaciones o 15 imágenes (máximo 5 imágenes por evaluación).',
      'Procesa evaluaciones físicas o digitales en cualquier formato de imagen.',
      'Detección automática de nombre y curso del estudiante.',
      'Retroalimentación profesional con IA de alta calidad.',
      'Informes completos y personalizados por estudiante.',
      'Compatible con cualquier asignatura.',
      'Ideal para: Profesores que quieran probar la plataforma antes de decidir un plan pagado.',
      '⚠️ Nota: No incluye almacenamiento permanente de resultados. Al refrescar la página se perderán los datos.'
    ],
  },

  // 2) DOCENTE ACTIVO (600 créditos, ~3 cursos)
  {
    id: 'docente-activo',
    nombre: 'Pack 📦 Docente Activo',
    precioCLP: 24990,
    creditos: 600,
    vigenciaDias: 30,
    bullets: [
      '600 créditos mensuales (1 crédito = 1 imagen).',
      '≈ 120 evaluaciones (3 cursos de 40; 5 imágenes/evaluación).',
      'Más evaluaciones si tus pruebas son más cortas.',
      'IA Premium (Mistral Large), informes y detección de nombres.',
    ],
    larga: [
      '📦 La herramienta perfecta para el profesor con una carga de trabajo estándar. Evalúa hasta 3 cursos completos, automatiza la retroalimentación y recupera tu tiempo para lo que más importa: enseñar.',
      '✅ Incluye 600 créditos mensuales (1 crédito = 1 imagen).',
      '✅ Cubre hasta 120 evaluaciones: Ideal para 3 cursos de 40 estudiantes, asumiendo 5 créditos (imágenes) por evaluación.',
      '✅ ¡Más evaluaciones si tus pruebas son más cortas! Si una prueba tiene 3 páginas, solo usas 3 créditos, permitiéndote evaluar a más alumnos con tu plan.',
      '✅ Retroalimentación con IA Premium (Mistral Large): Obtén análisis, puntajes y comentarios de la más alta calidad y precisión del mercado.',
      '✅ Detección automática del nombre del estudiante para agilizar el proceso.',
      '✅ Informes completos y personalizados para cada estudiante.',
      '✅ Exportación de informes a PDF y Word.',
      '⚠️ Nota Importante: Libel-IA está en su primera versión. Para no perder tu trabajo, te recomendamos completar y exportar tus evaluaciones en una sola sesión, ya que la información se reinicia si refrescas o cierras el enlace.'
    ],
  },

  // 3) DOCENTE PRO (800 créditos, ~4 cursos)
  {
    id: 'docente-pro',
    nombre: 'Paquete 📦 Docente Pro',
    precioCLP: 34990,
    creditos: 800,
    vigenciaDias: 30,
    destacado: true,
    bullets: [
      '800 créditos mensuales.',
      '≈ 160 evaluaciones (4 cursos de 40; 5 imágenes/evaluación).',
      'Flexibilidad total si las pruebas tienen menos páginas.',
      'IA Premium, detección de nombres, exportaciones.',
    ],
    larga: [
      'Características:',
      '✅ Incluye 800 créditos mensuales (1 crédito = 1 imagen).',
      '✅ Cubre hasta 160 evaluaciones: Perfecto para 4 cursos de 40 estudiantes, asumiendo 5 créditos (imágenes) por evaluación.',
      '✅ Flexibilidad total: Si tus pruebas tienen menos páginas, ¡puedes evaluar a más estudiantes!',
      '✅ Todas las funcionalidades de Libel-IA, incluyendo retroalimentación con IA Premium (Mistral Large), detección de nombres y exportación de informes.',
      '⚠️ Nota Importante: Libel-IA está en su primera versión. Para no perder tu trabajo, te recomendamos completar y exportar tus evaluaciones en una sola sesión, ya que la información se reinicia si refrescas o cierras el enlace.'
    ],
  },

  // 4) COORDINADOR PLUS (1600 créditos, ~8 cursos)
  {
    id: 'coordinador-plus',
    nombre: 'Pack 📦 Coordinador Plus',
    precioCLP: 64990,
    creditos: 1600,
    vigenciaDias: 30,
    bullets: [
      '1.600 créditos mensuales.',
      '≈ 320 evaluaciones (8 cursos de 40; 5 imágenes/evaluación).',
      'Máxima eficiencia por sistema de créditos.',
      'IA Premium + Soporte prioritario.',
    ],
    larga: [
      'La solución definitiva para Jefes de UTP y coordinadores académicos. Gestiona la evaluación de hasta 8 cursos, estandariza la calidad de la retroalimentación y obtén una visión global del progreso.',
      'Características:',
      '✅ Incluye 1.600 créditos mensuales (1 crédito = 1 imagen).',
      '✅ Cubre hasta 320 evaluaciones: Ideal para gestionar la carga de trabajo de 8 cursos de 40 estudiantes.',
      '✅ Máxima eficiencia: El sistema de créditos te permite adaptarte a la longitud de cualquier evaluación, optimizando tu plan al máximo.',
      '✅ Todas las funcionalidades de Libel-IA, con la potencia de la IA Premium.',
      '⭐ Soporte Prioritario: Tus consultas y las de tu equipo son nuestra máxima prioridad.',
      '⚠️ Nota Importante: Libel-IA está en su primera versión. Para no perder tu trabajo, te recomendamos completar y exportar tus evaluaciones en una sola sesión, ya que la información se reinicia si refrescas o cierras el enlace.'
    ],
  },

  // 5) INSTITUCIONAL (3000 créditos, ~15 cursos)
  {
    id: 'institucional',
    nombre: 'Pack 📦 Institucional',
    precioCLP: 119990,
    creditos: 3000,
    vigenciaDias: 30,
    bullets: [
      '3.000 créditos mensuales.',
      '≈ 600 evaluaciones (15 cursos de 40; 5 imágenes/evaluación).',
      'IA Premium + Soporte dedicado y onboarding.',
    ],
    larga: [
      'Transforma la evaluación en tu institución. Otorga a tu equipo las herramientas para evaluar hasta 15 cursos, asegurando consistencia, calidad y un ahorro de tiempo sin precedentes.',
      'Descripción Larga / Características:',
      '✅ Incluye 3.000 créditos mensuales (1 crédito = 1 imagen).',
      '✅ Cubre hasta 600 evaluaciones: La capacidad necesaria para un departamento completo o un ciclo educativo, cubriendo 15 cursos de 40 estudiantes.',
      '✅ Todas las funcionalidades de Libel-IA, con la potencia de la IA Premium.',
      '⭐ Soporte Dedicado y Onboarding: Te ayudamos a implementar la herramienta con tu equipo para asegurar el éxito.',
      '⚠️ Nota Importante: Libel-IA está en su primera versión. Para no perder tu trabajo, te recomendamos completar y exportar tus evaluaciones en una sola sesión, ya que la información se reinicia si refrescas o cierras el enlace.'
    ],
  },
];

export default function PagosPage() {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function comprar(pack: Pack) {
    // Gratis: activar local (rápido para enganchar). Si prefieres activarlo por backend, te preparo endpoint /api/gratis.
    if (pack.precioCLP === 0) {
      const caducaEn = new Date(Date.now() + pack.vigenciaDias * 864e5).toISOString();
      localStorage.setItem(
        'libelia_pack',
        JSON.stringify({
          id: pack.id,
          creditosRestantes: pack.creditos,
          caducaEn,
          origen: 'free',
        })
      );
      alert('🎁 Pack gratuito activado (15 imágenes / 30 días).');
      return;
    }

    try {
      setLoadingId(pack.id);
      const txid = `${pack.id}-${Date.now()}`;
      const body = {
        monto: pack.precioCLP,
        glosa: `${pack.nombre} — ${pack.creditos} imágenes / ${pack.vigenciaDias} días`,
        txid,
      };

      const r = await fetch('/api/khipu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await r.json();
      if (!r.ok || !data?.payment_url) {
        throw new Error(data?.error || 'No se pudo generar el enlace de pago.');
      }

      window.location.href = data.payment_url;
    } catch (e: any) {
      alert(e?.message || 'Error al iniciar el pago.');
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <section className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Planes y Packs de Libel-IA</h1>
        <p className="mt-2 text-muted-foreground">
          1 crédito = 1 imagen. Máx. 5 imágenes por evaluación. Todos los packs expiran en {PACKS[0].vigenciaDias} días.
        </p>
      </section>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PACKS.map((p) => (
          <Card key={p.id} className={p.destacado ? 'border-violet-500 border-2 shadow-md' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{p.nombre}</span>
                {p.destacado && (
                  <span className="inline-flex items-center gap-1 text-violet-600 text-sm font-semibold">
                    <Sparkles className="h-4 w-4" /> Popular
                  </span>
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="text-3xl font-bold">
                {p.precioCLP === 0 ? 'GRATIS' : `$${p.precioCLP.toLocaleString('es-CL')}`}
              </div>
              <div className="text-sm text-muted-foreground">
                {p.creditos} imágenes · vence en {p.vigenciaDias} días
              </div>

              {/* Viñetas cortas */}
              <ul className="space-y-2 text-sm">
                {p.bullets.map((d, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 text-green-600" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>

              {/* Texto largo plegable (si quieres hacerlo expandible más tarde) */}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-violet-600">Ver detalles</summary>
                <div className="mt-2 space-y-2">
                  {p.larga.map((linea, idx) => (
                    <p key={idx}>{linea}</p>
                  ))}
                </div>
              </details>
            </CardContent>

            <CardFooter>
              <Button className="w-full" onClick={() => comprar(p)} disabled={loadingId === p.id}>
                {p.precioCLP === 0
                  ? 'Activar gratis'
                  : loadingId === p.id
                  ? 'Generando enlace...'
                  : 'Comprar'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Al comprar aceptas que los créditos duran {PACKS[0].vigenciaDias} días y que 1 crédito equivale a 1 imagen procesada.
      </p>
    </main>
  );
}