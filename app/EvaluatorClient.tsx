+// EvaluatorClient.tsx
'use client';

import * as React from 'react';
import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// UI (shadcn)
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Sparkles, FileUp, Camera, Users, X, Printer, CalendarIcon, ImageUp, ClipboardList, Home, Palette } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';

// Componentes propios
import EvaluacionPDF from '@/components/EvaluacionPDF';
import SmartCameraModal from '@/components/smart-camera-modal';
import LibelIADrawings from '@/components/Libel-IA'; // Asumiendo este es tu componente de IA de dibujo

// Utilidades
import { cn } from '@/lib/utils';
import { saveAs } from 'file-saver'; // Para el PDF
import { useAuth } from '@/context/AuthContext'; // Asumiendo que usas un contexto de autenticación

// --- CONSTANTES ---
// Reemplaza con tus datos reales si los tienes en este archivo, sino, asumo estas constantes
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
// Usamos un placeholder, asegúrate de que tu ruta/variable sea correcta
const DRAGONFLY_DATA_URL = "/path/to/your/logo.png"; 

// --- ESQUEMA DE VALIDACIÓN (ZOD) ---
const formSchema = z.object({
  pauta: z.string().min(10, { message: 'La pauta es requerida (mínimo 10 caracteres).' }),
  rubrica: z.string().optional(),
  puntajeTotal: z.number().min(1, { message: 'El puntaje total debe ser al menos 1.' }),
  flexibilidad: z.number().min(0).max(10).default(5),
  nombreEstudiante: z.string().optional(),
  curso: z.string().optional(),
  asignatura: z.string().optional(),
  evaluacion: z.string().optional(),
  fecha: z.date().optional(),
  itemsEsperados: z.string().optional(),
  pautaCorrectaAlternativas: z.string().optional(),
});

type EvaluationFormValues = z.infer<typeof formSchema>;

// --- COMPONENTE PRINCIPAL ---

export default function EvaluatorClient() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('inicio');
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [wordmarkClass, setWordmarkClass] = useState('text-white'); // Para el color del logo

  const form = useForm<EvaluationFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pauta: '',
      rubrica: '',
      puntajeTotal: 50,
      flexibilidad: 5,
      nombreEstudiante: '',
      curso: '',
      asignatura: '',
      evaluacion: '',
      fecha: new Date(),
      itemsEsperados: '',
      pautaCorrectaAlternativas: '',
    },
  });

  // --- LÓGICA DE MANEJO DE ARCHIVOS ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > MAX_FILE_SIZE) {
        toast({ title: 'Error', description: 'El archivo es demasiado grande (máx. 5MB).', variant: 'destructive' });
        return;
      }
      if (!SUPPORTED_MIME_TYPES.includes(selectedFile.type)) {
        toast({ title: 'Error', description: 'Formato de archivo no soportado (solo JPG, PNG, PDF).', variant: 'destructive' });
        return;
      }
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setEvaluationResult(null); // Resetear resultado al cambiar archivo
      setActiveTab('evaluator'); // Mover a la pestaña de evaluación
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageCapture = (dataUrl: string) => {
    // Convertir Data URL a Blob y luego a File
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const capturedFile = new File([u8arr], `captura_${Date.now()}.jpeg`, { type: mime });

    setFile(capturedFile);
    setPreviewUrl(dataUrl);
    setEvaluationResult(null);
    setIsCameraModalOpen(false);
    setActiveTab('evaluator');
  };

  // --- LÓGICA DE ENVÍO Y COMUNICACIÓN CON EL API ---

  const onSubmit = async (values: EvaluationFormValues) => {
    if (!file) {
      toast({ title: 'Error', description: 'Debe subir un archivo o tomar una foto para evaluar.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setEvaluationResult(null);
    setProgress(10); // Inicio del progreso

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('pauta', values.pauta);
      formData.append('rubrica', values.rubrica || '');
      formData.append('puntajeTotal', values.puntajeTotal.toString());
      formData.append('flexibilidad', values.flexibilidad.toString());
      formData.append('nombreEstudiante', values.nombreEstudiante || '');
      formData.append('curso', values.curso || '');
      formData.append('asignatura', values.asignatura || '');
      formData.append('evaluacion', values.evaluacion || '');
      formData.append('fecha', values.fecha ? values.fecha.toISOString() : new Date().toISOString());
      formData.append('itemsEsperados', values.itemsEsperados || '');
      formData.append('pautaCorrectaAlternativas', values.pautaCorrectaAlternativas || '');

      setProgress(30); // Subida de archivo y preparación

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error desconocido del servidor.');
      }

      setProgress(70); // Procesamiento de IA

      const result = await response.json();

      if (result.success) {
        setEvaluationResult({ ...result, fecha: values.fecha });
        toast({ title: 'Éxito', description: 'La evaluación se ha completado correctamente.' });
        setActiveTab('results');
      } else {
        throw new Error(result.error || 'Error al procesar la evaluación.');
      }

      setProgress(100);
    } catch (error: any) {
      console.error('Error durante la evaluación:', error);
      toast({ title: 'Error en la Evaluación', description: error.message || 'Ocurrió un error inesperado.', variant: 'destructive' });
      setProgress(0);
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 1000); // Ocultar barra de progreso
    }
  };

  // --- LÓGICA DE GENERACIÓN DE PDF ---

  const handleGeneratePdf = async () => {
    if (!evaluationResult) return;

    setIsPdfGenerating(true);
    try {
      // Nota: Asumo que EvaluacionPDF es una función que existe en /components/EvaluacionPDF
      const pdf = await EvaluacionPDF(evaluationResult, form.getValues());
      const pdfBlob = new Blob([pdf.output('blob')], { type: 'application/pdf' });
      saveAs(pdfBlob, `Informe_Evaluacion_${evaluationResult.nombreEstudiante || 'Alumno'}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast({ title: 'PDF Generado', description: 'El informe se ha descargado correctamente.' });
    } catch (error) {
      console.error('Error al generar PDF:', error);
      toast({ title: 'Error al Generar PDF', description: 'No se pudo crear el documento.', variant: 'destructive' });
    } finally {
      setIsPdfGenerating(false);
    }
  };

  // --- RENDERING ---

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        
        {/* Barra de progreso global */}
        {loading && (
          <div className="fixed top-0 left-0 right-0 z-50">
            <Progress value={progress} className="h-1 bg-cyan-500" />
          </div>
        )}

        <Tabs defaultValue="inicio" value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-center mb-8">
            <TabsList className="grid w-full max-w-2xl grid-cols-4 h-14 bg-[var(--bg-card)] border border-[var(--border-color)]">
              <TabsTrigger value="inicio" className="text-base flex items-center gap-2" onClick={() => setEvaluationResult(null)}>
                <Home className="h-4 w-4" /> Inicio
              </TabsTrigger>
              <TabsTrigger value="evaluator" className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Evaluador
              </TabsTrigger>
              <TabsTrigger value="results" disabled={!evaluationResult} className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Resultados
              </TabsTrigger>
              <TabsTrigger value="presentacion" className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" /> Presentación
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Inicio */}
          <TabsContent value="inicio" className="mt-8 text-center">
            <Card className="max-w-3xl mx-auto border-2 shadow-lg bg-[var(--bg-card)] border-[var(--border-color)]" style={{ backgroundImage: 'radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, rgba(9, 9, 11, 0) 70%)' }}>
              <CardContent className="p-12">
                <img src={DRAGONFLY_DATA_URL} alt="Logo" className="mx-auto h-36 w-36 mb-4" />
                <h1 className={`text-6xl font-bold ${wordmarkClass} font-logo`}>Libel-IA</h1>
                {/* 🚨 CORRECCIÓN CRÍTICA: Se usa &quot; en lugar de " para solucionar el error de compilación */}
                <p className="mt-3 text-xl italic text-cyan-300">&quot;Evaluación con Inteligencia Docente: Hecha por un Profe, para Profes&quot;</p>
                <p className="mt-6 text-lg text-[var(--text-secondary)]">Asistente pedagógico inteligente que analiza las respuestas de tus estudiantes, genera retroalimentación detallada y crea informes al instante.</p>
                <Button size="lg" className="mt-8 text-lg py-6 px-8" onClick={() => setActiveTab('evaluator')}>
                  Comenzar a Evaluar <Sparkles className="ml-2 h-5 w-5" />
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Evaluador */}
          <TabsContent value="evaluator" className="space-y-8 mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Primera Columna: Parámetros de la Evaluación */}
                <Card className="p-6 border-2 shadow-xl bg-[var(--bg-card)] border-[var(--border-color)]">
                  <CardHeader className="p-0 mb-6">
                    <CardTitle className="text-3xl border-b pb-2 border-[var(--border-color)] flex items-center gap-2"><ClipboardList className="h-6 w-6 text-cyan-500" /> Parámetros de Evaluación</CardTitle>
                  </CardHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Nombre del Estudiante */}
                    <FormField control={form.control} name="nombreEstudiante" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Estudiante (Opcional)</FormLabel>
                        <FormControl><Input placeholder="Ej: Juan Pérez" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* Curso */}
                    <FormField control={form.control} name="curso" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Curso (Opcional)</FormLabel>
                        <FormControl><Input placeholder="Ej: 8° Básico C" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* Asignatura */}
                    <FormField control={form.control} name="asignatura" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asignatura (Opcional)</FormLabel>
                        <FormControl><Input placeholder="Ej: Lenguaje y Comunicación" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* Evaluación */}
                    <FormField control={form.control} name="evaluacion" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de la Evaluación (Opcional)</FormLabel>
                        <FormControl><Input placeholder="Ej: Prueba Final 'El Perro Siberiano'" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* Fecha */}
                    <FormField control={form.control} name="fecha" render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="mb-2">Fecha de la Evaluación</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP", { locale: es })
                                ) : (
                                  <span>Seleccionar fecha</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                              locale={es}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* Puntaje Total */}
                    <FormField control={form.control} name="puntajeTotal" render={({ field: { onChange, value, ...rest } }) => (
                      <FormItem>
                        <FormLabel>Puntaje Total Máximo (Requerido)</FormLabel>
                        <FormControl><Input type="number" placeholder="Ej: 50" value={value} onChange={e => onChange(e.target.valueAsNumber)} {...rest} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </Card>

                {/* Segunda Columna: Pautas y Rubricas */}
                <Card className="p-6 border-2 shadow-xl bg-[var(--bg-card)] border-[var(--border-color)]">
                  <CardHeader className="p-0 mb-6">
                    <CardTitle className="text-3xl border-b pb-2 border-[var(--border-color)] flex items-center gap-2"><ClipboardList className="h-6 w-6 text-cyan-500" /> Criterios de Corrección</CardTitle>
                  </CardHeader>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Pauta (Respuestas correctas) */}
                    <FormField control={form.control} name="pauta" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pauta / Respuestas Correctas (Requerido)</FormLabel>
                        <FormControl><Textarea placeholder="Ej: 1. La respuesta correcta es la C. 2. La respuesta debe mencionar el simbolismo del perro siberiano." rows={6} {...field} /></FormControl>
                        <FormDescription>Describe las respuestas esperadas y el puntaje por ítem.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* Rubrica de Evaluación */}
                    <FormField control={form.control} name="rubrica" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rúbrica de Habilidades (Opcional)</FormLabel>
                        <FormControl><Textarea placeholder="Ej: Criterio 1: Comprensión lectora. Criterio 2: Desarrollo de ideas. (Nivel Insuficiente, Básico, Satisfactorio, Excelente)" rows={6} {...field} /></FormControl>
                        <FormDescription>Define los niveles de habilidad para las preguntas de desarrollo.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* Pauta para Selección Múltiple (JSON o Texto estructurado) */}
                    <FormField control={form.control} name="pautaCorrectaAlternativas" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pauta para Alternativas (Opcional, formato: {'{"1":"A", "2":"B"}'})</FormLabel>
                        <FormControl><Textarea placeholder="Ej: {'1':'A', '2':'B', '3':'C'}" rows={3} {...field} /></FormControl>
                        <FormDescription>Usar JSON si la pauta es compleja. Opcional.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* Items Esperados / Criterios de Desarrollo */}
                    <FormField control={form.control} name="itemsEsperados" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ítems Esperados de Desarrollo (Opcional)</FormLabel>
                        <FormControl><Textarea placeholder="Ej: Pregunta 3: 1 punto por mencionar el abandono, 1 punto por la soledad." rows={3} {...field} /></FormControl>
                        <FormDescription>Detalla los puntos a asignar por cada elemento en respuestas abiertas.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* Slider de Flexibilidad */}
                    <FormField control={form.control} name="flexibilidad" render={({ field }) => (
                      <FormItem className="col-span-1 lg:col-span-2">
                        <FormLabel>Flexibilidad en la Evaluación (IA)</FormLabel>
                        <FormControl>
                          <div className="flex items-center space-x-4">
                            <span className="w-20 text-right text-sm">Riguroso</span>
                            <Slider
                              min={0}
                              max={10}
                              step={1}
                              value={[field.value]}
                              onValueChange={(val) => field.onChange(val[0])}
                              className="flex-grow"
                            />
                            <span className="w-20 text-left text-sm">Flexible</span>
                          </div>
                        </FormControl>
                        <FormDescription>Define si la IA será estricta (0) o considerará variantes y sinónimos (10).</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </Card>

                {/* Tercera Columna: Archivo */}
                <Card className="p-6 border-2 shadow-xl bg-[var(--bg-card)] border-[var(--border-color)]">
                  <CardHeader className="p-0 mb-6">
                    <CardTitle className="text-3xl border-b pb-2 border-[var(--border-color)] flex items-center gap-2"><ImageUp className="h-6 w-6 text-cyan-500" /> Imagen o PDF del Estudiante</CardTitle>
                  </CardHeader>
                  <div className="space-y-4">
                    <div className="flex space-x-4">
                      <Button type="button" onClick={() => fileInputRef.current?.click()} className="flex-grow py-6 text-lg">
                        <FileUp className="mr-2 h-5 w-5" /> Subir Archivo (JPG/PNG/PDF)
                      </Button>
                      <Button type="button" onClick={() => setIsCameraModalOpen(true)} className="py-6 text-lg bg-red-500 hover:bg-red-600">
                        <Camera className="mr-2 h-5 w-5" /> Tomar Foto
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="hidden"
                      />
                    </div>
                    {previewUrl && (
                      <div className="relative border-2 border-[var(--border-color)] rounded-xl p-4 bg-gray-900 shadow-inner">
                        <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 z-10" onClick={clearFile}>
                          <X className="h-4 w-4" />
                        </Button>
                        <p className="text-sm text-center mb-2 text-[var(--text-secondary)]">Archivo Seleccionado: {file?.name}</p>
                        {file?.type.startsWith('image/') ? (
                          <img src={previewUrl} alt="Vista previa del archivo del estudiante" className="max-h-96 mx-auto object-contain rounded-lg border border-gray-700" />
                        ) : (
                          <div className="h-40 flex items-center justify-center bg-gray-800 rounded-lg">
                            <p className="text-lg text-gray-400">PDF Subido (No se puede previsualizar)</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>

                {/* Botón de Enviar */}
                <Button type="submit" className="w-full py-7 text-xl" disabled={loading || !file}>
                  {loading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Evaluando...</>
                  ) : (
                    <><Sparkles className="mr-2 h-6 w-6" /> Evaluar Ahora</>
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>

          {/* Resultados */}
          <TabsContent value="results" className="mt-4">
            {evaluationResult ? (
              <Card className="max-w-4xl mx-auto p-6 border-2 shadow-xl bg-[var(--bg-card)] border-[var(--border-color)]">
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-3xl border-b pb-2 border-[var(--border-color)] flex items-center gap-2 text-cyan-500"><Sparkles className="h-6 w-6" /> Informe de Evaluación</CardTitle>
                  <CardDescription>Análisis generado por Libel-IA con base en tu pauta y la respuesta del estudiante.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 space-y-6">
                  {/* Detalles del Alumno */}
                  <Table className="border-2 border-[var(--border-color)] rounded-lg">
                    <TableBody>
                      <TableRow><TableCell className="font-semibold w-1/4">Estudiante</TableCell><TableCell>{evaluationResult.nombreEstudiante || 'N/A'}</TableCell></TableRow>
                      <TableRow><TableCell className="font-semibold">Curso</TableCell><TableCell>{evaluationResult.curso || 'N/A'}</TableCell></TableRow>
                      <TableRow><TableCell className="font-semibold">Asignatura</TableCell><TableCell>{evaluationResult.asignatura || 'N/A'}</TableCell></TableRow>
                      <TableRow><TableCell className="font-semibold">Evaluación</TableCell><TableCell>{evaluationResult.evaluacion || 'N/A'}</TableCell></TableRow>
                      <TableRow><TableCell className="font-semibold">Fecha</TableCell><TableCell>{evaluationResult.fecha ? format(evaluationResult.fecha, "PPP", { locale: es }) : 'N/A'}</TableCell></TableRow>
                    </TableBody>
                  </Table>

                  {/* Resultados y Nota */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                    <Card className="bg-green-900/30 border-green-500/50"><CardContent className="py-4"><p className="text-sm font-semibold text-green-400">Puntaje</p><p className="text-4xl font-bold text-green-200 mt-1">{evaluationResult.puntajeObtenido}/{evaluationResult.puntajeTotal}</p></CardContent></Card>
                    <Card className="bg-yellow-900/30 border-yellow-500/50"><CardContent className="py-4"><p className="text-sm font-semibold text-yellow-400">Nota</p><p className="text-4xl font-bold text-yellow-200 mt-1">{evaluationResult.nota}</p></CardContent></Card>
                    <Card className="bg-blue-900/30 border-blue-500/50"><CardContent className="py-4"><p className="text-sm font-semibold text-blue-400">Comentarios</p><p className="text-sm text-blue-200 mt-1">{evaluationResult.comentarioGeneral}</p></CardContent></Card>
                  </div>

                  {/* Fortalezas */}
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-green-400">Fortalezas</h3>
                    <ul className="list-disc pl-5 space-y-1 text-[var(--text-secondary)]">
                      {Object.values(evaluationResult.fortalezas || {}).map((item: any, index: number) => (
                        <li key={index}>**{item.justificacion}:** <i>{item.cita}</i></li>
                      ))}
                    </ul>
                  </div>

                  {/* Áreas de Mejora */}
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-red-400">Áreas de Mejora</h3>
                    <ul className="list-disc pl-5 space-y-1 text-[var(--text-secondary)]">
                      {Object.values(evaluationResult.areasMejora || {}).map((item: any, index: number) => (
                        <li key={index}>**{item.justificacion}:** <i>{item.cita}</i></li>
                      ))}
                    </ul>
                  </div>

                  {/* Habilidades (si hay rúbrica) */}
                  {evaluationResult.evaluacionHabilidades && Object.keys(evaluationResult.evaluacionHabilidades).length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-cyan-400">Evaluación por Habilidades</h3>
                      <Table className="border border-[var(--border-color)]">
                        <TableHeader><TableRow><TableHead className="w-1/3">Habilidad</TableHead><TableHead className="w-1/4">Nivel</TableHead><TableHead>Evidencia</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {Object.entries(evaluationResult.evaluacionHabilidades).map(([habilidad, datos]: any) => (
                            <TableRow key={habilidad}>
                              <TableCell className="font-medium">{habilidad}</TableCell>
                              <TableCell>{datos.nivel}</TableCell>
                              <TableCell className="text-sm italic">{datos.evidencia}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Descarga PDF */}
                  <div className="pt-4 border-t border-[var(--border-color)]">
                    <Button onClick={handleGeneratePdf} disabled={isPdfGenerating} className="w-full py-6 text-lg bg-indigo-600 hover:bg-indigo-700">
                      {isPdfGenerating ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generando PDF...</>
                      ) : (
                        <><Printer className="mr-2 h-5 w-5" /> Descargar Informe PDF</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <p className="text-center text-xl text-[var(--text-secondary)] mt-12">No hay resultados de evaluación para mostrar. Por favor, realiza una evaluación.</p>
            )}
          </TabsContent>

          {/* Presentación */}
          <TabsContent value="presentacion" className="mt-8">
            <Card className="max-w-4xl mx-auto border-2 shadow-xl bg-[var(--bg-card)] border-[var(--border-color)] p-10 text-center">
              <img src={DRAGONFLY_DATA_URL} alt="Logo Libel-IA" className="mx-auto h-32 w-32 mb-6" />
              <h1 className={`text-5xl font-bold ${wordmarkClass} font-logo mb-4`}>Libel-IA</h1>
              <p className="text-lg text-[var(--text-secondary)] mb-6">
                Plataforma chilena de evaluación educativa con inteligencia artificial.
                Creada por un profesor, para profesores. Detecta respuestas, genera retroalimentación
                y entrega informes pedagógicos profesionales en segundos. <b>1 crédito = 1 imagen.</b>
              </p>
              <ul className="text-left space-y-2 mx-auto max-w-xl text-[var(--text-secondary)]">
                <li>✅ Análisis automático de pruebas (alternativas, desarrollo, V/F).</li>
                <li>✅ Retroalimentación detallada y notas en escala chilena.</li>
                <li>✅ Informes PDF listos para imprimir o enviar.</li>
                <li>✅ Compatible con múltiples cursos y asignaturas.</li>
              </ul>
              <div className="flex items-center justify-center gap-3 mt-8">
                <a href="/planes" className="inline-flex items-center rounded-xl bg-black text-white px-5 py-3 text-sm font-semibold hover:opacity-90">
                  Empezar ahora (activar 10 gratis)
                </a>
                <Button size="lg" className="text-sm py-3 px-5" onClick={() => setActiveTab('evaluator')}>
                  Ir al Evaluador <Sparkles className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <SmartCameraModal isOpen={isCameraModalOpen} onClose={() => setIsCameraModalOpen(false)} onCapture={handleImageCapture} />
    </div>
  );
}
