'use client'

import { useState, useRef, ChangeEvent, useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import dynamic from 'next/dynamic'
import * as React from "react"
import { format } from "date-fns"

// --- Componentes de UI ---
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Sparkles, FileUp, Camera, Users, FileText, X, Printer, CalendarIcon, ImageUp, ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEvaluator } from "./useEvaluator"
import { NotesDashboard } from "../components/NotesDashboard"
const SmartCameraModal = dynamic(() => import('../components/smart-camera-modal'), { ssr: false, loading: () => <p>Cargando...</p> })
const Label = React.forwardRef<HTMLLabelElement, React.ComponentPropsWithoutRef<'label'>>(({ className, ...props }, ref) => ( <label ref={ref} className={cn("text-sm font-medium", className)} {...props} /> ));
Label.displayName = "Label"

// --- Tipos para la respuesta de la IA ---
interface CorreccionDetallada { seccion: string; detalle: string; }
interface EvaluacionHabilidad { habilidad: string; evaluacion: string; evidencia: string; }
interface RetroalimentacionEstructurada {
  correccion_detallada: CorreccionDetallada[];
  evaluacion_habilidades: EvaluacionHabilidad[];
  resumen_general: { fortalezas: string; areas_mejora: string; };
}
const formSchema = z.object({ tipoEvaluacion: z.string().default('prueba'), rubrica: z.string().min(10, "La rúbrica es necesaria."), pauta: z.string().optional(), flexibilidad: z.array(z.number()).default([3]), nombreProfesor: z.string().optional(), departamento: z.string().optional(), curso: z.string().optional(), fechaEvaluacion: z.date().optional(), });
interface FilePreview { id: string; file: File; previewUrl: string; dataUrl: string; }
interface StudentGroup { id: string; studentName: string; files: FilePreview[]; retroalimentacion?: RetroalimentacionEstructurada; puntaje?: string; nota?: number | string; decimasAdicionales: number; isEvaluated: boolean; isEvaluating: boolean; error?: string; }

// --- COMPONENTE PRINCIPAL ---
export default function EvaluatorClient() {
  const [evaluationMode, setEvaluationMode] = useState<'single' | 'multiple'>('single');
  const [numStudents, setNumStudents] = useState(1);
  const [unassignedFiles, setUnassignedFiles] = useState<FilePreview[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<z.infer<typeof formSchema>>({ resolver: zodResolver(formSchema), defaultValues: { tipoEvaluacion: 'prueba', rubrica: "", pauta: "", flexibilidad: [3], nombreProfesor: "", departamento: "", curso: "", fechaEvaluacion: new Date() }, });
  const { evaluate, isLoading: isEvaluationLoading } = useEvaluator();
  useEffect(() => { const count = evaluationMode === 'single' ? 1 : numStudents; const newGroups: StudentGroup[] = Array.from({ length: count }, (_, i) => ({ id: `student-${Date.now()}-${i}`, studentName: count > 1 ? `Alumno ${i + 1}` : 'Alumno', files: [], isEvaluated: false, isEvaluating: false, decimasAdicionales: 0, })); setStudentGroups(newGroups); setUnassignedFiles([]); }, [evaluationMode, numStudents]);
  const processFiles = (files: File[]) => { files.forEach(file => { const reader = new FileReader(); reader.onload = (e) => { const dataUrl = e.target?.result as string; const previewUrl = URL.createObjectURL(file); const newFilePreview: FilePreview = { id: `${file.name}-${Date.now()}`, file, previewUrl, dataUrl }; setUnassignedFiles(prev => [...prev, newFilePreview]); }; reader.readAsDataURL(file); }); };
  const handleFilesSelected = (files: FileList | null) => { if (files) processFiles(Array.from(files)); };
  const handleCapture = (dataUrl: string) => { fetch(dataUrl).then(res => res.blob()).then(blob => { const file = new File([blob], `captura-${Date.now()}.png`, { type: 'image/png' }); processFiles([file]); }); setIsCameraOpen(false); };
  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setLogoPreview(reader.result as string); }; reader.readAsDataURL(file); } };
  const updateStudentName = (groupId: string, newName: string) => { setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, studentName: newName } : g)); };
  const assignFileToGroup = (fileId: string, groupId: string) => { const fileToMove = unassignedFiles.find(f => f.id === fileId); if (!fileToMove) return; setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, files: [...g.files, fileToMove] } : g)); setUnassignedFiles(files => files.filter(f => f.id !== fileId)); };
  const removeFileFromGroup = (fileId: string, groupId: string) => { let fileToMoveBack: FilePreview | undefined; setStudentGroups(groups => groups.map(g => { if (g.id === groupId) { fileToMoveBack = g.files.find(f => f.id === fileId); return { ...g, files: g.files.filter(f => f.id !== fileId) }; } return g; })); if (fileToMoveBack) { setUnassignedFiles(prev => [...prev, fileToMoveBack!]); } };
  const handleDecimasChange = (groupId: string, value: string) => { const decimas = parseFloat(value) || 0; setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, decimasAdicionales: decimas } : g)); };
  const onEvaluateAll = async () => { const { rubrica, pauta, flexibilidad, tipoEvaluacion } = form.getValues(); if (!rubrica) { form.setError("rubrica", { type: "manual", message: "La rúbrica es requerida." }); return; } setStudentGroups(groups => groups.map(g => g.files.length > 0 ? { ...g, isEvaluating: true, isEvaluated: false, error: undefined } : g)); for (const group of studentGroups) { if (group.files.length === 0) continue; const fileUrls = group.files.map(f => f.dataUrl); const result = await evaluate(fileUrls, rubrica, pauta, flexibilidad[0], tipoEvaluacion); setStudentGroups(groups => groups.map(g => g.id === group.id ? { ...g, isEvaluating: false, isEvaluated: true, ...result } : g)); } };
  const generateReport = (group: StudentGroup) => { const { nombreProfesor, departamento, fechaEvaluacion, curso } = form.getValues(); const finalNota = (Number(group.nota) || 0) + group.decimasAdicionales; const reportWindow = window.open("", "_blank"); if (!reportWindow) return alert("Habilita las ventanas emergentes."); const reportHTML = `<html><head><title>Informe - ${group.studentName}</title><script src="https://cdn.tailwindcss.com"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script></head><body class="bg-gray-100 font-sans"><div class="p-4 sm:p-8"><div class="max-w-4xl mx-auto"><div id="report-actions" class="bg-white p-4 sm:p-6 rounded-lg shadow-sm mb-4 flex justify-end gap-2 print:hidden"><button onclick="window.print()" class="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg text-sm">Imprimir</button><button onclick="exportPDF()" class="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg text-sm">Exportar a PDF</button></div><div id="report-content" class="bg-white p-10 rounded-lg shadow-lg"><header class="flex justify-between items-start border-b pb-6 mb-8"><div><h1 class="text-3xl font-bold text-gray-800">Informe de Evaluación</h1>${departamento ? `<p class="text-gray-500">${departamento}</p>` : ''}</div>${logoPreview ? `<img src="${logoPreview}" alt="Logo" class="h-16 max-w-xs object-contain"/>` : ''}</header><div class="grid grid-cols-3 gap-6 mb-8"><div><p class="text-sm text-gray-500">Alumno</p><p class="font-semibold">${group.studentName}</p></div><div><p class="text-sm text-gray-500">Curso</p><p class="font-semibold">${curso || 'N/A'}</p></div><div><p class="text-sm text-gray-500">Fecha</p><p class="font-semibold">${fechaEvaluacion ? format(fechaEvaluacion, "dd/MM/yyyy") : 'N/A'}</p></div></div><div class="space-y-6"><div><h3 class="font-semibold text-lg">Nota Final (con décimas)</h3><p class="text-4xl font-bold text-blue-600 mt-1">${finalNota.toFixed(1)}</p></div><hr/><div><h3 class="font-semibold text-lg">Puntaje</h3><p>${group.puntaje || 'N/A'}</p></div><hr/><div><h3 class="font-semibold text-lg">Retroalimentación IA</h3><p class="bg-blue-50 p-4 rounded-md mt-1 whitespace-pre-wrap">${group.retroalimentacion?.resumen_general?.fortalezas || 'No disponible.'}</p></div></div></div></div></div><script>function exportPDF() { const { jsPDF } = window.jspdf; const content = document.getElementById('report-content'); const buttons = document.getElementById('report-actions'); if (buttons) buttons.style.display = 'none'; html2canvas(content, { scale: 2 }).then(canvas => { if (buttons) buttons.style.display = 'flex'; const imgData = canvas.toDataURL('image/png'); const pdf = new jsPDF('p', 'mm', 'a4'); const pdfWidth = pdf.internal.pageSize.getWidth(); const pdfHeight = (canvas.height * pdfWidth) / canvas.width; const pdfFileName = 'informe-' + "${group.studentName}".replace(/ /g, '_') + '.pdf'; pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight); pdf.save(pdfFileName); }); } const style = document.createElement('style'); style.innerHTML = '@media print { #report-actions { display: none; } }'; document.head.appendChild(style);</script></body></html>`; reportWindow.document.write(reportHTML); reportWindow.document.close(); };

    return (
        <>
            {isCameraOpen && <SmartCameraModal onCapture={handleCapture} />}
            <main className="p-4 md:p-8 max-w-6xl mx-auto font-sans">
                <Tabs defaultValue="evaluator" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="evaluator"><Sparkles className="mr-2 h-4 w-4" />Evaluador</TabsTrigger>
                        <TabsTrigger value="dashboard"><ClipboardList className="mr-2 h-4 w-4" />Resumen de Notas</TabsTrigger>
                    </TabsList>
                    <TabsContent value="evaluator" className="space-y-8 mt-4">
                        <Card>
                            <CardHeader><CardTitle>Paso 1: Configuración</CardTitle></CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onEvaluateAll)} className="space-y-8">
                                        <div className="p-4 border rounded-lg">
                                            <h3 className="text-lg font-semibold mb-4">Personalización del Informe</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <FormField control={form.control} name="nombreProfesor" render={({ field }) => (<FormItem><FormLabel>Nombre del Profesor</FormLabel><FormControl><Input placeholder="Ej: Juan Pérez" {...field} /></FormControl></FormItem>)} />
                                                <FormField control={form.control} name="departamento" render={({ field }) => (<FormItem><FormLabel>Departamento</FormLabel><FormControl><Input placeholder="Ej: Ciencias" {...field} /></FormControl></FormItem>)} />
                                                <FormField control={form.control} name="curso" render={({ field }) => (<FormItem><FormLabel>Curso</FormLabel><FormControl><Input placeholder="Ej: 8° Básico" {...field} /></FormControl></FormItem>)} />
                                                <FormField control={form.control} name="fechaEvaluacion" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Fecha</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                                                <div className="space-y-2 col-span-full"><Label>Logo (Opcional)</Label><div className="flex items-center gap-4"><Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}><ImageUp className="mr-2 h-4 w-4" />Subir Logo</Button><input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoChange} className="hidden" />{logoPreview && <img src={logoPreview} alt="Vista previa del logo" className="h-12 w-auto object-contain border p-1 rounded-md" />}</div></div>
                                            </div>
                                        </div>
                                        <FormField control={form.control} name="tipoEvaluacion" render={({ field }) => (<FormItem><FormLabel className="font-bold">Tipo de Evaluación</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona un tipo..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="prueba">Prueba con Pauta</SelectItem><SelectItem value="ensayo">Texto Abierto / Ensayo</SelectItem><SelectItem value="arte">Obra Visual / Creativa</SelectItem></SelectContent></Select></FormItem>)} />
                                        <FormField control={form.control} name="rubrica" render={({ field }) => (<FormItem><FormLabel className="font-bold">Rúbrica de Evaluación (Criterios)</FormLabel><FormControl><Textarea placeholder="Ej: Evalúa claridad, estructura, ortografía..." className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="pauta" render={({ field }) => (<FormItem><FormLabel className="font-bold">Pauta de Corrección (Respuestas)</FormLabel><FormControl><Textarea placeholder="Opcional. Pega aquí las respuestas correctas..." className="min-h-[100px]" {...field} /></FormControl></FormItem>)} />
                                        <FormField control={form.control} name="flexibilidad" render={({ field }) => (<FormItem><FormLabel className="font-bold">Nivel de Flexibilidad de la IA</FormLabel><FormControl><Slider min={1} max={5} step={1} defaultValue={field.value} onValueChange={field.onChange} /></FormControl><div className="flex justify-between text-xs text-muted-foreground"><span>Rigor Estricto</span><span>Máxima Flexibilidad</span></div></FormItem>)} />
                                        <div>
                                            <h3 className="font-bold">Cargar Trabajos</h3>
                                            <div className="flex flex-wrap gap-4 mt-2">
                                                <Button type="button" onClick={() => { fileInputRef.current?.click(); }}><FileUp className="mr-2 h-4 w-4" /> Subir Archivos</Button>
                                                <Button type="button" variant="secondary" onClick={() => setIsCameraOpen(true)}><Camera className="mr-2 h-4 w-4" /> Usar Cámara</Button>
                                                <input type="file" multiple ref={fileInputRef} onChange={(e) => handleFilesSelected(e.target.files)} className="hidden" />
                                            </div>
                                        </div>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                        {unassignedFiles.length > 0 && (<Card><CardHeader><CardTitle>Archivos Pendientes de Asignar</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-4">{unassignedFiles.map(file => (<div key={file.id} className="w-24 h-24"><img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-cover rounded-md" /></div>))}</CardContent></Card>)}
                        {studentGroups.length > 0 && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="text-green-500" />Paso 2: Agrupación y Evaluación</CardTitle></CardHeader><CardContent className="space-y-4">{studentGroups.map(group => (<div key={group.id} className="border p-4 rounded-lg"><Input className="text-lg font-bold border-0 shadow-none focus-visible:ring-0 p-1 mb-2" value={group.studentName} onChange={(e) => updateStudentName(group.id, e.target.value)} /><div className="flex flex-wrap gap-2 min-h-[50px] bg-muted/50 p-2 rounded-md">{group.files.map(file => (<div key={file.id} className="relative w-20 h-20"><img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-cover rounded-md" /><button onClick={() => removeFileFromGroup(file.id, group.id)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0-5"><X className="h-3 w-3" /></button></div>))}{unassignedFiles.length > 0 && (<div className="flex items-center justify-center w-20 h-20 border-2 border-dashed rounded-md"><select onChange={(e) => { if (e.target.value) assignFileToGroup(e.target.value, group.id); e.target.value = ""; }} className="text-sm bg-transparent"><option value="">Asignar</option>{unassignedFiles.map(f => <option key={f.id} value={f.id}>{f.file.name}</option>)}</select></div>)}</div></div>))}</CardContent><CardFooter><Button size="lg" onClick={onEvaluateAll} disabled={isEvaluationLoading || studentGroups.every(g => g.files.length === 0)}>{isEvaluationLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Evaluando...</> : <><Sparkles className="mr-2 h-4 w-4" /> Evaluar Todo</>}</Button></CardFooter></Card>}
                        {studentGroups.some(g => g.isEvaluated || g.isEvaluating) && (<Card><CardHeader><CardTitle>Paso 3: Resultados</CardTitle></CardHeader><CardContent className="space-y-4">{studentGroups.filter(g => g.isEvaluated || g.isEvaluating).map(group => { const finalNota = (Number(group.nota) || 0) + group.decimasAdicionales; return (<div key={group.id} className={`p-6 rounded-lg border-l-4 ${group.error ? 'border-red-500' : 'border-green-500'} bg-white shadow`}><div className="flex justify-between items-center flex-wrap gap-2"><h3 className="font-bold text-xl">{group.studentName}</h3>{group.isEvaluating && <Loader2 className="animate-spin text-blue-500" />}{group.isEvaluated && !group.error && <Button variant="ghost" size="sm" onClick={() => generateReport(group)}><Printer className="mr-2 h-4 w-4" />Ver Informe</Button>}</div>{group.error ? <p className="text-red-600">Error: {group.error}</p> : <div className="mt-4 space-y-6"><div className="flex justify-between items-start bg-gray-50 p-4 rounded-lg"><div><p className="text-sm font-bold">PUNTAJE OBTENIDO</p><p className="text-xl font-semibold">{group.puntaje || 'Calculando...'}</p></div><div className="text-right"><div className="flex items-center gap-2"><label htmlFor={`decimas-${group.id}`} className="text-sm font-medium">Décimas:</label><Input id={`decimas-${group.id}`} type="number" step="0.1" defaultValue={group.decimasAdicionales} onChange={e => handleDecimasChange(group.id, e.target.value)} className="h-8 w-20" /></div><p className="text-sm font-bold mt-2">NOTA FINAL</p><p className="text-3xl font-bold text-blue-600">{finalNota.toFixed(1)}</p></div></div>{group.retroalimentacion && <><div><h4 className="font-bold mb-2 text-gray-800">Corrección Detallada</h4><Table><TableHeader><TableRow><TableHead>Sección</TableHead><TableHead>Detalle</TableHead></TableRow></TableHeader><TableBody>{group.retroalimentacion.correccion_detallada?.map((item, index) => (<TableRow key={index}><TableCell className="font-medium">{item.seccion}</TableCell><TableCell>{item.detalle}</TableCell></TableRow>))}</TableBody></Table></div><div><h4 className="font-bold mb-2 text-gray-800">Evaluación de Habilidades</h4><Table><TableHeader><TableRow><TableHead>Habilidad</TableHead><TableHead>Nivel</TableHead><TableHead>Evidencia Citada</TableHead></TableRow></TableHeader><TableBody>{group.retroalimentacion.evaluacion_habilidades?.map((item, index) => (<TableRow key={index}><TableCell className="font-medium">{item.habilidad}</TableCell><TableCell>{item.evaluacion}</TableCell><TableCell className="italic">"{item.evidencia}"</TableCell></TableRow>))}</TableBody></Table></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="prose prose-sm max-w-none"><h4>✅ Fortalezas Principales</h4><p>{group.retroalimentacion.resumen_general?.fortalezas}</p></div><div className="prose prose-sm max-w-none"><h4>✏️ Oportunidades de Mejora</h4><p>{group.retroalimentacion.resumen_general?.areas_mejora}</p></div></div></>}</div>}</div>)})}
                        </CardContent></Card>)}
                    </TabsContent>
                    <TabsContent value="dashboard" className="mt-4">
                        <NotesDashboard studentGroups={studentGroups} curso={form.getValues("curso")} fecha={form.getValues("fechaEvaluacion")} />
                    </TabsContent>
                </Tabs>
            </main>
        </>
    )
}