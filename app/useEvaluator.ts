// useEvaluator.ts
'use client';

import { useState, useCallback } from 'react';

// 1. Parsea la pauta del profesor
function parsePauta(pautaStr: string) {
  const lines = pautaStr.split('\n').map(l => l.trim()).filter(Boolean);
  let sm: string[] = [];
  let vf: string[] = [];

  for (const line of lines) {
    if (line.startsWith('SM:')) {
      sm = line.replace('SM:', '').split(',').map(s => s.trim().toUpperCase());
    } else if (line.startsWith('VF:')) {
      vf = line.replace('VF:', '').split(',').map(s => s.trim().toUpperCase());
    }
  }
  return { sm, vf };
}

// 2. Corrige comparando con la pauta
function corregirObjetivas(pauta: { sm: string[]; vf: string[] }, respuestas: { sm: string[]; vf: string[] }) {
  const smCorregido = pauta.sm.map((correcta, i) => ({
    respuesta: respuestas.sm[i] || '',
    correcta,
    esCorrecta: (respuestas.sm[i] || '').trim().toUpperCase() === correcta
  }));

  const vfCorregido = pauta.vf.map((correcta, i) => ({
    respuesta: respuestas.vf[i] || '',
    correcta,
    esCorrecta: (respuestas.vf[i] || '').trim().toUpperCase() === correcta
  }));

  return {
    sm: smCorregido,
    vf: vfCorregido,
    smCorrectas: smCorregido.filter(r => r.esCorrecta).length,
    vfCorrectas: vfCorregido.filter(r => r.esCorrecta).length
  };
}

export const useEvaluator = () => {
  const [isLoading, setIsLoading] = useState(false);

  const evaluate = useCallback(async (payload: any): Promise<any> => {
    setIsLoading(true);
    try {
      // Llama a tu API para procesar imágenes y extraer texto
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error en la evaluación.');
      }

      // Si hay pauta y respuestas extraídas, corrige automáticamente
      if (payload.pauta && data.respuestasExtraidas) {
        const pauta = parsePauta(payload.pauta);
        const correccion = corregirObjetivas(pauta, data.respuestasExtraidas);

        // Inyecta la corrección exacta en el resultado
        data.retroalimentacion = {
          ...data.retroalimentacion,
          correccion_objetiva: correccion
        };
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