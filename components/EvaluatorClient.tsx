'use client';

// Esta es una simulación del cliente de evaluación
// En producción, aquí llamarías a tu API route

export const EvaluatorClient = {
  async evaluate(file: File, rubric: string): Promise<{
    grade: string;
    score: number;
    feedback: string;
  }> {
    // Simulación de una evaluación con IA
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          grade: 'A',
          score: 92,
          feedback: 'Excelente trabajo. Muy creativo y bien organizado. La presentación es clara y el contenido es completo.',
        });
      }, 2000);
    });
  },
};