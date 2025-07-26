'use client'

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
// ... (todos tus otros imports)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// ... etc.

// ... (El resto de tu código, como formSchema, interfaces, etc., se mantiene igual)

export default function EvaluatorClient() {
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("upload");
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  // ... (otros estados)

  // ... (getSupabaseClient, handleFiles, removeFilePreview se mantienen igual)

  // --- FUNCIÓN handleGroupingModeSelect (CORREGIDA CON MANEJO DE ERRORES) ---
  const handleGroupingModeSelect = async (mode: "single" | "multiple") => {
    setIsProcessing(true);
    try {
      let tempGroups: StudentGroup[] = [];
      if (mode === 'multiple') {
        tempGroups = [{ id: `group-${Date.now()}`, studentName: "Extrayendo...", files: filePreviews, isEvaluated: false, isEvaluating: false }];
      } else {
        tempGroups = filePreviews.map((fp, index) => ({ id: `group-${Date.now()}-${index}`, studentName: "Extrayendo...", files: [fp], isEvaluated: false, isEvaluating: false }));
      }

      await Promise.all(tempGroups.map(async (group) => {
        const formData = new FormData();
        group.files.forEach(fp => formData.append("files", fp.file));
        
        const response = await fetch('/api/extract-name', { method: 'POST', body: formData });
        if (!response.ok) {
          // Si la respuesta de la API no es exitosa, lanzamos un error
          throw new Error(`El servidor de extracción de nombres falló con estado: ${response.status}`);
        }

        const result = await response.json();
        if (result.success && result.suggestions.length > 0) {
          group.studentName = result.suggestions[0];
          if (result.suggestions.length > 1) group.nameSuggestions = result.suggestions;
        } else {
          group.studentName = "Estudiante (Sin nombre)";
        }
      }));
      
      setStudentGroups(tempGroups);
      setFilePreviews([]);
      setWorkflowStep("evaluate");

    } catch (error) {
      // Si ocurre cualquier error en el proceso, mostramos una alerta y volvemos al paso anterior
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      alert(`Error al procesar los nombres: ${errorMessage}`);
      setWorkflowStep("grouping"); // Volvemos a la pantalla de agrupación
    } finally {
      setIsProcessing(false);
    }
  };

  const onEvaluateAll = async (values: z.infer<typeof formSchema>) => {
    // ... Tu lógica de evaluación se mantiene igual
  };

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto font-sans">
      {/* ... Tu JSX se mantiene igual */}
    </main>
  )
}