'use client'

import { useState, useRef, useCallback, useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from '@supabase/supabase-js'

// --- Componentes de UI ---
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { SmartCameraModal } from "@/components/smart-camera-modal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Camera as CameraIcon, Loader2, Sparkles, FileUp, Save, Users, User, FileIcon, X, Printer, School } from "lucide-react"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const formSchema = z.object({
  rubrica: z.string().min(10, "La rúbrica es necesaria para evaluar."),
  nombreProfesor: z.string().optional(),
  departamento: z.string().optional(),
  flexibilidad: z.number().min(1).max(5).default(3),
});

interface FilePreview {
  id: string; file: File; previewUrl: string | null;
}
interface StudentGroup {
  id: string; studentName: string; files: FilePreview[];
  retroalimentacion?: string; puntaje?: string; nota?: number;
  isEvaluated: boolean; isEvaluating: boolean;
}
type WorkflowStep = "upload" | "grouping" | "evaluate";

export default function Page() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { rubrica: "", flexibilidad: 3, nombreProfesor: "", departamento: "" },
  });

  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("upload");
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("");

  // --- **TODA LA LÓGICA AHORA ESTÁ DENTRO DEL COMPONENTE** ---

  const generateStudentReport = (group: StudentGroup, config: z.infer<typeof formSchema>, logoUrl?: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { alert("Por favor, permite las ventanas emergentes."); return; }
    const reportHTML = `<html>...</html>`; // El HTML del informe no cambia
    printWindow.document.write(reportHTML);
    printWindow.document.close();
    printWindow.print();
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => setLogoUrl(event.target?.result as string);
        reader.readAsDataURL(file);
    }
  }

  const handleFiles = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files).map(file => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null
    }));
    setFilePreviews(prev => [...prev, ...newFiles]);
    setWorkflowStep("grouping");
  }, []);

  const handleCapture = (file: File) => {
    handleFiles([file]);
  };
  
  const removeFilePreview = (id: string) => {
    setFilePreviews(prev => prev.filter(f => f.id !== id));
  }

  const extractNameForGroup = async (group: StudentGroup): Promise<string | null> => {
    const formData = new FormData();
    formData.append("files", group.files[0].file);
    try {
        const response = await fetch('/api/extract-name', { method: 'POST', body: formData });
        const result = await response.json();
        return result.success ? result.name : null;
    } catch { return null; }
  }

  const handleGroupingModeSelect = async (mode: "single" | "multiple") => {
    setIsProcessing(true);
    let groups: StudentGroup[];
    if (mode === 'multiple') {
        groups = [{ id: `group-${Date.now()}`, studentName: "Extrayendo nombre...", files: filePreviews, isEvaluated: false, isEvaluating: false }];
    } else {
        groups = filePreviews.map((fp, index) => ({ id: `group-${Date.now()}-${index}`, studentName: "Extrayendo nombre...", files: [fp], isEvaluated: false, isEvaluating: false }));
    }
    await Promise.all(groups.map(async (group, index) => {
        const name = await extractNameForGroup(group);
        group.studentName = name || `Estudiante ${index + 1}`;
    }));
    setStudentGroups(groups);
    setFilePreviews([]);
    setWorkflowStep("evaluate");
    setIsProcessing(false);
  }

  const onEvaluate = async (values: z.infer<typeof formSchema>) => {
    setIsProcessing(true);
    for (const group of studentGroups) {
      setStudentGroups(prev => prev.map(g => g.id === group.id ? { ...g, isEvaluating: true } : g));
      
      const formData = new FormData();
      group.files.forEach(fp => formData.append("files", fp.file));
      formData.append("rubrica", values.rubrica);
      formData.append("flexibilidad", values.flexibilidad.toString());

      try {
        const response = await fetch('/api/evaluate', { method: 'POST', body: formData });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        setStudentGroups(prev => prev.map(g => g.id === group.id ? { ...g, isEvaluating: false, isEvaluated: true, retroalimentacion: result.retroalimentacion, puntaje: result.puntaje, nota: result.nota } : g));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        setStudentGroups(prev => prev.map(g => g.id === group.id ? { ...g, isEvaluating: false, isEvaluated: true, retroalimentacion: `Error: ${errorMessage}`, puntaje: "N/A", nota: 1.0 } : g));
      }
    }
    setIsProcessing(false);
    alert("Proceso de evaluación completado.");
  }

  return (
    <>
      <SmartCameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCapture} />
      <main className="p-4 md:p-8 max-w-5xl mx-auto font-sans">
        {/* ... Pega aquí todo tu JSX sin cambios ... */}
      </main>
    </>
  )
}