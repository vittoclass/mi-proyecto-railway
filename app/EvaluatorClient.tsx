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
import { Loader2, Sparkles, FileUp, Camera, Users, FileText, X, Printer } from "lucide-react"

// --- Hook de Evaluación ---
import { useEvaluator } from "./useEvaluator"

// --- Importación Dinámica para la Cámara ---
const SmartCameraModal = dynamic(() => import('../components/smart-camera-modal'), { 
    ssr: false,
    loading: () => <div className="flex items-center gap-2"><Loader2 className="animate-spin h-4 w-4" />Cargando cámara...</div> 
})

// --- Esquema y Tipos ---
const formSchema = z.object({
  rubrica: z.string().min(10, "La rúbrica es necesaria."),
});

interface FilePreview {
  id: string;
  file: File;
  previewUrl: string; // Para mostrar en la UI
  dataUrl: string;    // Para enviar a la IA
}
interface StudentGroup {
  id: string; studentName: string; files: FilePreview[];
  retroalimentacion?: string; puntaje?: string; nota?: number;
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
    resolver: zodResolver(formSchema), defaultValues: { rubrica: "" },
  });
  const { evaluate, isLoading: isEvaluationLoading } = useEvaluator();

  // --- Efecto para crear grupos de estudiantes ---
  useEffect(() => {
    const count = evaluationMode === 'single' ? 1 : numStudents;
    const newGroups: StudentGroup[] = Array.from({ length: count }, (_, i) => ({
        id: `student-${Date.now()}-${i}`,
        studentName: count > 1 ? `Alumno ${i + 1}` : 'Alumno',
        files: [], isEvaluated: false, isEvaluating: false,
    }));
    setStudentGroups(newGroups);
    setUnassignedFiles([]);
  }, [evaluationMode, numStudents]);

  // --- LÓGICA DE MANEJO DE ARCHIVOS (MODIFICADA) ---
  const processFiles = (files: File[]) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const previewUrl = URL.createObjectURL(file);
        
        const newFilePreview: FilePreview = {
          id: `${file.name}-${file.lastModified}-${Math.random()}`,
          file,
          previewUrl,
          dataUrl,
        };
        setUnassignedFiles(prev => [...prev, newFilePreview]);
      };
      reader.readAsDataURL(file); // Convierte el archivo a Base64
    });
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    processFiles(Array.from(files));
  };
  
  const handleCapture = (dataUrl: string) => {
    fetch(dataUrl).then(res => res.blob()).then(blob => {
      const file = new File([blob], `captura-${Date.now()}.png`, { type: 'image/png' });
      processFiles([file]); // Usa la nueva función de procesamiento
    });
    setIsCameraOpen(false);
  };
  
  // --- Lógica de Agrupación (sin cambios) ---
  const updateStudentName = (groupId: string, newName: string) => {
    setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, studentName: newName } : g));
  };
  const assignFileToGroup = (fileId: string, groupId: string) => {
    const fileToMove = unassignedFiles.find(f => f.id === fileId);
    if (!fileToMove) return;
    setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, files: [...g.files, fileToMove] } : g));
    setUnassignedFiles(files => files.filter(f => f.id !== fileId));
  };
  const removeFileFromGroup = (fileId: string, groupId: string) => {
    let fileToMoveBack: FilePreview | undefined;
    setStudentGroups(groups => groups.map(g => {
      if (g.id === groupId) {
        fileToMoveBack = g.files.find(f => f.id === fileId);
        return { ...g, files: g.files.filter(f => f.id !== fileId) };
      }
      return g;
    }));
    if (fileToMoveBack) {
      setUnassignedFiles(prev => [...prev, fileToMoveBack!]);
    }
  };

  // --- LÓGICA DE EVALUACIÓN (MODIFICADA) ---
  const onEvaluateAll = async () => {
    const rubrica = form.getValues("rubrica");
    if (!rubrica) {
      form.setError("rubrica", { type: "manual", message: "La rúbrica no puede estar vacía." });
      return;
    }
    setStudentGroups(groups => groups.map(g => g.files.length > 0 ? { ...g, isEvaluating: true, isEvaluated: false, error: undefined } : g));

    for (const group of studentGroups) {
      if (group.files.length === 0) continue;
      
      // Usa dataUrl en lugar de previewUrl para enviar a la API
      const fileUrls = group.files.map(f => f.dataUrl);
      if (fileUrls.length === 0) continue;

      const result = await evaluate(fileUrls, rubrica);

      setStudentGroups(groups => groups.map(g => {
        if (g.id === group.id) {
          return { ...g, isEvaluating: false, isEvaluated: true, ...result };
        }
        return g;
      }));
    }
  };
  
  // --- Lógica de Informes (sin cambios) ---
  const generateReport = (group: StudentGroup) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return alert("Por favor, permite las ventanas emergentes.");
    const reportHTML = `
      <html>
        <head><title>Informe - ${group.studentName}</title><script src="https://cdn.tailwindcss.com"></script></head>
        <body class="p-8 bg-gray-50"><div class="max-w-4xl mx-auto bg-white p-10 rounded-lg shadow-lg">
            <h1 class="text-3xl font-bold mb-2">Informe de Evaluación</h1>
            <h2 class="text-xl text-gray-600 mb-8 border-b pb-4">Alumno: ${group.studentName}</h2>
            <div class="space-y-6">
              <div><h3 class="font-semibold text-lg">Nota Final</h3><p class="text-4xl font-bold text-blue-600 mt-1">${group.nota || 'N/A'}</p></div><hr/>
              <div><h3 class="font-semibold text-lg">Puntaje</h3><p>${group.puntaje || 'N/A'}</p></div><hr/>
              <div><h3 class="font-semibold text-lg">Retroalimentación IA</h3><p class="bg-blue-50 p-4 rounded-md mt-1 whitespace-pre-wrap">${group.retroalimentacion || 'N/A'}</p></div>
            </div>
        </div></body></html>`;
    printWindow.document.write(reportHTML);
    printWindow.document.close();
    printWindow.print();
  };

  // --- Renderizado del Componente (JSX) ---
  return (
    <>
      {isCameraOpen && <SmartCameraModal onCapture={handleCapture} />}
      <main className="p-4 md:p-8 max-w-6xl mx-auto font-sans space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="text-blue-500" />Paso 1: Configuración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
                <label className="font-bold text-sm">¿Para cuántos es la evaluación?</label>
                <RadioGroup value={evaluationMode} onValueChange={(v) => setEvaluationMode(v as 'single' | 'multiple')} className="flex gap-4 mt-2">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="single" id="r1" /><label htmlFor="r1" className="text-sm">Un Alumno</label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="multiple" id="r2" /><label htmlFor="r2" className="text-sm">Varios Alumnos</label></div>
                </RadioGroup>
                {evaluationMode === 'multiple' && (
                    <div className="mt-4 max-w-xs">
                        <label htmlFor="num-students" className="text-sm font-medium">Número de alumnos:</label>
                        <Input id="num-students" type="number" min="1" value={numStudents} onChange={e => setNumStudents(Math.max(1, parseInt(e.target.value) || 1))} className="mt-1" />
                    </div>
                )}
            </div>
            <Separator />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onEvaluateAll)} className="space-y-6">
                    <FormField control={form.control} name="rubrica" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Rúbrica de Evaluación</FormLabel>
                          <FormControl><Textarea placeholder="Ej: Evalúa claridad y estructura. Responde en JSON con 'retroalimentacion', 'puntaje' y 'nota'." className="min-h-[120px]" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                    )}/>
                </form>
            </Form>
            <Separator />
            <div>
              <h3 className="font-bold">Cargar Trabajos</h3>
              <div className="flex flex-wrap gap-4 mt-2">
                  <Button type="button" onClick={() => fileInputRef.current?.click()}><FileUp className="mr-2 h-4 w-4" /> Subir Archivos</Button>
                  <Button type="button" variant="secondary" onClick={() => setIsCameraOpen(true)}><Camera className="mr-2 h-4 w-4" /> Usar Cámara</Button>
                  <input type="file" multiple ref={fileInputRef} onChange={(e) => handleFilesSelected(e.target.files)} className="hidden"/>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="text-green-500" />Paso 2: Agrupación y Evaluación</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {unassignedFiles.length > 0 && (<div>
                  <h3 className="font-bold mb-2">Archivos Pendientes de Asignar</h3>
                  <div className="flex flex-wrap gap-4 p-4 border rounded-lg bg-gray-50">
                    {unassignedFiles.map(file => (<div key={file.id} className="w-24 h-24"><img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-cover rounded-md" /></div>))}
                  </div>
              </div>)}
              <div className="space-y-4">
                {studentGroups.map(group => (<div key={group.id} className="border p-4 rounded-lg">
                    <Input className="text-lg font-bold border-0 shadow-none focus-visible:ring-0 p-1 mb-2" value={group.studentName} onChange={(e) => updateStudentName(group.id, e.target.value)}/>
                    <div className="flex flex-wrap gap-2 min-h-[50px] bg-muted/50 p-2 rounded-md">
                      {group.files.map(file => (<div key={file.id} className="relative w-20 h-20"><img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-cover rounded-md" /><button onClick={() => removeFileFromGroup(file.id, group.id)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X className="h-3 w-3"/></button></div>))}
                      {unassignedFiles.length > 0 && (<div className="flex items-center justify-center w-20 h-20 border-2 border-dashed rounded-md">
                           <select onChange={(e) => { if(e.target.value) assignFileToGroup(e.target.value, group.id); e.target.value = ""; }} className="text-sm bg-transparent">
                              <option value="">Asignar</option>
                              {unassignedFiles.map(f => <option key={f.id} value={f.id}>{f.file.name}</option>)}
                           </select>
                      </div>)}
                    </div>
                </div>))}
              </div>
            </CardContent>
            <CardFooter>
              <Button size="lg" onClick={onEvaluateAll} disabled={isEvaluationLoading || studentGroups.every(g => g.files.length === 0)}>
                {isEvaluationLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Evaluando...</> : <><Sparkles className="mr-2 h-4 w-4" /> Evaluar Todo</>}
              </Button>
            </CardFooter>
        </Card>
        
        {studentGroups.some(g => g.isEvaluated || g.isEvaluating) && (<Card>
            <CardHeader><CardTitle>Paso 3: Resultados de la Evaluación</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {studentGroups.filter(g => g.isEvaluated || g.isEvaluating).map(group => (<div key={group.id} className={`p-4 rounded-lg border-l-4 ${group.error ? 'border-red-500' : 'border-green-500'}`}>
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-xl">{group.studentName}</h3>
                    {group.isEvaluating && <Loader2 className="animate-spin text-blue-500"/>}
                    {group.isEvaluated && !group.error && <Button variant="ghost" size="sm" onClick={() => generateReport(group)}><Printer className="mr-2 h-4 w-4"/>Imprimir Informe</Button>}
                  </div>
                  {group.error ? <p className="text-red-600">Error: {group.error}</p> : <div className="mt-2 space-y-2">
                      <p><strong>Nota:</strong> <span className="text-xl font-bold text-blue-600">{group.nota}</span></p>
                      <p><strong>Puntaje:</strong> {group.puntaje}</p>
                      <p><strong>Retroalimentación:</strong> {group.retroalimentacion}</p>
                  </div>}
                </div>))}
            </CardContent>
          </Card>)}
      </main>
    </>
  )
}