'use client'

import { useCallback } from "react";

// La interfaz para el resultado que esperamos al final
export interface EvaluationResult {
  success: boolean;
  retroalimentacion?: any;
  puntaje?: string;
  nota?: number;
  error?: string;
}

export const useEvaluator = () => {
  // Inicia la tarea de evaluación en el backend
  const startEvaluation = useCallback(async (payload: any): Promise<{ jobId?: string; error?: string }> => {
    try {
      const response = await fetch('/api/evaluate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error al iniciar la tarea de evaluación.");
      }
      return { jobId: data.jobId };
    } catch (err: any) {
      console.error("Error en startEvaluation:", err);
      return { error: err.message };
    }
  }, []);

  // Consulta el estado de una tarea que ya está en proceso
  const checkEvaluationStatus = useCallback(async (jobId: string): Promise<any> => {
    try {
      const response = await fetch(`/api/evaluate/status?jobId=${jobId}`);
      if (!response.ok) {
        throw new Error("Error del servidor al consultar el estado de la tarea.");
      }
      return await response.json();
    } catch (err: any) {
      console.error("Error en checkEvaluationStatus:", err);
      return { status: 'failed', error: err.message };
    }
  }, []);

  return {
    startEvaluation,
    checkEvaluationStatus,
  };
};