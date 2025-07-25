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
  // Los demás campos se manejarán dentro de cada grupo
});

// --- NUEVAS INTERFACES PARA EL FLUJO DE TRABAJO ---
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
}

type WorkflowStep = "upload" | "grouping" | "evaluate";

export default function Page() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { rubrica: "" },
  });

  // --- NUEVOS ESTADOS PARA GESTIONAR EL FLUJO ---
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("upload");
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);

  // Estados existentes
  const [isProcessing, setIsProcessing] = useState(false); // Un único estado de carga
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // --- LÓGICA DE MANEJO DE ARCHIVOS (ACTUALIZADA) ---

  // Procesa los archivos subidos (múltiples o uno solo)
  const handleFiles = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files).map(file => ({
      id: `${file.name}-${file.lastModified}`,
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null
    }));
    setFilePreviews(prev => [...prev, ...newFiles]);
    setWorkflowStep("grouping"); // Avanza al siguiente paso
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

    if (mode === "multiple") { // Todos los archivos para un solo estudiante
      const group = {
        id: `group-${Date.now()}`,
        studentName: "Extrayendo nombre...",
        files: filePreviews
      };
      groups.push(group);
      
      const name = await extractNameForGroup(group);
      group.studentName = name || "Estudiante 1";

    } else { // Un archivo por estudiante
      // Creamos un grupo para cada archivo
      groups = filePreviews.map((fp, index) => ({
        id: `group-${Date.now()}-${index}`,
        studentName: "Extrayendo nombre...",
        files: [fp]
      }));
      // Extraemos los nombres en paralelo
      await Promise.all(groups.map(async (group, index) => {
          const name = await extractNameForGroup(group);
          group.studentName = name || `Estudiante ${index + 1}`;
      }));
    }

    setStudentGroups(groups);
    setFilePreviews([]); // Limpiamos los archivos temporales
    setWorkflowStep("evaluate"); // Avanzamos al paso final
    setIsProcessing(false);
  }

  // Función helper para llamar a la API de extracción de nombre
  const extractNameForGroup = async (group: StudentGroup): Promise<string | null> => {
    const formData = new FormData();
    group.files.forEach(fp => formData.append("files", fp.file));
    try {
        const response = await fetch('/api/extract-name', { method: 'POST', body: formData });
        const result = await response.json();
        return result.success ? result.name : null;
    } catch {
        return null;
    }
  }
  
  // --- LÓGICA DE EVALUACIÓN Y GUARDADO ---
  const onEvaluate = async (values: z.infer<typeof formSchema>) => {
    setIsProcessing(true);
    
    // TODO: Implementar la evaluación para cada grupo. Por ahora, evaluamos solo el primero.
    const firstGroup = studentGroups[0];
    if (!firstGroup) {
      alert("No hay grupos para evaluar.");
      setIsProcessing(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", firstGroup.files[0].file); // Enviamos solo el primer archivo por simplicidad
    formData.append("rubrica", values.rubrica);

    try {
      const response = await fetch('/api/evaluate', { method: 'POST', body: formData });
      const result = await response.json();

      if (result.success) {
        // Actualizamos el grupo con la información de la IA
        setStudentGroups(prev => prev.map(g => g.id === firstGroup.id ? {...g, retroalimentacion: result.retroalimentacion, puntaje: result.puntaje } : g));
        alert("Evaluación completada para el primer estudiante.");
        // TODO: Implementar el botón para guardar en Supabase.
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert(`Error durante la evaluación: ${error instanceof Error ? error.message : "Error desconocido"}`);
    } finally {
      setIsProcessing(false);
    }
  }

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
                                    {fp.previewUrl ? <img src={fp.previewUrl} className="aspect-square w-full rounded-md object-cover"/> : <div className="aspect-square w-full rounded-md bg-gray-100 flex items-center justify-center"><FileIcon/></div>}
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
                                <FormItem><FormLabel>Rúbrica o Instrucciones Generales</FormLabel><FormControl><Textarea placeholder="Pega aquí la rúbrica que se aplicará a todos los estudiantes..." {...field} className="min-h-[150px]" /></FormControl><FormMessage /></FormItem>
                            )} />
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        {studentGroups.map(group => (
                            <Card key={group.id}>
                                <CardHeader>
                                    <Input value={group.studentName} onChange={(e) => setStudentGroups(prev => prev.map(g => g.id === group.id ? {...g, studentName: e.target.value} : g))} className="text-lg font-bold"/>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm mb-2 font-semibold">Archivos ({group.files.length}):</p>
                                    {/* Aquí puedes mostrar los archivos del grupo */}
                                    {group.retroalimentacion && (
                                        <div className="mt-4 border-t pt-4">
                                            <h4 className="font-semibold">Resultado de la IA:</h4>
                                            <p><strong>Puntaje:</strong> {group.puntaje}</p>
                                            <p className="text-sm bg-gray-50 p-2 rounded-md mt-1">{group.retroalimentacion}</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    
                    <div className="text-center">
                        <Button type="submit" disabled={isProcessing} className="w-full md:w-auto text-base py-6">
                            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-5 w-5" />}
                            Evaluar con IA (BETA: solo primer grupo)
                        </Button>
                        {/* TODO: Implementar botón de guardado final */}
                    </div>
                </form>
            </Form>
        )}
      </main>
    </>
  )
}