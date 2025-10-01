'use client';

import * as React from 'react';
import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import Image from 'next/image';

// UI Components
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
import { Loader2, Sparkles, FileUp, Camera, Users, X, Printer, CalendarIcon, ImageUp, ClipboardList, Home, Palette, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/isMobile';

// App Components & Hooks
import { NotesDashboard } from '@/components/NotesDashboard';
import { useEvaluator } from './useEvaluator';

// PDF Components
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image as PDFImage, PDFViewer, pdf } from '@react-pdf/renderer';

const SmartCameraModal = dynamic(() => import('@/components/smart-camera-modal'), { ssr: false, loading: () => <p>Loading...</p> });

const Label = React.forwardRef<HTMLLabelElement, React.ComponentPropsWithoutRef<'label'>>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('text-sm font-medium', className)} {...props} />
));
Label.displayName = 'Label';

// Logo and Styling Constants
const DRAGONFLY_SVG = `
<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg" aria-label="Libel-IA logo">
  <defs>
    <linearGradient id="lg-a" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="50%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#06B6D4"/>
    </linearGradient>
  </defs>
  <rect x="147" y="72" width="6" height="92" rx="3" fill="url(#lg-a)"/>
  <circle cx="150" cy="66" r="11" fill="url(#lg-a)"/>
  <path d="M30,80 C90,40 210,40 270,80 C210,92 90,92 30,80Z" fill="url(#lg-a)" opacity="0.25"/>
  <path d="M40,110 C100,90 200,90 260,110 C200,122 100,122 40,110Z" fill="url(#lg-a)" opacity="0.2"/>
  <rect x="149" y="166" width="2" height="14" rx="1" fill="#6366F1"/>
  <rect x="149" y="182" width="2" height="10" rx="1" fill="#22D3EE"/>
</svg>
`;
const DRAGONFLY_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(DRAGONFLY_SVG)}`;
const wordmarkClass = 'text-transparent bg-clip-text bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400';

const GlobalStyles = () => (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@700&display=swap');
      .font-logo { font-family: 'Josefin Sans', sans-serif; }
      :root, .theme-default {
        --bg-main: #F9FAFB; --bg-card: #FFFFFF; --bg-muted: #F3F4F6; --bg-muted-subtle: #F9FAFB;
        --bg-primary: #4338CA; --bg-primary-hover: #3730A3; --text-primary: #1F2937;
        --text-secondary: #6B7280; --text-on-primary: #FFFFFF; --text-accent: #4338CA;
        --border-color: #E5E7EB; --border-focus: #4F46E5; --ring-color: #4F46E5;
      }
      .theme-ocaso {
        --bg-main: #09090b; --bg-card: #18181b; --bg-muted: #27272a; --bg-muted-subtle: #18181b;
        --bg-primary: #7C3AED; --bg-primary-hover: #6D28D9; --text-primary: #F4F4F5;
        --text-secondary: #a1a1aa; --text-on-primary: #FFFFFF; --text-accent: #a78bfa;
        --border-color: #27272a; --border-focus: #8B5CF6; --ring-color: #8B5CF6;
      }
      .theme-corporativo {
        --bg-main: #F0F4F8; --bg-card: #FFFFFF; --bg-muted: #E3E8EE; --bg-muted-subtle: #F8FAFC;
        --bg-primary: #2563EB; --bg-primary-hover: #1D4ED8; --text-primary: #0F172A;
        --text-secondary: #475569; --text-on-primary: #FFFFFF; --text-accent: #2563EB;
        --border-color: #CBD5E1; --border-focus: #2563EB; --ring-color: #2563EB;
      }
      .pdf-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 60; }
      .pdf-modal { width: 95vw; height: 90vh; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
      .pdf-modal-header { padding: 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); }
      .pdf-modal-body { flex: 1; }
      .pdf-modal-actions { display: flex; gap: 8px; }
      .compact-field { margin-top: 4px; }
      .compact-field label { font-size: 12px; font-weight: 600; margin-bottom: 2px; }
      .compact-field .range-hints { font-size: 10px; margin-top: 2px; }
      @media (max-width: 600px) { body { font-size: 12px; line-height: 1.4; } }
    `}</style>
  );

// PDF Styles
const styles = StyleSheet.create({
    page: { padding: 20, fontSize: 10, lineHeight: 1.25 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerRight: { textAlign: 'right' as 'right' },
    logoLibelia: { height: 28, width: 28 },
    logoColegio: { maxHeight: 30, maxWidth: 110, objectFit: 'contain' },
    title: { fontSize: 13, fontWeight: 'bold' as 'bold', color: '#4F46E5' },
    subtitle: { fontSize: 9, color: '#6B7280' },
    infoText: { fontSize: 9, color: '#4B5563', marginVertical: 1 },
    studentLine: { fontSize: 9, color: '#111827', marginTop: 5 },
    sectionTitle: { fontSize: 10, fontWeight: 'bold' as 'bold', paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 5, marginTop: 8 },
    table: { display: 'table', width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 6 },
    tableRow: { margin: 'auto', flexDirection: 'row', borderBottomWidth: 1, borderColor: '#E5E7EB' },
    tableColHeader: { width: '35%', backgroundColor: '#F9FAFB', padding: 2, borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB' },
    tableCol: { width: '35%', padding: 2, borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB' },
    tableCellHeader: { margin: 1, fontSize: 8, fontWeight: 'bold' as 'bold' },
    tableCell: { margin: 1, fontSize: 8 },
});

// Helper and Type Definitions
const splitCorreccionForTwoPages = (lista: any[] | undefined) => {
    if (!lista || lista.length === 0) return { first: [], rest: [] };
    const MAX_P1 = Math.min(5, lista.length);
    return { first: lista.slice(0, MAX_P1), rest: lista.slice(MAX_P1) };
};

const formSchema = z.object({
    tipoEvaluacion: z.string().default('prueba'),
    rubrica: z.string().min(10, 'La rúbrica es necesaria.'),
    puntajeTotal: z.string().min(1, 'El puntaje total es obligatorio.').regex(/^[0-9]+$/, 'El puntaje debe ser un número entero.'),
    pauta: z.string().optional(),
    flexibilidad: z.array(z.number()).default([3]),
    nombreProfesor: z.string().optional(),
    nombrePrueba: z.string().optional(),
    departamento: z.string().optional(),
    asignatura: z.string().optional(),
    curso: z.string().optional(),
    fechaEvaluacion: z.date().optional(),
    areaConocimiento: z.string().default('general'),
});

// Interfaces
interface FilePreview { id: string; file: File; previewUrl: string; dataUrl: string; }
interface RetroalimentacionEstructurada {
    correccion_detallada?: { seccion: string; detalle: string; }[];
    evaluacion_habilidades?: { habilidad: string; evaluacion: string; evidencia: string; }[];
    resumen_general?: { fortalezas: string; areas_mejora: string; };
    puntaje?: string;
    nota?: number;
    retroalimentacion_alternativas?: { pregunta: string; respuesta_estudiante: string; respuesta_correcta: string; }[];
}
interface StudentGroup {
    id: string;
    studentName: string;
    files: FilePreview[];
    retroalimentacion?: RetroalimentacionEstructurada;
    puntaje?: string;
    nota?: number | string;
    decimasAdicionales: number;
    isEvaluated: boolean;
    isEvaluating: boolean;
    error?: string;
}

// PDF Document Component
const ReportDocument = ({ group, formData, logoPreview }: any) => {
    // PDF rendering logic... (omitted for brevity, same as your original)
    return (
        <Document>
          <Page size="A4" style={styles.page}>
            {/* PDF Content Here */}
          </Page>
        </Document>
      );
};


// Main Component
export default function EvaluatorClient() {
    // State Hooks
    const [activeTab, setActiveTab] = useState('presentacion');
    const [userEmail, setUserEmail] = useState<string>('');
    const [unassignedFiles, setUnassignedFiles] = useState<FilePreview[]>([]);
    const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [classSize, setClassSize] = useState(1);
    const [isExtractingNames, setIsExtractingNames] = useState(false);
    const [theme, setTheme] = useState('theme-ocaso');
    const [previewGroupId, setPreviewGroupId] = useState<string | null>(null);

    // Other Hooks
    const isMobile = useIsMobile();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const { evaluate, isLoading } = useEvaluator();
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            tipoEvaluacion: 'prueba',
            rubrica: '',
            puntajeTotal: '100',
            pauta: '',
            flexibilidad: [3],
            nombreProfesor: '',
            nombrePrueba: '',
            departamento: '',
            asignatura: '',
            curso: '',
            fechaEvaluacion: new Date(),
            areaConocimiento: 'general',
        },
    });

    // Effects
    useEffect(() => {
        const saved = (localStorage.getItem('userEmail') || '').toLowerCase();
        if (saved && /\S+@\S+\.\S+/.test(saved)) setUserEmail(saved);
    }, []);

    useEffect(() => {
        const count = Math.max(1, classSize);
        setStudentGroups(Array.from({ length: count }, (_, i) => ({
            id: `student-${Date.now()}-${i}`,
            studentName: `Alumno ${i + 1}`,
            files: [],
            isEvaluated: false,
            isEvaluating: false,
            decimasAdicionales: 0,
        })));
        setUnassignedFiles([]);
    }, [classSize]);

    // Handlers and Functions
    const processFiles = (files: File[]) => {
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                setUnassignedFiles(prev => [...prev, { id: `${file.name}-${Date.now()}`, file, previewUrl: URL.createObjectURL(file), dataUrl }]);
            };
            reader.readAsDataURL(file);
        });
    };

    const handleFilesSelected = (files: FileList | null) => {
        if (files) processFiles(Array.from(files));
    };

    const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setLogoPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const updateStudentName = (groupId: string, newName: string) =>
        setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, studentName: newName } : g));
    
    const handlePuntajeChange = (groupId: string, value: string) => {
        setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, puntaje: value } : g));
    };

    const handleNotaChange = (groupId: string, value: string) => {
        setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, nota: parseFloat(value) || 0 } : g));
    };

    const onEvaluateAll = async () => {
        const values = form.getValues();
        for (const group of studentGroups) {
            if (group.files.length === 0) continue;
            setStudentGroups(prev => prev.map(g => g.id === group.id ? { ...g, isEvaluating: true } : g));
            const payload = {
                fileUrls: group.files.map(f => f.dataUrl),
                rubrica: values.rubrica,
                pauta: values.pauta,
                flexibilidad: values.flexibilidad[0],
                tipoEvaluacion: values.tipoEvaluacion,
                areaConocimiento: values.areaConocimiento,
                userEmail,
                puntajeTotal: Number(values.puntajeTotal),
            };
            const result = await evaluate(payload);
            setStudentGroups(prev => prev.map(g => g.id === group.id ? { ...g, isEvaluating: false, isEvaluated: true, ...(result.success ? result : { error: result.error }) } : g));
        }
    };

    // JSX Return
    return (
        <div className={activeTab === 'inicio' ? 'theme-ocaso' : theme}>
            <GlobalStyles />
            {isCameraOpen && <SmartCameraModal onCapture={()=>{}} onClose={() => setIsCameraOpen(false)} />}
            <main className="p-4 md:p-8 max-w-6xl mx-auto font-sans bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-300">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4 bg-[var(--bg-muted)]">
                        <TabsTrigger value="inicio"><Home className="mr-2 h-4 w-4" />Inicio</TabsTrigger>
                        <TabsTrigger value="evaluator"><Sparkles className="mr-2 h-4 w-4" />Evaluador</TabsTrigger>
                        <TabsTrigger value="dashboard"><ClipboardList className="mr-2 h-4 w-4" />Resumen</TabsTrigger>
                        <TabsTrigger value="presentacion"><Eye className="mr-2 h-4 w-4" />Presentación</TabsTrigger>
                    </TabsList>

                    <TabsContent value="inicio" className="mt-8 text-center">
                        <Card className="max-w-3xl mx-auto border-2 shadow-lg bg-[var(--bg-card)] border-[var(--border-color)]" style={{ backgroundImage: 'radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, rgba(9, 9, 11, 0) 70%)' }}>
                            <CardContent className="p-12">
                                <Image src={DRAGONFLY_DATA_URL} alt="Logo" width={144} height={144} className="mx-auto mb-4" />
                                <h1 className={`text-6xl font-bold ${wordmarkClass} font-logo`}>Libel-IA</h1>
                                <p className="mt-3 text-xl italic text-cyan-300">&ldquo;Evaluación con Inteligencia Docente: Hecha por un Profe, para Profes&rdquo;</p>
                                <p className="mt-6 text-lg text-[var(--text-secondary)]">Asistente pedagógico inteligente que analiza las respuestas de tus estudiantes, genera retroalimentación detallada y crea informes al instante.</p>
                                <Button size="lg" className="mt-8 text-lg py-6 px-8" onClick={() => setActiveTab('evaluator')}>
                                    Comenzar a Evaluar <Sparkles className="ml-2 h-5 w-5" />
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="evaluator" className="space-y-8 mt-4">
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(onEvaluateAll)} className="space-y-8">
                                <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
                                    <CardHeader><CardTitle className="text-[var(--text-accent)]">Paso 1: Configuración de la Evaluación</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="puntajeTotal"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Puntaje Total</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ej: 60" type="number" {...field} />
                                                    </FormControl>
                                                    <FormDescription>Puntaje máximo de la evaluación.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="rubrica"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Rúbrica (Criterios)</FormLabel>
                                                    <FormControl>
                                                        <Textarea placeholder="Describe los criterios de evaluación..." {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </CardContent>
                                </Card>
                                <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
                                    <CardHeader><CardTitle className="text-[var(--text-accent)]">Paso 2: Cargar y Agrupar Trabajos</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="font-bold">Cargar Archivos</div>
                                        <Button type="button" onClick={() => fileInputRef.current?.click()}>
                                            <FileUp className="mr-2 h-4 w-4" /> Subir Archivos
                                        </Button>
                                        <input type="file" multiple ref={fileInputRef} onChange={(e) => handleFilesSelected(e.target.files)} className="hidden" />
                                        {/* File previews and grouping UI here */}
                                    </CardContent>
                                    <CardFooter>
                                        <Button type="submit" size="lg" disabled={isLoading}>
                                            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Evaluando...</> : <><Sparkles className="mr-2 h-4 w-4" /> Evaluar Todo</>}
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </form>
                        </Form>
                        {/* Results section */}
                        {studentGroups.some(g => g.isEvaluated) && (
                            <Card>
                                <CardHeader><CardTitle>Resultados</CardTitle></CardHeader>
                                <CardContent>
                                    {studentGroups.filter(g => g.isEvaluated).map(group => (
                                        <div key={group.id} className="p-4 border-b">
                                            <h3 className="font-bold">{group.studentName}</h3>
                                            <p>Puntaje: {group.puntaje}</p>
                                            <p>Nota: {group.nota}</p>
                                            {/* More details */}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="dashboard">
                        <NotesDashboard studentGroups={studentGroups} curso={form.getValues('curso')} fecha={form.getValues('fechaEvaluacion')} />
                    </TabsContent>
                    
                    <TabsContent value="presentacion">
                        {/* Presentation content */}
                    </TabsContent>

                </Tabs>
            </main>
        </div>
    );
}