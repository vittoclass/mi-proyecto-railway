'use client'

import { useState, useCallback } from "react"
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
import { AlertTriangle, Camera as CameraIcon, Loader2, Sparkles, FileUp, Save, Users, User, FileIcon, X, Printer, School } from "lucide-react"

const SmartCameraModal = dynamic(
  () => import('@/components/smart-camera-modal'),
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

        {workflowStep === 'upload' && (
          <Card>
            <CardHeader><CardTitle>Paso 1: Sube los archivos</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                  <label htmlFor="file-upload" className="flex-1 cursor-pointer">
                      <div className="border-2 border-dashed rounded-lg p-6 text-center h-full flex flex-col justify-center items-center hover:border-blue-500 transition-colors">
                          <FileUp className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                          <span className="text-blue-600 font-semibold">Sube uno o más archivos</span>
                          <p className="text-xs text-gray-500">O arrástralos aquí</p>
                      </div>
                  </label>
                  <input id="file-upload" type="file" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))} />
                  <Button type="button" variant="outline" className="flex-1 h-auto md:h-full text-lg" onClick={() => setIsCameraOpen(true)}>
                      <CameraIcon className="mr-2 h-6 w-6" /> Usar Cámara
                  </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {workflowStep === 'grouping' && (
          <Card>
            <CardHeader><CardTitle>Paso 2: Organiza los archivos</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-6">
                  <h3 className="font-semibold mb-2">Archivos subidos ({filePreviews.length}):</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
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

        {workflowStep === 'evaluate' && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEvaluateAll)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                      <CardHeader><CardTitle className="flex items-center gap-2"><School/> Datos del Informe</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                          <FormField control={form.control} name="nombreProfesor" render={({ field }) => (<FormItem><FormLabel>Nombre del Profesor</FormLabel><FormControl><Input placeholder="Tu nombre..." {...field} /></FormControl></FormItem>)}/>
                          <FormField control={form.control} name="departamento" render={({ field }) => (<FormItem><FormLabel>Asignatura / Departamento</FormLabel><FormControl><Input placeholder="Ej: Artes Visuales" {...field} /></FormControl></FormItem>)}/>
                          <FormItem>
                              <FormLabel>Logo Institucional (Opcional)</FormLabel>
                              <Input type="file" accept="image/*" onChange={(e) => {if (e.target.files && e.target.files[0]) { setLogoUrl(URL.createObjectURL(e.target.files[0])) }}} />
                              {logoUrl && <img src={logoUrl} alt="logo preview" className="mt-2 h-16 w-auto"/>}
                          </FormItem>
                          <FormField control={form.control} name="flexibilidad" render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Flexibilidad de la IA: {field.value}/5</FormLabel>
                                  <FormControl><Slider defaultValue={[3]} min={1} max={5} step={1} onValueChange={(val) => field.onChange(val[0])}/></FormControl>
                                  <FormDescription>1=Muy Estricto, 5=Muy Benevolente</FormDescription>
                              </FormItem>
                          )}/>
                      </CardContent>
                  </Card>
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
                              {group.isEvaluating && <p className="text-blue-600 font-semibold flex items-center gap-2"><Loader2 className="animate-spin"/>Evaluando...</p>}
                              {group.isEvaluated && (
                                  <div className="mt-2 space-y-2">
                                      {group.error ? (
                                        <div className="text-red-600 flex items-center gap-2"><AlertTriangle/> <strong>Error:</strong> {group.error}</div>
                                      ) : (
                                        <>
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
                                        </>
                                      )}
                                  </div>
                              )}
                          </CardContent>
                      </Card>
                  ))}
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 justify-center pt-4">
                  <Button type="submit" disabled={isProcessing} className="w-full md:w-auto text-base py-6">
                      {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-5 w-5" />}
                      {isProcessing ? 'Procesando...' : `Evaluar ${studentGroups.length} Estudiante(s)`}
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