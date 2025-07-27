'use client'

import { useState } from "react";
import { useForm } from "react-hook-form";
// ... (todos tus otros imports)

const formSchema = z.object({ /* ... */ });

export default function EvaluatorClient() {
  // ... (toda tu lógica y estados se mantienen igual)
  const [evaluationResult, setEvaluationResult] = useState<{ retro: string; nota: string, puntaje: string } | null>(null);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // ... (tu lógica de evaluación se mantiene igual)
  };

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto font-sans">
      {/* ... (Tu JSX para la subida de archivos y el formulario se mantiene igual) ... */}
      
      {/* --- SECCIÓN CORREGIDA --- */}
      {evaluationResult && (
        <Card className="border-green-400">
          <CardHeader><CardTitle>Resultado</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {/* Accedemos a las propiedades específicas del objeto */}
            <h3 className="text-2xl font-bold">Nota: {evaluationResult.nota}</h3>
            <p className="font-semibold">Puntaje: {evaluationResult.puntaje}</p>
            <p className="text-sm bg-gray-50 p-3 rounded-md">{evaluationResult.retro}</p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}