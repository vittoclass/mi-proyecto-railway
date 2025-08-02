'use client'

import { useState, useCallback } from 'react';

export const useEvaluator = () => {
  const [isLoading, setIsLoading] = useState(false);

  const evaluate = useCallback(async (payload: any): Promise<any> => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Ocurrió un error durante la evaluación.");
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