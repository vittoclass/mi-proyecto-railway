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
interface FilePreview { /* ... (sin cambios) ... */ }
interface StudentGroup {
  id: string;
  studentName: string;
  files: FilePreview[];
  retroalimentacion?: string;
  puntaje?: string;
  nota?: number; // Añadimos la nota
  isEvaluated: boolean;
  isEvaluating: boolean;
}
type WorkflowStep = "upload" | "grouping" | "evaluate";

// --- NUEVA FUNCIÓN PARA GENERAR INFORMES ---
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
    defaultValues: { rubrica: "", flexibilidad: 3 },
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
  
  // --- LÓGICA DE MANEJO DE ARCHIVOS Y GRUPOS (SIN CAMBIOS) ---
  // ... (pega aquí las funciones handleFiles, handleCapture, removeFilePreview, handleGroupingModeSelect, extractNameForGroup)

  // --- LÓGICA DE EVALUACIÓN MÚLTIPLE (ACTUALIZADA) ---
  const onEvaluate = async (values: z.infer<typeof formSchema>) => {
    setIsProcessing(true);
    for (const group of studentGroups) {
      setStudentGroups(prev => prev.map(g => g.id === group.id ? { ...g, isEvaluating: true } : g));
      
      const formData = new FormData();
      group.files.forEach(fp => formData.append("files", fp.file)); // ENVIAMOS TODOS LOS ARCHIVOS
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
  
  // --- RENDERIZADO DEL COMPONENTE ---
  return (
    <>
      <SmartCameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleFiles} />
      <main className="p-4 md:p-8 max-w-5xl mx-auto font-sans">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">Genius Evaluator X</h1>
        </div>

        {/* PASO 1 y 2 (Upload y Grouping) se mantienen igual */}
        {/* ... (pega aquí el JSX de los pasos 1 y 2) ... */}

        {/* PASO 3: EVALUAR (ACTUALIZADO CON CONFIGURACIÓN) */}
        {workflowStep === "evaluate" && (
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onEvaluate)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Columna de Configuración */}
                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><School/> Datos del Informe</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField control={form.control} name="nombreProfesor" render={({ field }) => (
                                    <FormItem><FormLabel>Nombre del Profesor</FormLabel><FormControl><Input placeholder="Tu nombre..." {...field} /></FormControl></FormItem>
                                )}/>
                                <FormField control={form.control} name="departamento" render={({ field }) => (
                                    <FormItem><FormLabel>Asignatura / Departamento</FormLabel><FormControl><Input placeholder="Ej: Artes Visuales" {...field} /></FormControl></FormItem>
                                )}/>
                                <FormItem>
                                    <FormLabel>Logo Institucional (Opcional)</FormLabel>
                                    <Input type="file" accept="image/*" onChange={handleLogoUpload} />
                                    {logoUrl && <img src={logoUrl} alt="logo preview" className="mt-2 h-16 w-auto"/>}
                                </FormItem>
                                <FormField control={form.control} name="flexibilidad" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Flexibilidad de la IA: {field.value}/5</FormLabel>
                                        <FormControl>
                                            <Slider defaultValue={[3]} min={1} max={5} step={1} onValueChange={(val) => field.onChange(val[0])}/>
                                        </FormControl>
                                        <FormDescription>1=Muy Estricto, 5=Muy Benevolente</FormDescription>
                                    </FormItem>
                                )}/>
                            </CardContent>
                        </Card>
                        {/* Columna de Rúbrica */}
                        <Card>
                            <CardHeader><CardTitle>Rúbrica General</CardTitle></CardHeader>
                            <CardContent>
                                <FormField control={form.control} name="rubrica" render={({ field }) => (
                                    <FormItem><FormControl><Textarea placeholder="Pega aquí la rúbrica que se aplicará a todos los estudiantes..." {...field} className="min-h-[300px]" /></FormControl><FormMessage /></FormItem>
                                )}/>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">Estudiantes a Evaluar:</h3>
                        {studentGroups.map((group) => (
                            <Card key={group.id} className={`${group.isEvaluating ? 'animate-pulse border-blue-400' : ''} ${group.isEvaluated ? 'border-green-400' : ''}`}>
                                <CardHeader>
                                    <Input value={group.studentName} onChange={(e) => setStudentGroups(prev => prev.map(g => g.id === group.id ? {...g, studentName: e.target.value} : g))} className="text-lg font-bold"/>
                                </CardHeader>
                                <CardContent>
                                    {group.isEvaluating && <p className="text-blue-600 font-semibold">Evaluando...</p>}
                                    {group.isEvaluated && (
                                        <div className="mt-2 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h4 className="font-semibold">Resultado de la IA:</h4>
                                                    <p className="font-bold">Nota: {group.nota?.toFixed(1) ?? 'N/A'} ({group.puntaje ?? 'N/A'})</p>
                                                </div>
                                                <Button type="button" variant="outline" size="sm" onClick={() => generateStudentReport(group, form.getValues(), logoUrl)}>
                                                    <Printer className="mr-2 h-4 w-4"/> Generar Informe
                                                </Button>
                                            </div>
                                            <p className="text-sm bg-gray-50 p-2 rounded-md mt-1">{group.retroalimentacion}</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    
                    <div className="text-center pt-4">
                        <Button type="submit" disabled={isProcessing} className="w-full md:w-auto text-base py-6">
                            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-5 w-5" />}
                            {isProcessing ? 'Procesando Estudiantes...' : `Evaluar ${studentGroups.length} Estudiante(s)`}
                        </Button>
                    </div>
                </form>
            </Form>
        )}
      </main>
    </>
  )
}