// hooks/useEvaluator.ts
'use client'

import { useState, useCallback } from "react";

// La interfaz no cambia
export interface EvaluationResult {
  success: boolean;
  retroalimentacion?: string;
  puntaje?: string;
  nota?: number;
  error?: string;
}

export const useEvaluator = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);

  // La función 'evaluate' ahora usa fetch para llamar a nuestro propio API Route
  const evaluate = useCallback(async (fileUrl: string, rubrica: string) => {
    setIsLoading(true);
    setResult(null);

    try {
      // Llamamos al endpoint que creaste en 'app/api/evaluate/route.ts'
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileUrl, rubrica }),
      });

      const data: EvaluationResult = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Ocurrió un error en la evaluación.");
      }
      
      setResult(data);

    } catch (err: any) {
      console.error("Error durante la evaluación:", err);
      setResult({ success: false, error: err.message || "Ocurrió un error inesperado." });
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    result,
    evaluate,
  };
};