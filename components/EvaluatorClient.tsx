import { useState } from 'react';

interface EvaluationRequest {
  fileUrl: string;
  rubrica: string;
}

interface EvaluationResult {
  success: boolean;
  feedback?: string;
  error?: string;
}

export const useEvaluatorClient = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);

  const evaluate = async (fileUrl: string, rubrica: string) => {
    // Validación previa
    if (!fileUrl || !rubrica) {
      setResult({
        success: false,
        error: 'Faltan datos en la petición (fileUrl o rubrica).',
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileUrl, rubrica }), // Aquí se envían ambos
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la evaluación');
      }

      setResult({
        success: true,
        feedback: data.feedback,
      });
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return { evaluate, loading, result };
};