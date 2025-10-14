// useEvaluator.ts
'use client';

import { useState, useCallback } from 'react';

// Extrae respuestas de alternativas y V/F del OCR (simulado aquí)
// En tu app real, esto viene del resultado del OCR en /api/evaluate
function extractRespuestasObjetivasFromOCR(ocrResult: any) {
  // Supón que tu OCR devuelve algo como:
  // { sm: ['a','b','c',...], vf: ['V','F','F',...] }
  return {
    sm: ocrResult.respuestasSM || [],
    vf: ocrResult.respuestasVF || [],
  };
}

// Corrige automáticamente usando la pauta
function corregirObjetivas(pautaStr: string, respuestasEstudiante: { sm: string[]; vf: string[] }) {
  // Parsear pauta: "SM: b,c,b,a,...\nVF: F,F,F,V,F"
  const lines = pautaStr.split('\n').map(l => l.trim()).filter(Boolean);
  let pautaSM: string[] = [];
  let pautaVF: string[] = [];

  for (const line of lines) {
    if (line.startsWith('SM:')) {
      pautaSM = line.replace('SM:', '').split(',').map(s => s.trim().toUpperCase());
    } else if (line.startsWith('VF:')) {
      pautaVF = line.replace('VF:', '').split(',').map(s => s.trim().toUpperCase());
    }
  }

  // Corregir SM
  const smCorrectas = respuestasEstudiante.sm
    .map((resp, i) => resp.trim().toUpperCase() === pautaSM[i])
    .filter(Boolean).length;

  // Corregir VF
  const vfCorrectas = respuestasEstudiante.vf
    .map((resp, i) => resp.trim().toUpperCase() === pautaVF[i])
    .filter(Boolean).length;

  return {
    smCorrectas,
    smTotal: pautaSM.length,
    vfCorrectas,
    vfTotal: pautaVF.length,
  };
}

export const useEvaluator = () => {
  const [isLoading, setIsLoading] = useState(false);

  const evaluate = useCallback(async (payload: any): Promise<any> => {
    setIsLoading(true);
    try {
      // Paso 1: Llamar a la API para procesar imágenes y extraer texto (OCR + IA para desarrollo)
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Ocurrió un error durante la evaluación.');
      }

      // Paso 2: Si hay pauta y hay respuestas objetivas, corregir automáticamente
      if (payload.pauta && data.ocrResult) {
        const respuestasEstudiante = extractRespuestasObjetivasFromOCR(data.ocrResult);
        const correccionObjetiva = corregirObjetivas(payload.pauta, respuestasEstudiante);

        // Inyectar corrección exacta en el resultado
        data.retroalimentacion = {
          ...data.retroalimentacion,
          correccion_objetiva: {
            sm: {
              correctas: correccionObjetiva.smCorrectas,
              total: correccionObjetiva.smTotal,
            },
            vf: {
              correctas: correccionObjetiva.vfCorrectas,
              total: correccionObjetiva.vfTotal,
            },
          },
          // Mantén la evaluación de desarrollo intacta (viene de la IA)
          correccion_detallada: data.retroalimentacion?.correccion_detallada || [],
          evaluacion_habilidades: data.retroalimentacion?.evaluacion_habilidades || [],
          resumen_general: data.retroalimentacion?.resumen_general || {},
        };

        // Calcular puntaje total exacto
        const puntajeSM = correccionObjetiva.smCorrectas;
        const puntajeVF = correccionObjetiva.vfCorrectas * 2; // 2 pts c/u
        const puntajeDesarrollo = data.retroalimentacion?.puntajeDesarrollo || 0; // asume que la IA ya lo calculó
        data.puntajeTotal = puntajeSM + puntajeVF + puntajeDesarrollo;
      }

      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { evaluate, isLoading };
};