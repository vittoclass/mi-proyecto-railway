'use client'

import { useState, useRef, useCallback } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from '@supabase/supabase-js'
import dynamic from 'next/dynamic'

// --- Componentes de UI ---
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Camera as CameraIcon, Loader2, Sparkles, FileUp, Save, Users, User, FileIcon, X, Printer, School } from "lucide-react"

// --- IMPORTACIÓN DINÁMICA (CLAVE PARA EVITAR ERRORES) ---
const SmartCameraModal = dynamic(
  () => import('@/components/smart-camera-modal').then(mod => mod.SmartCameraModal),
  { 
    ssr: false,
    loading: () => <p>Cargando cámara...</p> 
  }
)

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
}
type WorkflowStep = "upload" | "grouping" | "evaluate";

const generateStudentReport = (group: StudentGroup, config: z.infer<typeof formSchema>, logoUrl?: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { alert("Por favor, permite las ventanas emergentes."); return; }
    // Tu código HTML para el informe aquí...
    printWindow.document.write(`<html>...</html>`);
    printWindow.document.close();
    printWindow.print();
}

export default function EvaluatorClient() {
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
    const newFiles = Array.from(files).map(file => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null
    }));
    setFilePreviews(prev => [...prev, ...newFiles]);
    setWorkflowStep("grouping");
  }, []);

  // ... (Pega aquí el resto de tus funciones: handleCapture, removeFilePreview, handleGroupingModeSelect, extractNameForGroup, onEvaluateAll)

  return (
    <>
      <SmartCameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleFiles} />
      <main className="p-4 md:p-8 max-w-5xl mx-auto font-sans">
        {/* Tu JSX completo aquí, mostrando las vistas según el workflowStep */}
      </main>
    </>
  )
}