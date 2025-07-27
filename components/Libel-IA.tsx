'use client'

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
// ... (todos tus otros imports)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// ... etc.

// ... (El resto de tu código, como formSchema, interfaces, etc., se mantiene igual)

export default function LibelIA() {
  // ... (Toda tu lógica de estados y la mayoría de las funciones se mantienen igual)

  const onEvaluateAll = async (values: z.infer<typeof formSchema>) => {
    setIsProcessing(true);
    const supabase = getSupabaseClient();
    let updatedGroups = [...studentGroups];

    for (let i = 0; i < updatedGroups.length; i++) {
        const group = updatedGroups[i];
        setStudentGroups(prev => prev.map(g => g.id === group.id ? { ...g, isEvaluating: true, error: undefined } : g));

        try {
            const imageUrls = await Promise.all(
              group.files.map(async (fp) => {
                const filePath = `evaluaciones/${Date.now()}_${fp.file.name}`;
                const { error } = await supabase.storage.from("imagenes").upload(filePath, fp.file);
                if (error) throw new Error(`Error subiendo archivo a Supabase: ${error.message}`);
                return supabase.storage.from("imagenes").getPublicUrl(filePath).data.publicUrl;
              })
            );

            // --- PUNTO DE INSPECCIÓN ---
            const payload = {
                imageUrls,
                rubrica: values.rubrica,
                flexibilidad: values.flexibilidad,
            };
            console.log(`Enviando payload para ${group.studentName}:`, JSON.stringify(payload, null, 2));
            // --- FIN DEL PUNTO DE INSPECCIÓN ---

            const response = await fetch('/api/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);

            updatedGroups[i] = {...group, isEvaluating: false, isEvaluated: true, retroalimentacion: result.retroalimentacion, puntaje: result.puntaje, nota: result.nota };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Error desconocido";
            updatedGroups[i] = {...group, isEvaluating: false, isEvaluated: true, error: errorMessage, puntaje: "N/A", nota: 1.0 };
        }
        setStudentGroups([...updatedGroups]);
    }
    setIsProcessing(false);
    alert("Proceso de evaluación completado.");
  };

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto font-sans">
      {/* Tu JSX se mantiene igual */}
    </main>
  )
}