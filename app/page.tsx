'use client'

import { useState, useRef, useCallback } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from '@supabase/supabase-js'

// --- Componentes de UI y tu SmartCameraModal ---
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { SmartCameraModal } from "@/components/smart-camera-modal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera as CameraIcon, Loader2, Sparkles, FileUp, Save, Users, User, FileIcon, X } from "lucide-react"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const formSchema = z.object({
  rubrica: z.string().min(10, "La rúbrica es necesaria para evaluar."),
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
  // Nuevos estados para el resultado de la evaluación
  retroalimentacion?: string;
  puntaje?: string;
  isEvaluated: boolean;
  isEvaluating: boolean;
}

type WorkflowStep = "upload" | "grouping" | "evaluate";

export default function Page() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { rubrica: "" },
  });

  // --- ESTADOS PARA GESTIONAR EL FLUJO ---
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("upload");
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // --- LÓGICA DE MANEJO DE ARCHIVOS ---
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

  // --- LÓGICA DE AGRUPACIÓN ---
  const handleGroupingModeSelect = async (mode: "single" | "multiple") => {
    setIsProcessing(true);
    let groups: StudentGroup[] = [];

    if (mode === "multiple") {
      const group = {
        id: `group-${Date.now()}`, studentName: "Extrayendo nombre...", files: filePreviews, isEvaluated: false, isEvaluating: false
      };
      groups.push(group);
      const name = await extractNameForGroup(group);
      group.studentName = name || "Estudiante 1";
    } else {
      groups = filePreviews.map((fp, index) => ({
        id: `group-${Date.now()}-${index}`, studentName: "Extrayendo nombre...", files: [fp], isEvaluated: false, isEvaluating: false
      }));
      await Promise.all(groups.map(async (group, index) => {
          const name = await extractNameForGroup(group);
          group.studentName = name || `Estudiante ${index + 1}`;
      }));
    }
    setStudentGroups(groups);
    setFilePreviews([]);
    setWorkflowStep("evaluate");
    setIsProcessing(false);
  }

  const extractNameForGroup = async (group: StudentGroup): Promise<string | null> => {
    const formData = new FormData();
    // Para la extracción, usualmente el primer archivo es suficiente
    formData.append("files", group.files[0].file);
    try {
        const response = await fetch('/api/extract-name', { method: 'POST', body: formData });
        const result = await response.json();
        return result.success ? result.name : null;
    } catch {
        return null;
    }
  }
  
  // --- LÓGICA DE EVALUACIÓN MÚLTIPLE Y GUARDADO ---
  const onEvaluate = async (values: z.infer<typeof formSchema>) => {
    setIsProcessing(true);

    for (const group of studentGroups) {
      // Marcamos el grupo actual como "evaluando"
      setStudentGroups(prev => prev.map(g => g.id === group.id ? { ...g, isEvaluating: true } : g));
      
      const formData = new FormData();
      // Para la evaluación multimodal, es mejor enviar un solo archivo representativo.
      // Si quisieras enviar todos, la API necesitaría ser ajustada.
      formData.append("file", group.files[0].file); 
      formData.append("rubrica", values.rubrica);

      try {
        const response = await fetch('/api/evaluate', { method: 'POST', body: formData });
        const result = await response.json();

        if (result.success) {
          // Actualizamos el grupo con el resultado y lo marcamos como evaluado
          setStudentGroups(prev => prev.map(g => g.id === group.id ? {
            ...g,
            isEvaluating: false,
            isEvaluated: true,
            retroalimentacion: result.retroalimentacion,
            puntaje: result.puntaje
          } : g));
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        // Si hay un error, lo marcamos en el grupo y continuamos
        setStudentGroups(prev => prev.map(g => g.id === group.id ? {
          ...g,
          isEvaluating: false,
          isEvaluated: true, // Marcamos como evaluado para no reintentar
          retroalimentacion: `Error en la evaluación: ${errorMessage}`,
          puntaje: "N/A"
        } : g));
      }
    }
    setIsProcessing(false);
    alert("Proceso de evaluación completado para todos los estudiantes.");
  }
  
  // TODO: Crear una función onSaveAll que tome los studentGroups con datos
  // y los guarde en lote en Supabase.

  return (
    <>
      <SmartCameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCapture} />
      <main className="p-4 md:p-8 max-w-5xl mx-auto font-sans">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Genius Evaluator X</h1>
          <p className="text-gray-600">Flujo de trabajo para evaluación multimodal.</p>
        </div>

        {/* PASO 1: SUBIR ARCHIVOS */}
        {workflowStep === "upload" && (
            <Card>
                <CardHeader><CardTitle>Paso 1: Sube los archivos</CardTitle></CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-4">
                    <label htmlFor="file-upload" className="flex-1 cursor-pointer">
                        <div className="border-2 border-dashed rounded-lg p-6 text-center h-full flex flex-col justify-center items-center hover:border-blue-500 transition-colors">
                            <FileUp className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                            <span className="text-blue-600 font-semibold">Sube uno o más archivos</span>
                            <p className="text-xs text-gray-500">O arrástralos aquí</p>
                        </div>
                    </label>
                    <input id="file-upload" type="file" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
                    <Button type="button" variant="outline" className="flex-1 h-auto md:h-full text-lg" onClick={() => setIsCameraOpen(true)}>
                        <CameraIcon className="mr-2 h-6 w-6" /> Usar Cámara Inteligente
                    </Button>
                </CardContent>
            </Card>
        )}

        {/* PASO 2: AGRUPAR ARCHIVOS */}
        {workflowStep === "grouping" && (
            <Card>
                <CardHeader><CardTitle>Paso 2: Organiza los archivos</CardTitle></CardHeader>
                <CardContent>
                    <div className="mb-6">
                        <h3 className="font-semibold mb-2">Archivos subidos ({filePreviews.length}):</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {filePreviews.map(fp => (
                                <div key={fp.id} className="relative group">
                                    {fp.previewUrl ? <img src={fp.previewUrl} alt={fp.file.name} className="aspect-square w-full rounded-md object-cover"/> : <div className="aspect-square w-full rounded-md bg-gray-100 flex items-center justify-center"><FileIcon/></div>}
                                    <p className="text-xs truncate mt-1">{fp.file.name}</p>
                                    <Button size="sm" variant="destructive" className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => removeFilePreview(fp.id)}><X className="h-4 w-4"/></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="text-center border-t pt-6">
                        <h3 className="font-semibold mb-4">¿Estos archivos a quién pertenecen?</h3>
                        <div className="flex flex-col md:flex-row gap-4 justify-center">
                            <Button size="lg" onClick={() => handleGroupingModeSelect('multiple')} disabled={isProcessing}>
                                <User className="mr-2"/> A un solo estudiante
                            </Button>
                            <Button size="lg" onClick={() => handleGroupingModeSelect('single')} disabled={isProcessing}>
                                <Users className="mr-2"/> A varios estudiantes (uno por archivo)
                            </Button>
                        </div>
                        {isProcessing && <p className="mt-4 text-blue-600 animate-pulse">Organizando y extrayendo nombres...</p>}
                    </div>
                </CardContent>
            </Card>
        )}

        {/* PASO 3: EVALUAR */}
        {workflowStep === "evaluate" && (
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onEvaluate)} className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Paso 3: Rúbrica y Evaluación</CardTitle></CardHeader>
                        <CardContent>
                             <FormField control={form.control} name="rubrica" render={({ field }) => (
                                <FormItem><FormLabel>Rúbrica o Instrucciones Generales para Todos</FormLabel><FormControl><Textarea placeholder="Pega aquí la rúbrica que se aplicará a todos los estudiantes..." {...field} className="min-h-[150px]" /></FormControl><FormMessage /></FormItem>
                            )} />
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">Estudiantes a Evaluar:</h3>
                        {studentGroups.map((group, index) => (
                            <Card key={group.id} className={`${group.isEvaluating ? 'animate-pulse' : ''} ${group.isEvaluated ? 'bg-green-50' : ''}`}>
                                <CardHeader>
                                    <Input value={group.studentName} onChange={(e) => setStudentGroups(prev => prev.map(g => g.id === group.id ? {...g, studentName: e.target.value} : g))} className="text-lg font-bold"/>
                                </CardHeader>
                                <CardContent>
                                    {group.isEvaluating && <p className="text-blue-600 font-semibold">Evaluando...</p>}
                                    {group.isEvaluated && (
                                        <div className="mt-2 border-t pt-4">
                                            <h4 className="font-semibold">Resultado de la IA:</h4>
                                            <p className="font-bold">Puntaje: {group.puntaje}</p>
                                            <p className="text-sm bg-gray-100 p-2 rounded-md mt-1">{group.retroalimentacion}</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-4 justify-center pt-4">
                        <Button type="submit" disabled={isProcessing} className="w-full md:w-auto text-base py-6">
                            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-5 w-5" />}
                            {isProcessing ? 'Procesando Estudiantes...' : `Evaluar ${studentGroups.length} Estudiante(s)`}
                        </Button>
                        <Button type="button" variant="secondary" disabled={isProcessing} className="w-full md:w-auto text-base py-6">
                           <Save className="mr-2 h-5 w-5"/> Guardar Resultados
                        </Button>
                    </div>
                </form>
            </Form>
        )}
      </main>
    </>
  )
}