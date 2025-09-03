'use client';

import { useState, useCallback } from 'react';

export const useEvaluator = () => {
  const [isLoading, setIsLoading] = useState(false);

  const evaluate = useCallback(async (payload: any): Promise<any> => {
    setIsLoading(true);

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Leer como texto primero para tolerar respuestas no-JSON
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        console.error('Respuesta no JSON desde /api/evaluate:', text);
        return { success: false, error: `Respuesta no JSON (HTTP ${res.status})` };
      }

      // Si servidor reporta error o HTTP no OK, propagar error “limpio”
      if (!res.ok || json?.success === false) {
        const msg = json?.error || res.statusText || `HTTP ${res.status}`;
        console.error('API /evaluate error:', msg, json);
        return { success: false, error: msg };
      }

      // Forzar forma estable mínima por seguridad
      const base = json?.data ?? json ?? {};
      const retro = base?.retroalimentacion ?? {};
      base.puntaje = String(base?.puntaje ?? 'N/A');
      base.nota = Number.isFinite(Number(base?.nota)) ? Number(base.nota) : 1;

      base.retroalimentacion = {
        correccion_detallada: Array.isArray(retro.correccion_detallada) ? retro.correccion_detallada : [],
        evaluacion_habilidades: Array.isArray(retro.evaluacion_habilidades) ? retro.evaluacion_habilidades : [],
        resumen_general: retro.resumen_general ?? { fortalezas: '', areas_mejora: '' },
        retroalimentacion_alternativas: Array.isArray(retro.retroalimentacion_alternativas) ? retro.retroalimentacion_alternativas : [],
      };

      return { success: true, ...base };
    } catch (e: any) {
      console.error('Error en la evaluación:', e);
      return { success: false, error: e?.message || 'Error desconocido en la evaluación.' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { evaluate, isLoading };
};
