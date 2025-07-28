'use client'

import { useState, useRef, ChangeEvent, useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import dynamic from 'next/dynamic'

// --- Componentes de UI ---
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider" // <-- NUEVO
import { Loader2, Sparkles, FileUp, Camera, Users, FileText, X, Printer } from "lucide-react"

// --- Hook de Evaluación ---
import { useEvaluator } from "./useEvaluator"

// --- Importación Dinámica ---
const SmartCameraModal = dynamic(() => import('../components/smart-camera-modal'), { 
    ssr: false,
    loading: () => <div className="flex items-center gap-2"><Loader2 className="animate-spin h-4 w-4" />Cargando cámara...</div> 
})

// --- Esquema y Tipos ---
const formSchema = z.object({
  rubrica: z.string().min(10, "La rúbrica es necesaria."),
  flexibilidad: z.array(z.number()).default([3]), // <-- NUEVO
});

interface FilePreview { id: string; file: File; previewUrl: string; dataUrl: string; }
interface StudentGroup {
  id: string; studentName: string; files: FilePreview[];
  retroalimentacion?: string; puntaje?: string; nota?: number;
  decimasAdicionales: number; // <-- NUEVO
  isEvaluated: boolean; isEvaluating: boolean; error?: string;
}

// --- COMPONENTE PRINCIPAL ---
export default function EvaluatorClient() {
  // --- Estados ---
  const [evaluationMode, setEvaluationMode] = useState<'single' | 'multiple'>('single');
  const [numStudents, setNumStudents] = useState(1);
  const [unassignedFiles, setUnassignedFiles] = useState<FilePreview[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Hooks ---
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema), defaultValues: { rubrica: "", flexibilidad: [3] },
  });
  const { evaluate, isLoading: isEvaluationLoading } = useEvaluator();

  // --- Efecto para crear grupos ---
  useEffect(() => {
    const count = evaluationMode === 'single' ? 1 : numStudents;
    const newGroups: StudentGroup[] = Array.from({ length: count }, (_, i) => ({
        id: `student-${Date.now()}-${i}`,
        studentName: count > 1 ? `Alumno ${i + 1}` : 'Alumno',
        files: [], isEvaluated: false, isEvaluating: false,
        decimasAdicionales: 0, // <-- NUEVO
    }));
    setStudentGroups(newGroups);
    setUnassignedFiles([]);
  }, [evaluationMode, numStudents]);

  // --- Lógica de Manejo de Archivos (sin cambios) ---
  const processFiles = (files: File[]) => { files.forEach(file => { const reader = new FileReader(); reader.onload = (e) => { const dataUrl = e.target?.result as string; const previewUrl = URL.createObjectURL(file); const newFilePreview: FilePreview = { id: `${file.name}-${file.lastModified}-${Math.random()}`, file, previewUrl, dataUrl, }; setUnassignedFiles(prev => [...prev, newFilePreview]); }; reader.readAsDataURL(file); }); };
  const handleFilesSelected = (files: FileList | null) => { if (!files) return; processFiles(Array.from(files)); };
  const handleCapture = (dataUrl: string) => { fetch(dataUrl).then(res => res.blob()).then(blob => { const file = new File([blob], `captura-${Date.now()}.png`, { type: 'image/png' }); processFiles([file]); }); setIsCameraOpen(false); };
  
  // --- Lógica de Agrupación (sin cambios) ---
  const updateStudentName = (groupId: string, newName: string) => { setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, studentName: newName } : g)); };
  const assignFileToGroup = (fileId: string, groupId: string) => { const fileToMove = unassignedFiles.find(f => f.id === fileId); if (!fileToMove) return; setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, files: [...g.files, fileToMove] } : g)); setUnassignedFiles(files => files.filter(f => f.id !== fileId)); };
  const removeFileFromGroup = (fileId: string, groupId: string) => { let fileToMoveBack: FilePreview | undefined; setStudentGroups(groups => groups.map(g => { if (g.id === groupId) { fileToMoveBack = g.files.find(f => f.id === fileId); return { ...g, files: g.files.filter(f => f.id !== fileId) }; } return g; })); if (fileToMoveBack) { setUnassignedFiles(prev => [...prev, fileToMoveBack!]); } };
  
  // --- NUEVA Lógica para Décimas ---
  const handleDecimasChange = (groupId: string, value: string) => {
    const decimas = parseFloat(value) || 0;
    setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, decimasAdicionales: decimas } : g));
  };
  
  // --- Lógica de Evaluación (MODIFICADA) ---
  const onEvaluateAll = async () => {
    const { rubrica, flexibilidad } = form.getValues();
    if (!rubrica) { form.setError("rubrica", { type: "manual", message: "La rúbrica es requerida." }); return; }
    
    setStudentGroups(groups => groups.map(g => g.files.length > 0 ? { ...g, isEvaluating: true, isEvaluated: false, error: undefined } : g));
    
    for (const group of studentGroups) {
      if (group.files.length === 0) continue;
      const fileUrls = group.files.map(f => f.dataUrl);
      
      // Pasamos la flexibilidad a la API
      const result = await evaluate(fileUrls, rubrica, flexibilidad[0]);

      setStudentGroups(groups => groups.map(g => {
        if (g.id === group.id) {
          return { ...g, isEvaluating: false, isEvaluated: true, ...result };
        }
        return g;
      }));
    }
  };
  
  // --- Lógica de Informes (sin cambios) ---
  const generateReport = (group: StudentGroup) => { const finalNota = (group.nota || 0) + group.decimasAdicionales; const printWindow = window.open("", "_blank"); if (!printWindow) return alert("Habilita las ventanas emergentes."); const reportHTML = `<html><head><title>Informe - ${group.studentName}</title><script src="https://cdn.tailwindcss.com"></script></head><body class="p-8 bg-gray-50"><div class="max-w-4xl mx-auto bg-white p-10 rounded-lg shadow-lg"><h1 class="text-3xl font-bold mb-2">Informe de Evaluación</h1><h2 class="text-xl text-gray-600 mb-8 border-b pb-4">Alumno: ${group.studentName}</h2><div class="space-y-6"><div><h3 class="font-semibold text-lg">Nota Final (con décimas)</h3><p class="text-4xl font-bold text-blue-600 mt-1">${finalNota.toFixed(1)}</p></div><hr/><div><h3 class="font-semibold text-lg">Puntaje</h3><p>${group.puntaje || 'N/A'}</p></div><hr/><div><h3 class="font-semibold text-lg">Retroalimentación IA</h3><p class="bg-blue-50 p-4 rounded-md mt-1 whitespace-pre-wrap">${group.retroalimentacion || 'N/A'}</p></div></div></div></body></html>`; printWindow.document.write(reportHTML); printWindow.document.close(); printWindow.print(); };

  return (
    <>
      {isCameraOpen && <SmartCameraModal onCapture={handleCapture} />}
      <main className="p-4 md:p-8 max-w-6xl mx-auto font-sans space-y-8">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="text-blue-500" />Paso 1: Configuración</CardTitle></CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onEvaluateAll)} className="space-y-8">
                <div> {/* Sección de Modo de Evaluación */}
                  <label className="font-bold text-sm">¿Para cuántos es la evaluación?</label>
                  <RadioGroup value={evaluationMode} onValueChange={(v) => setEvaluationMode(v as 'single' | 'multiple')} className="flex gap-4 mt-2">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="single" id="r1" /><label htmlFor="r1" className="text-sm">Un Alumno</label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="multiple" id="r2" /><label htmlFor="r2" className="text-sm">Varios Alumnos</label></div>
                  </RadioGroup>
                  {evaluationMode === 'multiple' && (
                      <div className="mt-4 max-w-xs"><label htmlFor="num-students" className="text-sm font-medium">Número de alumnos:</label><Input id="num-students" type="number" min="1" value={numStudents} onChange={e => setNumStudents(Math.max(1, parseInt(e.target.value) || 1))} className="mt-1" /></div>
                  )}
                </div>
                
                <FormField control={form.control} name="rubrica" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Rúbrica de Evaluación</FormLabel><FormControl><Textarea placeholder="Ej: Evalúa claridad, estructura, etc. Responde en JSON..." className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                
                {/* NUEVO: Slider de Flexibilidad */}
                <FormField control={form.control} name="flexibilidad" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="font-bold">Nivel de Flexibilidad de la IA</FormLabel>
                        <FormControl><Slider min={1} max={5} step={1} defaultValue={field.value} onValueChange={field.onChange} /></FormControl>
                        <div className="flex justify-between text-xs text-muted-foreground"><span>Rigor Estricto</span><span>Máxima Flexibilidad</span></div>
                    </FormItem>
                )}/>
                
                <div>
                  <h3 className="font-bold">Cargar Trabajos</h3>
                  <div className="flex flex-wrap gap-4 mt-2">
                      <Button type="button" onClick={() => fileInputRef.current?.click()}><FileUp className="mr-2 h-4 w-4" /> Subir Archivos</Button>
                      <Button type="button" variant="secondary" onClick={() => setIsCameraOpen(true)}><Camera className="mr-2 h-4 w-4" /> Usar Cámara</Button>
                      <input type="file" multiple ref={fileInputRef} onChange={(e) => handleFilesSelected(e.target.files)} className="hidden"/>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="text-green-500" />Paso 2: Agrupación y Evaluación</CardTitle></CardHeader>
            <CardContent> {/* ... (sin cambios en la agrupación) ... */} </CardContent>
            <CardFooter><Button size="lg" onClick={onEvaluateAll} disabled={isEvaluationLoading || studentGroups.every(g => g.files.length === 0)}>{isEvaluationLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Evaluando...</> : <><Sparkles className="mr-2 h-4 w-4" /> Evaluar Todo</>}</Button></CardFooter>
        </Card>
        
        {studentGroups.some(g => g.isEvaluated || g.isEvaluating) && (<Card>
            <CardHeader><CardTitle>Paso 3: Resultados</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {studentGroups.filter(g => g.isEvaluated || g.isEvaluating).map(group => {
                const finalNota = (group.nota || 0) + group.decimasAdicionales;
                return (
                  <div key={group.id} className={`p-4 rounded-lg border-l-4 ${group.error ? 'border-red-500' : 'border-green-500'}`}>
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <h3 className="font-bold text-xl">{group.studentName}</h3>
                      {group.isEvaluating && <Loader2 className="animate-spin text-blue-500"/>}
                      {group.isEvaluated && !group.error && <Button variant="ghost" size="sm" onClick={() => generateReport(group)}><Printer className="mr-2 h-4 w-4"/>Imprimir</Button>}
                    </div>
                    {group.error ? <p className="text-red-600">Error: {group.error}</p> : <div className="mt-2 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2">
                            <p><strong>Retroalimentación:</strong> {group.retroalimentacion}</p>
                            <p className="mt-2"><strong>Puntaje:</strong> {group.puntaje}</p>
                          </div>
                          <div className="space-y-2">
                            <div>
                                <label className="text-sm font-medium">Nota IA:</label>
                                <p className="text-2xl font-bold text-blue-600">{group.nota?.toFixed(1)}</p>
                            </div>
                            {/* NUEVO: Campo para Décimas */}
                            <div>
                                <label htmlFor={`decimas-${group.id}`} className="text-sm font-medium">Décimas (+/-):</label>
                                <Input id={`decimas-${group.id}`} type="number" step="0.1" defaultValue={group.decimasAdicionales} onChange={e => handleDecimasChange(group.id, e.target.value)} className="h-8"/>
                            </div>
                            <div className="pt-2 border-t">
                                <label className="text-sm font-bold">NOTA FINAL:</label>
                                <p className="text-3xl font-bold text-green-600">{finalNota.toFixed(1)}</p>
                            </div>
                          </div>
                        </div>
                    </div>}
                  </div>
                )})}
            </CardContent>
          </Card>)}
      </main>
    </>
  )
}