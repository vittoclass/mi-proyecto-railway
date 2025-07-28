// app/useEvaluator.ts
'use client'

import { useState, useCallback } from "react";

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

  // El primer parámetro aquí debe ser 'fileUrls' en plural
  const evaluate = useCallback(async (fileUrls: string[], rubrica: string): Promise<EvaluationResult> => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // LA CORRECCIÓN ESTÁ AQUÍ: debe ser 'fileUrls' en plural para que coincida con el backend
        body: JSON.stringify({ fileUrls, rubrica }),
      });

      const data: EvaluationResult = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Ocurrió un error en la evaluación.");
      }
      
      setResult(data);
      return data;

    } catch (err: any) {
      console.error("Error durante la evaluación:", err);
      const errorResult = { success: false, error: err.message || "Ocurrió un error inesperado." };
      setResult(errorResult);
      return errorResult;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, result, evaluate };
};