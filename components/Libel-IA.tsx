'use client'

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';

// --- Tus imports de UI aquí ---
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { AlertTriangle, Camera as CameraIcon, Loader2, Sparkles, FileUp, Save, Users, User, FileIcon, X, Printer, School } from "lucide-react";

const SmartCameraModal = dynamic(
  () => import('@/components/smart-camera-modal').then(mod => mod.SmartCameraModal),
  { ssr: false, loading: () => <div className="p-4 text-center">Cargando cámara...</div> }
);

const formSchema = z.object({
  nombreProfesor: z.string().optional(),
  departamento: z.string().optional(),
  rubrica: z.string().min(10, "La rúbrica es necesaria para evaluar."),
  flexibilidad: z.number().min(1).max(5).default(3),
});

interface FilePreview { id: string; file: File; previewUrl: string | null; }
interface StudentGroup {
  id: string; studentName: string; files: FilePreview[];
  retroalimentacion?: string; puntaje?: string; nota?: number;
  isEvaluated: boolean; isEvaluating: boolean;
  nameSuggestions?: string[];
  error?: string;
}
type WorkflowStep = "upload" | "grouping" | "evaluate";

const generateStudentReport = (group: StudentGroup, config: z.infer<typeof formSchema>, logoUrl?: string) => { /* Tu lógica de reporte aquí */ }

export default function LibelIA() {
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("upload");
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { rubrica: "", flexibilidad: 3, nombreProfesor: "", departamento: "" },
  });

  const getSupabaseClient = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleFiles = useCallback((files: FileList | File[]) => {
    if (files.length === 0) return;
    const newFiles = Array.from(files).map(file => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null
    }));
    setFilePreviews(prev => [...prev, ...newFiles]);
    setWorkflowStep("grouping");
  }, []);
  
  const handleCapture = (file: File) => { handleFiles([file]); };
  const removeFilePreview = (id: string) => {
    const fileToRemove = filePreviews.find(f => f.id === id);
    if (fileToRemove && fileToRemove.previewUrl) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
    }
    setFilePreviews(prev => prev.filter(f => f.id !== id));
  };

  const handleGroupingModeSelect = async (mode: "single" | "multiple") => {
    setIsProcessing(true);
    let tempGroups: StudentGroup[] = [];
    if (mode === 'multiple') {
      tempGroups = [{ id: `group-${Date.now()}`, studentName: "Extrayendo...", files: filePreviews, isEvaluated: false, isEvaluating: false }];
    } else {
      tempGroups = filePreviews.map((fp, index) => ({ id: `group-${Date.now()}-${index}`, studentName: "Extrayendo...", files: [fp], isEvaluated: false, isEvaluating: false }));
    }

    try {
        await Promise.all(tempGroups.map(async (group, index) => {
            const formData = new FormData();
            group.files.forEach(fp => formData.append("files", fp.file));
            const response = await fetch('/api/extract-name', { method: 'POST', body: formData });
            if (!response.ok) throw new Error("El servidor de extracción de nombres falló.");
            
            const result = await response.json();
            if (result.success && result.suggestions.length > 0) {
              group.studentName = result.suggestions[0];
              if (result.suggestions.length > 1) group.nameSuggestions = result.suggestions;
            } else {
              group.studentName = `Estudiante ${index + 1} (Sin nombre)`;
            }
        }));
        setStudentGroups(tempGroups);
        setFilePreviews([]);
        setWorkflowStep("evaluate");
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        alert(`No se pudo procesar la extracción de nombres. Error: ${errorMessage}`);
    } finally {
        setIsProcessing(false);
    }
  };

  // --- FUNCIÓN onEvaluateAll REESCRITA ---
  const onEvaluateAll = async () => {
    // Forzamos la validación del formulario primero
    const isValid = await form.trigger();
    if (!isValid) {
        alert("Por favor, corrige los errores en el formulario antes de evaluar.");
        return;
    }
    
    // Obtenemos los valores más actuales directamente del formulario
    const values = form.getValues();

    setIsProcessing(true);
    const supabase = getSupabaseClient();
    let updatedGroups = [...studentGroups];

    for (let i = 0; i < updatedGroups.length; i++) {
        const group = updatedGroups[i];
        setStudentGroups(prev => prev.map(g => g.id === group.id ? { ...g, isEvaluating: true, error: undefined } : g));

        try {
            if (group.files.length === 0) throw new Error("Este grupo no tiene archivos.");

            const imageUrls = await Promise.all(
              group.files.map(async (fp) => {
                const filePath = `evaluaciones/${Date.now()}_${fp.file.name}`;
                const { error } = await supabase.storage.from("imagenes").upload(filePath, fp.file);
                if (error) throw new Error(`Error subiendo archivo: ${error.message}`);
                return supabase.storage.from("imagenes").getPublicUrl(filePath).data.publicUrl;
              })
            );
            
            if (!imageUrls || imageUrls.length === 0) throw new Error("No se pudieron generar las URLs de las imágenes.");

            const response = await fetch('/api/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrls,
                    rubrica: values.rubrica,
                    flexibilidad: values.flexibilidad,
                }),
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
    <>
      <SmartCameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCapture} />
      <main className="p-4 md:p-8 max-w-5xl mx-auto font-sans">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">LibelIA Evaluator</h1>
            <p className="text-gray-600">Flujo de trabajo para evaluación multimodal.</p>
        </div>
        
        {/* El JSX para los pasos 'upload' y 'grouping' se mantiene igual */}
        
        {workflowStep === 'evaluate' && (
          <Form {...form}>
            {/* OJO: Cambiamos el onSubmit para que llame a nuestra nueva función */}
            <form onSubmit={(e) => { e.preventDefault(); onEvaluateAll(); }} className="space-y-6">
              {/* El resto del JSX del formulario se mantiene igual */}
            </form>
          </Form>
        )}
      </main>
    </>
  );
}