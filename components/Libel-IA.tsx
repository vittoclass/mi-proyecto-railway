'use client'

import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';

// --- Componentes de UI ---
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Loader2, Sparkles, FileUp, Save, Users, User, FileIcon, X, Printer, School } from "lucide-react";

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
}
type WorkflowStep = "upload" | "grouping" | "evaluate";

export default function LibelIA() {
  const SmartCameraModal = dynamic(
    () => import('@/components/smart-camera-modal').then(mod => mod.SmartCameraModal),
    { ssr: false, loading: () => <p>Cargando cámara...</p> }
  );

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

  const generateStudentReport = (group: StudentGroup, config: z.infer<typeof formSchema>, logoUrl?: string) => { /* Tu lógica de reporte aquí */ };
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { /* Tu lógica de subida de logo */ };
  const handleFiles = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files).map(file => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null
    }));
    setFilePreviews(prev => [...prev, ...newFiles]);
    setWorkflowStep("grouping");
  }, []);
  const handleCapture = (file: File) => { handleFiles([file]); };
  const removeFilePreview = (id: string) => { setFilePreviews(prev => prev.filter(f => f.id !== id)); };
  const handleGroupingModeSelect = async (mode: "single" | "multiple") => { /* Tu lógica de agrupación */ };
  const onEvaluateAll = async (values: z.infer<typeof formSchema>) => { /* Tu lógica de evaluación */ };

  return (
    <>
      <SmartCameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCapture} />
      <main className="p-4 md:p-8 max-w-5xl mx-auto font-sans">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">LibelIA Evaluator</h1>
            <p className="text-gray-600">Flujo de trabajo para evaluación multimodal.</p>
        </div>
        {workflowStep === 'upload' && (
          <Card>
            <CardHeader><CardTitle>Paso 1: Sube los archivos</CardTitle></CardHeader>
            <CardContent className="flex flex-col md:flex-row gap-4">
              <label htmlFor="file-upload" className="flex-1 cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-6 text-center h-full flex flex-col justify-center items-center hover:border-blue-500 transition-colors">
                  <FileUp className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-blue-600 font-semibold">Sube uno o más archivos</span>
                </div>
              </label>
              <input id="file-upload" type="file" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))} />
              <Button type="button" variant="outline" className="flex-1 h-auto md:h-full text-lg" onClick={() => setIsCameraOpen(true)}>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Usar Cámara
              </Button>
            </CardContent>
          </Card>
        )}
        {workflowStep === 'grouping' && (
          <Card>
            <CardHeader><CardTitle>Paso 2: Organiza los archivos</CardTitle></CardHeader>
            <CardContent>
              {/* ... JSX para la agrupación ... */}
            </CardContent>
          </Card>
        )}
        {workflowStep === 'evaluate' && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEvaluateAll)} className="space-y-6">
              {/* ... JSX para el formulario de evaluación y la lista de grupos ... */}
            </form>
          </Form>
        )}
      </main>
    </>
  );
}