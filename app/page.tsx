'use client'

import { useState, useRef, useCallback } from "react"
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

// --- INTERFACES PARA EL FLUJO DE TRABAJO ---
interface FilePreview {
  id: string;
  file: File;
  previewUrl: string | null;
}
interface StudentGroup {
  id: string;
  studentName: string;
  files: FilePreview[];
  retroalimentacion?: string;
  puntaje?: string;
  nota?: number;
  isEvaluated: boolean;
  isEvaluating: boolean;
}
type WorkflowStep = "upload" | "grouping" | "evaluate";

// --- FUNCIÓN PARA GENERAR INFORMES ---
const generateStudentReport = (group: StudentGroup, config: z.infer<typeof formSchema>, logoUrl?: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
        alert("Por favor, permite las ventanas emergentes para generar el informe.");
        return;
    }
    const reportHTML = `
        <html>
            <head><title>Informe de Evaluación - ${group.studentName}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 2rem; }
                .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #ccc; padding-bottom: 1rem; margin-bottom: 2rem; }
                .header-info h1 { margin: 0; } .header-info p { margin: 5px 0; color: #555; }
                .logo { max-height: 80px; }
                .grade-box { background-color: #f0f8ff; border: 1px solid #add8e6; border-radius: 8px; padding: 1.5rem; text-align: center; margin-bottom: 2rem; }
                .grade { font-size: 3rem; font-weight: bold; color: #00008b; }
                .score { font-size: 1.2rem; color: #4682b4; }
                h2 { border-bottom: 1px solid #eee; padding-bottom: 0.5rem; margin-top: 2rem; }
                .feedback { background-color: #fafafa; padding: 1rem; border-radius: 5px; white-space: pre-wrap; }
            </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-info">
                        <h1>Informe de Evaluación</h1>
                        <p><strong>Estudiante:</strong> ${group.studentName}</p>
                        <p><strong>Profesor:</strong> ${config.nombreProfesor || 'No especificado'}</p>
                        <p><strong>Asignatura:</strong> ${config.departamento || 'No especificado'}</p>
                    </div>
                    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo"/>` : ''}
                </div>
                <div class="grade-box">
                    <div class="grade">${group.nota ? group.nota.toFixed(1) : "N/A"}</div>
                    <div class="score">Puntaje: ${group.puntaje || "N/A"}</div>
                </div>
                <h2>Retroalimentación de la IA</h2>
                <div class="feedback"><p>${group.retroalimentacion || "Sin retroalimentación."}</p></div>
            </body>
        </html>
    `;
    printWindow.document.write(reportHTML);
    printWindow.document.close();
    printWindow.print();
}

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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (event) => setLogoUrl(event.target?.result as string);
          reader.readAsDataURL(file);
      }
  }
  
  // --- **AQUÍ ESTÁ LA FUNCIÓN QUE FALTABA** ---
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

  const handleGroupingModeSelect = async (mode: "single" | "multiple") => {
    setIsProcessing(true);
    let groups: StudentGroup[] = filePreviews.map((fp, index) => ({
        id: `group-${Date.now()}-${index}`,
        studentName: "Extrayendo nombre...",
        files: mode === 'multiple' ? filePreviews : [fp],
        isEvaluated: false,
        isEvaluating: false,
    }));
    if (mode === 'multiple') groups = [groups[0]]; // Si es múltiple, solo nos quedamos con un grupo que contiene todos los archivos

    await Promise.all(groups.map(async (group, index) => {
        const name = await extractNameForGroup(group);
        group.studentName = name || `Estudiante ${index + 1}`;
    }));
    
    setStudentGroups(groups);
    setFilePreviews([]);
    setWorkflowStep("evaluate");
    setIsProcessing(false);
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

        setStudentGroups(prev => prev.map(g => g.id === group.id ? {
          ...g, isEvaluating: false, isEvaluated: true,
          retroalimentacion: result.retroalimentacion, puntaje: result.puntaje, nota: result.nota
        } : g));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        setStudentGroups(prev => prev.map(g => g.id === group.id ? {
          ...g, isEvaluating: false, isEvaluated: true,
          retroalimentacion: `Error en la evaluación: ${errorMessage}`, puntaje: "N/A", nota: 1.0
        } : g));
      }
    }
    setIsProcessing(false);
    alert("Proceso de evaluación completado para todos los estudiantes.");
  }
  
  return (
    <>
      <SmartCameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCapture} />
      <main className="p-4 md:p-8 max-w-5xl mx-auto font-sans">
        {/* ... (El resto del JSX es el mismo que en la versión anterior, pégalo aquí) ... */}
        {/* ... Asegúrate de incluir el JSX para los 3 pasos del workflow ... */}
      </main>
    </>
  )
}