// EvaluatorClient.tsx
'use client';
import * as React from 'react';
import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
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
import { Loader2, Sparkles, FileUp, Camera, Users, X, Printer, CalendarIcon, ImageUp, ClipboardList, Home, Palette, Eye, FileText, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import NotesDashboard from '@/components/NotesDashboard';
// PDF
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image as PDFImage, PDFViewer, pdf } from '@react-pdf/renderer';
import { useEvaluator } from './useEvaluator';
const SmartCameraModal = dynamic(() => import('@/components/smart-camera-modal'), { ssr: false, loading: () => <p>Cargando...</p> });
const Label = React.forwardRef<HTMLLabelElement, React.ComponentPropsWithoutRef<'label'>>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('text-sm font-medium', className)} {...props} />
));
Label.displayName = 'Label';

// 🔥 FUNCIÓN DE PREVISUALIZACIÓN (AGREGADA)
const renderFilePreview = (file: { file: File; previewUrl: string }) => {
  const { file: f, previewUrl } = file;
  const type = f.type;
  const name = f.name.toLowerCase();

  if (type.startsWith('image/')) {
    return <img src={previewUrl} alt={f.name} className="w-full h-full object-cover rounded-md" />;
  }

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 rounded-md">
        <FileText className="text-red-500 h-6 w-6" />
        <span className="text-[10px] mt-1 text-gray-600 truncate px-1">PDF</span>
      </div>
    );
  }

  if (type.includes('word') || name.endsWith('.docx')) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-blue-50 rounded-md">
        <FileText className="text-blue-500 h-6 w-6" />
        <span className="text-[10px] mt-1 text-gray-600 truncate px-1">Word</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 rounded-md">
      <File className="text-gray-500 h-6 w-6" />
      <span className="text-[10px] mt-1 text-gray-600 truncate px-1">Archivo</span>
    </div>
  );
};

// ==== DEFINICIONES DE CONSTANTES GLOBALES ====
const wordmarkClass = 'text-transparent bg-clip-text bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400';
const LIBELIA_LOGO_PNG_BASE64 = '/LOGO-LIBEL.png';

// ==== Estilos Globales ====
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

// ==== Estilos PDF ====
const styles = StyleSheet.create({
  page: { padding: 20, fontSize: 10, lineHeight: 1.25 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { textAlign: 'right' },
  logoLibelia: { height: 30, width: 30, marginRight: 8, objectFit: 'contain' },
  logoColegio: { maxHeight: 30, maxWidth: 110, objectFit: 'contain' },
  title: { fontSize: 13, fontWeight: 'bold', color: '#4F46E5' },
  subtitle: { fontSize: 9, color: '#6B7280' },
  infoText: { fontSize: 9, color: '#4B5563', marginVertical: 1 },
  studentLine: { fontSize: 9, color: '#111827', marginTop: 5 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 5, marginTop: 8 },
  feedbackGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
  feedbackCard: { padding: 6, borderRadius: 6, flex: 1 },
  fortalezas: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  areasMejora: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  feedbackTitle: { fontSize: 9, fontWeight: 'bold', color: '#166534', marginBottom: 3 },
  feedbackImproveTitle: { fontSize: 9, fontWeight: 'bold', color: '#854D0E', marginBottom: 3 },
  feedbackText: { fontSize: 8, lineHeight: 1.15, flexWrap: 'wrap' as any },
  table: { width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 6 },
  tableRow: { margin: 'auto', flexDirection: 'row', borderBottomWidth: 1, borderColor: '#E5E7EB' },
  tableColHeader: { width: '35%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', padding: 2 },
  tableColHeaderDetail: { width: '65%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', padding: 2 },
  tableCol: { width: '35%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', padding: 2 },
  tableColDetail: { width: '65%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', padding: 2 },
  col40: { width: '40%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', padding: 2 },
  col30: { width: '30%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', padding: 2 },
  habCol45: { width: '45%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', padding: 2 },
  habCol18: { width: '18%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', padding: 2, textAlign: 'center' as any },
  habCol37: { width: '37%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', padding: 2 },
  tableCellHeader: { margin: 1, fontSize: 8, fontWeight: 'bold' },
  tableCell: { margin: 1, fontSize: 8, textAlign: 'left' as any },
});

// ----------------- Helpers safe render -----------------
function renderForWeb(value: any): React.ReactNode {
  if (value === null || value === undefined) return '';
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc ml-6">
        {value.map((v, i) => <li key={i}>{renderForWeb(v)}</li>)}
      </ul>
    );
  }
  try {
    if (typeof value === 'object' && value !== null && value.cita_estudiante && value.justificacion) {
      return (
        <div className="space-y-1">
          <p className='font-semibold text-sm'>Puntaje: {value.puntaje}</p>
          <p className='text-xs italic text-[var(--text-secondary)]'>Cita Estudiante: &quot;{value.cita_estudiante}&quot;</p>
          <p className='text-sm'>{value.justificacion}</p>
        </div>
      );
    }
    return <pre className="text-sm whitespace-pre-wrap bg-[var(--bg-muted-subtle)] p-2 rounded">{JSON.stringify(value, null, 2)}</pre>;
  } catch {
    return String(value);
  }
}
function pdfSafe(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    if (typeof value === 'object' && value !== null && value.cita_estudiante && value.justificacion) {
        return `Puntaje: ${value.puntaje}
Respuesta Estudiante: "${value.cita_estudiante}"
Justificación: ${value.justificacion}`;
    }
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
const splitCorreccionForTwoPages = (lista: any[] | undefined) => {
  if (!lista || lista.length === 0) return { first: [], rest: [] };
  const MAX_P1 = Math.min(5, lista.length);
  return { first: lista.slice(0, MAX_P1), rest: lista.slice(MAX_P1) };
};
const ReportDocument = ({ group, formData, logoPreview }: any) => {
  const resumen = (group.retroalimentacion && group.retroalimentacion.resumen_general) || { fortalezas: 'N/A', areas_mejora: 'N/A' };
  const puntaje = group.puntaje || 'N/A';
  const notaNum = Number(group.nota) || 0;
  const notaFinal = (notaNum + (group.decimasAdicionales || 0)).toFixed(1);
  const correccion = group.retroalimentacion?.correccion_detallada || [];
  const correccionDesarrolloArray = Object.keys(group.detalle_desarrollo || {}).map(key => ({
      seccion: `Pregunta Desarrollo: ${key.replace(/_/g, ' ')}`,
      detalle: group.detalle_desarrollo[key],
  }));
  const correccionConDesarrollo = [...correccion, ...correccionDesarrolloArray];
  const { first: correccionP1, rest: correccionP2 } = splitCorreccionForTwoPages(correccionConDesarrollo);
  const isSuperior = ['Técnico Superior', 'Universitario', 'Postgrado'].includes(formData.nivelEducativo);
  const cursoLabel = isSuperior ? 'Sección' : 'Curso';
  const departamentoLabel = isSuperior ? 'Escuela/Carrera' : 'Departamento';
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <PDFImage src={LIBELIA_LOGO_PNG_BASE64} style={styles.logoLibelia} />
            <View>
              <Text style={styles.title}>Libel-IA</Text>
              <Text style={styles.subtitle}>Informe de Evaluación Pedagógica</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {logoPreview && <PDFImage src={logoPreview} style={styles.logoColegio} />}
            <Text style={styles.infoText}>Profesor: {pdfSafe(formData.nombreProfesor || 'N/A')}</Text>
            <Text style={styles.infoText}>Asignatura: {pdfSafe(formData.asignatura || 'N/A')}</Text>
            <Text style={styles.infoText}>{departamentoLabel}: {pdfSafe(formData.departamento || 'N/A')}</Text>
            <Text style={styles.infoText}>Evaluación: {pdfSafe(formData.nombrePrueba || 'N/A')}</Text>
            <Text style={styles.infoText}>Fecha: {pdfSafe(format(new Date(), 'dd/MM/yyyy'))}</Text>
          </View>
        </View>
        <Text style={styles.studentLine}>Alumno: {pdfSafe(group.studentName)} · {cursoLabel}: {pdfSafe(formData.curso || 'N/A')}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', padding: 5, borderRadius: 6, textAlign: 'center' as any }}>
            <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#4B5563', marginBottom: 2 }}>Puntaje</Text>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#4F46E5' }}>{pdfSafe(puntaje)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', padding: 5, borderRadius: 6, textAlign: 'center' as any }}>
            <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#4B5563', marginBottom: 2 }}>Nota</Text>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#4F46E5' }}>{pdfSafe(notaFinal)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', padding: 5, borderRadius: 6, textAlign: 'center' as any }}>
            <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#4B5563', marginBottom: 2 }}>Fecha</Text>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#4F46E5' }}>{pdfSafe(format(new Date(), 'dd/MM/yyyy'))}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <View style={{ padding: 6, borderRadius: 6, flex: 1, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#166534', marginBottom: 3 }}>✅ <Text>Fortalezas</Text></Text> 
            <Text style={styles.feedbackText}>{pdfSafe(resumen.fortalezas)}</Text>
          </View>
          <View style={{ padding: 6, borderRadius: 6, flex: 1, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' }}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#854D0E', marginBottom: 3 }}>✏️ <Text>Áreas de Mejora</Text></Text>
            <Text style={styles.feedbackText}>{pdfSafe(resumen.areas_mejora)}</Text>
          </View>
        </View>
        {correccionP1.length > 0 && (
          <View style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 5, marginTop: 8 }}>Corrección Detallada</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, { backgroundColor: '#F9FAFB' }]}>
                <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Sección</Text></View>
                <View style={styles.tableColHeaderDetail}><Text style={styles.tableCellHeader}>Detalle</Text></View>
              </View>
              {correccionP1.map((item: any, index: number) => (
                <View key={String(index)} style={styles.tableRow}>
                  <View style={styles.tableCol}><Text style={styles.tableCell}>{pdfSafe(item.seccion)}</Text></View>
                  <View style={styles.tableColDetail}><Text style={styles.tableCell}>{pdfSafe(item.detalle)}</Text></View>
                </View>
              ))}
            </View>
          </View>
        )}
        {correccionP2.length > 0 && (
          <View style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 5, marginTop: 8 }}>Corrección Detallada (cont.)</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, { backgroundColor: '#F9FAFB' }]}>
                <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Sección</Text></View>
                <View style={styles.tableColHeaderDetail}><Text style={styles.tableCellHeader}>Detalle</Text></View>
              </View>
              {correccionP2.map((item: any, index: number) => (
                <View key={String(index)} style={styles.tableRow}>
                  <View style={styles.tableCol}><Text style={styles.tableCell}>{pdfSafe(item.seccion)}</Text></View>
                  <View style={styles.tableColDetail}><Text style={styles.tableCell}>{pdfSafe(item.detalle)}</Text></View>
                </View>
              ))}
            </View>
          </View>
        )}
        {group.retroalimentacion?.evaluacion_habilidades?.length > 0 && (
          <View style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 5, marginTop: 8 }}>Evaluación de Habilidades</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, { backgroundColor: '#F9FAFB' }]}>
                <View style={styles.habCol45}><Text style={styles.tableCellHeader}>Habilidad</Text></View>
                <View style={styles.habCol18}><Text style={styles.tableCellHeader}>Nivel</Text></View>
                <View style={styles.habCol37}><Text style={styles.tableCellHeader}>Evidencia</Text></View>
              </View>
              {group.retroalimentacion.evaluacion_habilidades.map((item: any, index: number) => (
                <View key={String(index)} style={styles.tableRow}>
                  <View style={styles.habCol45}><Text style={styles.tableCell}>{pdfSafe(item.habilidad)}</Text></View>
                  <View style={styles.habCol18}><Text style={styles.tableCell}>{pdfSafe(item.evaluacion)}</Text></View>
                  <View style={styles.habCol37}><Text style={styles.tableCell}>{pdfSafe(item.evidencia)}</Text></View>
                </View>
              ))}
            </View>
          </View>
        )}
        {group.retroalimentacion?.retroalimentacion_alternativas?.length > 0 && (
          <View style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 5, marginTop: 8 }}>Respuestas Alternativas</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, { backgroundColor: '#F9FAFB' }]}>
                <View style={styles.col40}><Text style={styles.tableCellHeader}>Pregunta</Text></View>
                <View style={styles.col30}><Text style={styles.tableCellHeader}>Respuesta Estudiante</Text></View>
                <View style={styles.col30}><Text style={styles.tableCellHeader}>Respuesta Correcta</Text></View>
              </View>
              {group.retroalimentacion.retroalimentacion_alternativas.map((item: any, index: number) => (
                <View key={String(index)} style={styles.tableRow}>
                  <View style={styles.col40}><Text style={styles.tableCell}>{pdfSafe(item.pregunta)}</Text></View>
                  <View style={styles.col30}><Text style={styles.tableCell}>{pdfSafe(item.respuesta_estudiante)}</Text></View>
                  <View style={styles.col30}><Text style={styles.tableCell}>{pdfSafe(item.respuesta_correcta)}</Text></View>
                </View>
              ))}
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
};

interface CorreccionDetallada { seccion: string; detalle: string; }
interface EvaluacionHabilidad { habilidad: string; evaluacion: string; evidencia: string; }
interface RetroalimentacionEstructurada {
  correccion_detallada?: CorreccionDetallada[];
  evaluacion_habilidades?: EvaluacionHabilidad[];
  resumen_general?: { fortalezas: string; areas_mejora: string };
  puntaje?: string;
  nota?: number;
  retroalimentacion_alternativas?: { pregunta: string; respuesta_estudiante: string; respuesta_correcta: string }[];
}
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
  nivelEducativo: z.string().default('Educación Media'), 
  nombresGrupales: z.string().optional(),
});
interface FilePreview { id: string; file: File; previewUrl: string; dataUrl: string; }
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
  detalle_desarrollo?: { [key: string]: any };
}
export default function EvaluatorClient() {
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
  const isMobile = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
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
      nivelEducativo: 'Educación Media', 
      nombresGrupales: '',
    },
  });
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
  const processFiles = (files: File[]) => {
    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/bmp',
      'image/tiff',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const validFiles = Array.from(files).filter(file => {
      if (validTypes.includes(file.type)) return true;
      alert(`Formato no soportado para "${file.name}". Usa: JPEG, PNG, BMP, TIFF, PDF, DOCX o XLSX.`);
      return false;
    });
    if (validFiles.length === 0) return;
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setUnassignedFiles(prev => [...prev, { id: `${file.name}-${Date.now()}`, file, previewUrl: URL.createObjectURL(file), dataUrl }]);
      };
      reader.readAsDataURL(file);
    });
  };
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
  };const handleCapture = (dataUrl: string) => {
  fetch(dataUrl)
    .then(res => res.blob())
    .then(blob => {
      // @ts-ignore
      const file = new File([blob], `captura-${Date.now()}.png`, { type: 'image/png' });
      processFiles([file]);
    })
    .catch(err => console.error('Error al crear archivo desde captura:', err));
  setIsCameraOpen(false);
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
    if (fileToMoveBack) setUnassignedFiles(prev => [...prev, fileToMoveBack!]);
  };
  const handleDecimasChange = (groupId: string, value: string) => {
    const decimas = parseFloat(value) || 0;
    setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, decimasAdicionales: decimas } : g));
  };
  const handlePuntajeChange = (groupId: string, value: string) => {
    setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, puntaje: value } : g));
  };
  const handleNotaChange = (groupId: string, value: string) => {
    setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, nota: parseFloat(value) || 0 } : g));
  };
  const removeUnassignedFile = (fileId: string) => { setUnassignedFiles(prev => prev.filter(f => f.id !== fileId)); };
  const handleNameExtraction = async () => {
    if (unassignedFiles.length === 0) {
      alert('Sube primero la página que contiene el nombre.');
      return;
    }
    setIsExtractingNames(true);
    const formDataFD = new FormData();
    formDataFD.append('files', unassignedFiles[0].file); 
    formDataFD.append('nameList', '[]');
    try {
      const response = await fetch('/api/extract-name', { method: 'POST', body: formDataFD });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Error desconocido.');
      const detectedNames = Array.isArray(data.suggestions) ? data.suggestions as string[] : [];
      const numDetected = detectedNames.length;
      if (numDetected > 0) {
        const allNamesList = detectedNames.map(n => n.trim());
        const allNamesString = allNamesList.join('; ');
        const visibleGroupName = allNamesList.join(', ');
        setStudentGroups(groups => {
            if (groups.length === 0) return groups;
            return groups.map((g, index) => {
                if (index === 0) {
                    return { ...g, studentName: visibleGroupName };
                }
                return g;
            });
        });
        form.setValue('nombresGrupales', allNamesString);
        alert(`✅ Éxito: Se detectaron ${numDetected} nombres. El grupo fue renombrado a "${visibleGroupName}". La lista completa se adjuntará a la evaluación.`);
      } else {
          alert('⚠️ Advertencia: No se detectaron nombres en la imagen.');
      }
    } catch (error) {
      console.error('Error en extracción:', error);
      alert(`❌ Error al extraer nombres: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsExtractingNames(false);
    }
  };
  const onEvaluateAll = async () => {
    const { rubrica, pauta, flexibilidad, tipoEvaluacion, areaConocimiento, puntajeTotal, nivelEducativo, nombresGrupales } = form.getValues();
    if (!rubrica) {
      form.setError('rubrica', { type: 'manual', message: 'La rúbrica es requerida.' });
      return;
    }
    for (const group of studentGroups) {
      if (group.files.length === 0) continue;
      setStudentGroups(prev => prev.map(g => g.id === group.id ? { ...g, isEvaluating: true, isEvaluated: false, error: undefined } : g));
      const payload = {
        fileUrls: group.files.map(f => f.dataUrl),
        fileMimeTypes: group.files.map(f => f.file.type),
        rubrica,
        pauta,
        flexibilidad: flexibilidad[0],
        tipoEvaluacion,
        areaConocimiento,
        userEmail,
        puntajeTotal: Number(puntajeTotal),
        nivelEducativo,
        nombresGrupales, 
      };
      const result = await evaluate(payload);
      setStudentGroups(prev => prev.map(g => g.id === group.id
        ? { ...g, isEvaluating: false, isEvaluated: true, ...(result.success ? result : { error: result.error }) }
        : g
      ));
    }
  };
  const exportToDocOrCsv = (formatType: 'csv' | 'doc') => {
  const evaluatedGroups = studentGroups.filter(g => g.isEvaluated);
  if (evaluatedGroups.length === 0) {
    alert('No hay evaluaciones para exportar.');
    return;
  }

  if (formatType === 'doc') {
    // Generar documento Word (.doc) básico con HTML
    const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <title>Notas - Libel-IA</title>
          <style>
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 10px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Resumen de Notas - Libel-IA</h1>
          <table>
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Puntaje</th>
                <th>Nota</th>
                <th>Fortalezas</th>
                <th>Áreas de Mejora</th>
              </tr>
            </thead>
            <tbody>
              ${evaluatedGroups.map(g => `
                <tr>
                  <td>${g.studentName || 'N/A'}</td>
                  <td>${g.puntaje || 'N/A'}</td>
                  <td>${g.nota || 'N/A'}</td>
                  <td>${(g.retroalimentacion?.resumen_general?.fortalezas || 'N/A').replace(/\n/g, '<br>')}</td>
                  <td>${(g.retroalimentacion?.resumen_general?.areas_mejora || 'N/A').replace(/\n/g, '<br>')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notas_libel-ia.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
  const isCurrentlyEvaluatingAny = studentGroups.some(g => g.isEvaluating);
  const previewGroup = previewGroupId ? studentGroups.find(g => g.id === previewGroupId) : null;
  const handlePreview = async (groupId: string) => {
    const group = studentGroups.find(g => g.id === groupId);
    if (!group || !group.retroalimentacion) return;
    if (isMobile) {
      const blob = await pdf(<ReportDocument group={group} formData={form.getValues()} logoPreview={logoPreview} />).toBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } else {
      setPreviewGroupId(groupId);
    }
  };
  const selectedNivel = form.watch('nivelEducativo');
  const isSuperior = ['Técnico Superior', 'Universitario', 'Postgrado'].includes(selectedNivel);
  return (
    <div className={activeTab === 'inicio' ? 'theme-ocaso' : theme}>
      <GlobalStyles />
      {isCameraOpen && <SmartCameraModal onCapture={handleCapture} onClose={() => setIsCameraOpen(false)} />}
      {!isMobile && previewGroup && previewGroup.retroalimentacion && (
        <div className="pdf-modal-backdrop" role="dialog" aria-modal="true">
          <div className="pdf-modal">
            <div className="pdf-modal-header">
              <div className="font-semibold">Vista previa del informe — {previewGroup.studentName}</div>
              <div className="pdf-modal-actions">
                <PDFDownloadLink
                  document={<ReportDocument group={previewGroup} formData={form.getValues()} logoPreview={logoPreview} />}
                  fileName={`informe_${previewGroup.studentName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`}
                >
                  {({ loading }) => (
                    <Button size="sm" disabled={loading}>
                      {loading ? 'Preparando...' : <><Printer className="mr-2 h-4 w-4" /> Descargar PDF</>}
                    </Button>
                  )}
                </PDFDownloadLink>
                <Button variant="outline" size="sm" onClick={() => setPreviewGroupId(null)}>Cerrar</Button>
              </div>
            </div>
            <div className="pdf-modal-body">
              <PDFViewer style={{ width: '100%', height: '100%' }}>
                <ReportDocument group={previewGroup} formData={form.getValues()} logoPreview={logoPreview} />
              </PDFViewer>
            </div>
          </div>
        </div>
      )}
      <main className="p-4 md:p-8 max-w-6xl mx-auto font-sans bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-300">
        <div className="mb-6 p-3 rounded-lg flex items-center justify-between bg-[var(--bg-card)] border border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-[var(--text-secondary)]" />
            <span className="text-sm font-medium text-[var(--text-secondary)]">Tema</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={theme === 'theme-default' ? 'default' : 'ghost'} onClick={() => setTheme('theme-default')} className={cn(theme !== 'theme-default' && 'text-[var(--text-secondary)]')}>Predeterminado</Button>
            <Button size="sm" variant={theme === 'theme-ocaso' ? 'default' : 'ghost'} onClick={() => setTheme('theme-ocaso')} className={cn(theme !== 'theme-ocaso' && 'text-[var(--text-secondary)]')}>Ocaso</Button>
            <Button size="sm" variant={theme === 'theme-corporativo' ? 'default' : 'ghost'} onClick={() => setTheme('theme-corporativo')} className={cn(theme !== 'theme-corporativo' && 'text-[var(--text-secondary)]')}>Corporativo</Button>
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex overflow-x-auto bg-[var(--bg-muted)] py-2 gap-2 scrollbar-hide">
  <TabsTrigger value="inicio" className="shrink-0 whitespace-nowrap px-3 py-1.5 text-sm">
    <Home className="mr-2 h-4 w-4 inline" />Inicio
  </TabsTrigger>
  <TabsTrigger value="evaluator" className="shrink-0 whitespace-nowrap px-3 py-1.5 text-sm">
    <Sparkles className="mr-2 h-4 w-4 inline" />Evaluador Escolar
  </TabsTrigger>
  <TabsTrigger value="evaluator-superior" className="shrink-0 whitespace-nowrap px-3 py-1.5 text-sm">
    <Sparkles className="mr-2 h-4 w-4 inline" />Evaluador Superior 🎓
  </TabsTrigger>
  <TabsTrigger value="dashboard" className="shrink-0 whitespace-nowrap px-3 py-1.5 text-sm">
    <ClipboardList className="mr-2 h-4 w-4 inline" />Resumen
  </TabsTrigger>
  <TabsTrigger value="presentacion" className="shrink-0 whitespace-nowrap px-3 py-1.5 text-sm">
    <Eye className="mr-2 h-4 w-4 inline" />Presentación
  </TabsTrigger>
</TabsList>
          <TabsContent value="inicio" className="mt-8 text-center">
            <Card className="max-w-3xl mx-auto border-2 shadow-lg bg-[var(--bg-card)] border-[var(--border-color)]" style={{ backgroundImage: 'radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, rgba(9, 9, 11, 0) 70%)' }}>
              <CardContent className="p-12">
                <img src={LIBELIA_LOGO_PNG_BASE64} alt="Logo" className="mx-auto h-20 w-20 mb-4" />
                <h1 className={`text-6xl font-bold ${wordmarkClass} font-logo`}>Libel-IA</h1>
                <p className="mt-3 text-xl italic text-cyan-300">&quot;Evaluación con Inteligencia Docente: Hecha por un Profe, para Profes&quot;</p>
                <p className="mt-6 text-lg text-[var(--text-secondary)]">Asistente pedagógico inteligente que analiza las respuestas de tus estudiantes, genera retroalimentación detallada y crea informes al instante.</p>
                <Button size="lg" className="mt-8 text-lg py-6 px-8" onClick={() => setActiveTab('evaluator')}>
                  Comenzar a Evaluar <Sparkles className="ml-2 h-5 w-5" />
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="evaluator" className="space-y-8 mt-4">
            <div className="flex items-center gap-3">
              <img src={LIBELIA_LOGO_PNG_BASE64} alt="Logo Libel-IA" className="h-8 w-8" />
              <span className={`font-semibold text-xl ${wordmarkClass} font-logo`}>Evaluador Escolar</span>
            </div>
            <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
              <CardHeader><CardTitle className="text-[var(--text-accent)]">Paso 1: Configuración de la Evaluación (Escolar)</CardTitle></CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={(e) => { e.preventDefault(); onEvaluateAll(); }} className="space-y-8">
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 p-4 border rounded-lg border-[var(--border-color)]">
                      <div className="flex items-center space-x-3">
                        <Label htmlFor="class-size" className="text-base font-bold text-[var(--text-accent)]">Nº de Estudiantes:</Label>
                        <Input id="class-size" type="number" value={classSize} onChange={(e) => setClassSize(Number(e.target.value) || 1)} className="w-24 text-base" min={1} />
                      </div>
                      <div className="flex items-center space-x-3">
                        <FormField control={form.control} name="curso" render={({ field }) => (
                          <FormItem className="flex items-center space-x-3">
                            <FormLabel className="text-base font-bold mt-2 text-[var(--text-accent)]">Curso:</FormLabel>
                            <FormControl><Input placeholder="Ej: 8° Básico" {...field} className="w-40 text-base" /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                    </div>
                    <FormField control={form.control} name="areaConocimiento" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-[var(--text-accent)]">Área de Conocimiento</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecciona la materia..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="general">General / Interdisciplinario</SelectItem>
                            <SelectItem value="lenguaje">Lenguaje e Historia</SelectItem>
                            <SelectItem value="humanidades">Filosofía y Humanidades</SelectItem>
                            <SelectItem value="matematicas">Matemáticas</SelectItem>
                            <SelectItem value="ciencias">Ciencias</SelectItem>
                            <SelectItem value="ingles">Inglés</SelectItem>
                            <SelectItem value="artes">Artes</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="nivelEducativo" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-[var(--text-accent)]">Nivel Educativo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona el nivel de la evaluación" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Educación Básica">Educación Básica (1° a 8°)</SelectItem>
                            <SelectItem value="Educación Media">Educación Media (1° a 4°)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>Esto ajusta el rigor y la terminología de la IA.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="flexibilidad" render={({ field }) => (
                      <FormItem className="compact-field space-y-1">
                        <FormLabel className="text-[var(--text-accent)]">Nivel (flexibilidad)</FormLabel>
                        <FormControl>
                          <Slider min={1} max={5} step={1} defaultValue={field.value} onValueChange={field.onChange} />
                        </FormControl>
                        <div className="flex justify-between text-[10px] text-[var(--text-secondary)] range-hints">
                          <span>Estricto</span><span>Flexible</span>
                        </div>
                      </FormItem>
                    )} />
                    <div className="p-4 border rounded-lg border-[var(--border-color)]">
                      <h3 className="text-lg font-semibold mb-4 text-[var(--text-accent)]">Personalización del Informe</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="nombreProfesor" render={({ field }) => (
                          <FormItem><FormLabel className="text-[var(--text-accent)]">Nombre del Profesor</FormLabel><FormControl><Input placeholder="Ej: Juan Pérez" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="departamento" render={({ field }) => (
                          <FormItem><FormLabel className="text-[var(--text-accent)]">Departamento</FormLabel><FormControl><Input placeholder="Ej: Ciencias" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="asignatura" render={({ field }) => (
                          <FormItem><FormLabel className="text-[var(--text-accent)]">Asignatura</FormLabel><FormControl><Input placeholder="Ej: Lenguaje y Comunicación" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="nombrePrueba" render={({ field }) => (
                          <FormItem><FormLabel className="text-[var(--text-accent)]">Nombre de la Prueba</FormLabel><FormControl><Input placeholder="Ej: Ensayo Final" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="fechaEvaluacion" render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="text-[var(--text-accent)]">Fecha</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant={'outline'} className={cn('pl-3 text-left font-normal', !field.value && 'text-[var(--text-secondary)]')}>
                                    {field.value ? format(field.value, 'PPP') : <span>Elige una fecha</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                              </PopoverContent>
                            </Popover>
                          </FormItem>
                        )} />
                        <div className="space-y-2 col-span-full">
                          <Label className="text-[var(--text-accent)]">Logo del Colegio (Opcional)</Label>
                          <div className="flex items-center gap-4">
                            <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                              <ImageUp className="mr-2 h-4 w-4" />Subir Logo
                            </Button>
                            <input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoChange} className="hidden" />
                            {logoPreview && <img src={logoPreview} alt="Vista previa del logo" className="h-12 w-auto object-contain border p-1 rounded-md" />}
                          </div>
                        </div>
                      </div>
                    </div>
                    <FormField control={form.control} name="puntajeTotal" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-[var(--text-accent)]">Puntaje Total</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: 60" type="number" {...field} />
                        </FormControl>
                        <FormDescription>Ingresa el puntaje máximo de la evaluación. Esto es obligatorio.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="rubrica" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-[var(--text-accent)]">Rúbrica (Criterios)</FormLabel>
                        <FormControl><Textarea placeholder="Ej: Evalúa claridad, estructura, ortografía..." className="min-h-[100px]" {...field} /></FormControl>
                        <FormDescription>Describe los criterios de evaluación. Ya no es necesario incluir el puntaje total aquí.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="pauta" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-[var(--text-accent)]">Pauta (Respuestas)</FormLabel>
                        <FormControl><Textarea placeholder="Opcional. Pega aquí las respuestas correctas..." className="min-h-[100px]" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="evaluator-superior" className="space-y-8 mt-4">
            <div className="flex items-center gap-3">
              <img src={LIBELIA_LOGO_PNG_BASE64} alt="Logo Libel-IA" className="h-8 w-8" />
              <span className={`font-semibold text-xl ${wordmarkClass} font-logo`}>Evaluador Superior 🎓</span>
            </div>
            <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
              <CardHeader><CardTitle className="text-[var(--text-accent)]">Paso 1: Configuración de la Evaluación (Superior)</CardTitle></CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={(e) => { e.preventDefault(); onEvaluateAll(); }} className="space-y-8">
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 p-4 border rounded-lg border-[var(--border-color)]">
                      <div className="flex items-center space-x-3">
                        <Label htmlFor="class-size" className="text-base font-bold text-[var(--text-accent)]">Nº de Estudiantes:</Label>
                        <Input id="class-size" type="number" value={classSize} onChange={(e) => setClassSize(Number(e.target.value) || 1)} className="w-24 text-base" min={1} />
                      </div>
                      <div className="flex items-center space-x-3">
                        <FormField control={form.control} name="curso" render={({ field }) => (
                          <FormItem className="flex items-center space-x-3">
                            <FormLabel className="text-base font-bold mt-2 text-[var(--text-accent)]">Sección/Paralelo:</FormLabel>
                            <FormControl><Input placeholder="Ej: N-101, Diurno" {...field} className="w-40 text-base" /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                    </div>
                    <FormField control={form.control} name="areaConocimiento" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-[var(--text-accent)]">Área de Conocimiento</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecciona la materia..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="general">General / Interdisciplinario</SelectItem>
                            <SelectItem value="lenguaje">Lenguaje e Historia</SelectItem>
                            <SelectItem value="humanidades">Filosofía y Humanidades</SelectItem>
                            <SelectItem value="matematicas">Matemáticas</SelectItem>
                            <SelectItem value="ciencias">Ciencias</SelectItem>
                            <SelectItem value="ingles">Inglés</SelectItem>
                            <SelectItem value="artes">Artes</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="nivelEducativo" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-[var(--text-accent)]">Nivel Educativo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona el nivel de la evaluación" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Técnico Superior">Educación Técnico Profesional (IP/CFT)</SelectItem>
                            <SelectItem value="Universitario">Educación Universitaria (Pregrado)</SelectItem>
                            <SelectItem value="Postgrado">Postgrado (Magíster/Doctorado)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>Asegúrate de seleccionar una opción Superior para el rigor de la IA.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="flexibilidad" render={({ field }) => (
                      <FormItem className="compact-field space-y-1">
                        <FormLabel className="text-[var(--text-accent)]">Nivel (flexibilidad)</FormLabel>
                        <FormControl>
                          <Slider min={1} max={5} step={1} defaultValue={field.value} onValueChange={field.onChange} />
                        </FormControl>
                        <div className="flex justify-between text-[10px] text-[var(--text-secondary)] range-hints">
                          <span>Estricto</span><span>Flexible</span>
                        </div>
                      </FormItem>
                    )} />
                    <div className="p-4 border rounded-lg border-[var(--border-color)]">
                      <h3 className="text-lg font-semibold mb-4 text-[var(--text-accent)]">Personalización del Informe</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="nombreProfesor" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[var(--text-accent)]">Nombre del Docente</FormLabel>
                            <FormControl><Input placeholder="Ej: Juan Pérez" {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="departamento" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[var(--text-accent)]">Escuela/Carrera</FormLabel>
                            <FormControl><Input placeholder="Ej: Ingeniería, Trabajo Social" {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="asignatura" render={({ field }) => (
                          <FormItem><FormLabel className="text-[var(--text-accent)]">Asignatura</FormLabel><FormControl><Input placeholder="Ej: Lenguaje y Comunicación" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="nombrePrueba" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[var(--text-accent)]">Nombre de la Evaluación/Certamen</FormLabel>
                            <FormControl><Input placeholder="Ej: Certamen N°2" {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="fechaEvaluacion" render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="text-[var(--text-accent)]">Fecha</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant={'outline'} className={cn('pl-3 text-left font-normal', !field.value && 'text-[var(--text-secondary)]')}>
                                    {field.value ? format(field.value, 'PPP') : <span>Elige una fecha</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                              </PopoverContent>
                            </Popover>
                          </FormItem>
                        )} />
                        <div className="space-y-2 col-span-full">
                          <Label className="text-[var(--text-accent)]">Logo del Colegio (Opcional)</Label>
                          <div className="flex items-center gap-4">
                            <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                              <ImageUp className="mr-2 h-4 w-4" />Subir Logo
                            </Button>
                            <input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoChange} className="hidden" />
                            {logoPreview && <img src={logoPreview} alt="Vista previa del logo" className="h-12 w-auto object-contain border p-1 rounded-md" />}
                          </div>
                        </div>
                      </div>
                    </div>
                    <FormField control={form.control} name="puntajeTotal" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-[var(--text-accent)]">Puntaje Total</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: 60" type="number" {...field} />
                        </FormControl>
                        <FormDescription>Ingresa el puntaje máximo de la evaluación. Esto es obligatorio.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="rubrica" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-[var(--text-accent)]">Rúbrica (Criterios)</FormLabel>
                        <FormControl><Textarea placeholder="Ej: Evalúa claridad, estructura, ortografía..." className="min-h-[100px]" {...field} /></FormControl>
                        <FormDescription>Describe los criterios de evaluación. Ya no es necesario incluir el puntaje total aquí.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="pauta" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-[var(--text-accent)]">Pauta (Respuestas)</FormLabel>
                        <FormControl><Textarea placeholder="Opcional. Pega aquí las respuestas correctas..." className="min-h-[100px]" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          {(activeTab === 'evaluator' || activeTab === 'evaluator-superior') && (
            <>
              <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
                <CardHeader>
                  <CardTitle className="text-[var(--text-accent)]">Paso 2: Cargar y Agrupar Trabajos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-bold text-[var(--text-accent)]">Cargar Archivos</h3>
                    <div className="flex flex-wrap gap-4 mt-2 items-center">
                      <Button type="button" onClick={() => { fileInputRef.current?.click(); }}>
                        <FileUp className="mr-2 h-4 w-4" /> Subir Archivos
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setIsCameraOpen(true)}>
                        <Camera className="mr-2 h-4 w-4" /> Usar Cámara
                      </Button>
                      <input type="file" multiple accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ref={fileInputRef} onChange={handleFilesSelected} className="hidden" />
                      <p className="text-sm text-[var(--text-secondary)]">Consejo: Sube primero la página con el nombre.</p>
                    </div>
                  </div>
                  {unassignedFiles.length > 0 && (
                    <div className="p-4 border rounded-lg bg-[var(--bg-muted-subtle)] border-[var(--border-color)]">
                      <h3 className="font-semibold mb-3 flex items-center text-[var(--text-accent)]">
                        <ClipboardList className="mr-2 h-5 w-5" /> Archivos Pendientes
                      </h3>
                      <div className="flex flex-wrap gap-4 items-center">
                        {/* ✅ USO DE renderFilePreview */}
                        {unassignedFiles.map(file => (
                          <div key={file.id} className="relative w-24 h-24">
                            {renderFilePreview(file)}
                            <button onClick={() => removeUnassignedFile(file.id)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors" aria-label="Eliminar archivo">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <Button type="button" variant="outline" onClick={handleNameExtraction} disabled={isExtractingNames} className="self-center">
                          {isExtractingNames ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-purple-500" />} Detectar Nombre
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              {studentGroups.length > 0 && (
                <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[var(--text-accent)]">
                      <Users className="text-green-500" />Grupos de Estudiantes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {studentGroups.map(group => (
                      <div key={group.id} className="border p-4 rounded-lg border-[var(--border-color)]">
                        <Input className="text-lg font-bold border-0 shadow-none focus-visible:ring-0 p-1 mb-2 bg-transparent" value={group.studentName} onChange={(e) => updateStudentName(group.id, e.target.value)} />
                        <div className="flex flex-wrap gap-2 min-h-[50px] bg-[var(--bg-muted-subtle)] p-2 rounded-md">
                          {/* ✅ USO DE renderFilePreview */}
                          {group.files.map(file => (
                            <div key={file.id} className="relative w-20 h-20">
                              {renderFilePreview(file)}
                              <button onClick={() => removeFileFromGroup(file.id, group.id)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          {unassignedFiles.length > 0 && (
                            <div className="flex items-center justify-center w-20 h-20 border-2 border-dashed rounded-md border-[var(--border-color)]">
                              <select onChange={(e) => { if (e.target.value) assignFileToGroup(e.target.value, group.id); e.target.value = ''; }} className="text-sm bg-transparent">
                                <option value="">Asignar</option>
                                {unassignedFiles.map(f => <option key={f.id} value={f.id}>{f.file.name}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                  <CardFooter>
                    <Button size="lg" onClick={onEvaluateAll} disabled={isCurrentlyEvaluatingAny || studentGroups.every(g => g.files.length === 0)}>
                      {isLoading || isCurrentlyEvaluatingAny ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Evaluando...</> : <><Sparkles className="mr-2 h-4 w-4" /> Evaluar Todo</>}
                    </Button>
                  </CardFooter>
                </Card>
              )}
              {studentGroups.some(g => g.isEvaluated || g.isEvaluating) && (
                <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
                  <CardHeader><CardTitle className="text-[var(--text-accent)]">Paso 3: Resultados</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {studentGroups.filter(g => g.isEvaluated || g.isEvaluating).map(group => {
                      const notaNumber = Number(group.nota) || 0;
                      const finalNota = notaNumber + (group.decimasAdicionales || 0);
                      return (
                        <div key={group.id} className={`p-6 rounded-lg border-l-4 ${group.error ? 'border-red-500' : 'border-green-500'} bg-[var(--bg-card)] shadow`}>
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <h3 className="font-bold text-xl text-[var(--text-accent)]">{group.studentName}</h3>
                            {group.isEvaluating && <div className="flex items-center text-sm text-[var(--text-secondary)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</div>}
                            {group.isEvaluated && !group.error && (
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => handlePreview(group.id)}>
                                  <Eye className="mr-2 h-4 w-4" /> Ver informe
                                </Button>
                                <PDFDownloadLink
                                  document={<ReportDocument group={group} formData={form.getValues()} logoPreview={logoPreview} />}
                                  fileName={`informe_${group.studentName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`}
                                >
                                  {({ loading }) => (
                                    <Button variant="ghost" size="sm" disabled={loading}>
                                      {loading ? 'Preparando PDF...' : <><Printer className="mr-2 h-4 w-4" /> Descargar PDF</>}
                                    </Button>
                                  )}
                                </PDFDownloadLink>
                              </div>
                            )}
                          </div>
                          {group.error ? (
                            <p className="text-red-600">Error: {group.error}</p>
                          ) : (
                            <div className="mt-4 space-y-6">
                              {group.isEvaluated && group.retroalimentacion && (
                                <>
                                  <div className="flex justify-between items-start bg-[var(--bg-muted-subtle)] p-4 rounded-lg">
                                    <div>
                                      <p className="text-sm font-bold">PUNTAJE</p>
                                      <Input
                                        className="text-xl font-semibold w-24 h-12 text-center"
                                        type="text"
                                        value={typeof group.puntaje === 'object' ? JSON.stringify(group.puntaje) : (group.puntaje || '')}
                                        onChange={e => handlePuntajeChange(group.id, e.target.value)}
                                        placeholder="N/A"
                                      />
                                    </div>
                                    <div className="text-right">
                                      <div className="flex items-center gap-2">
                                        <label htmlFor={`decimas-${group.id}`} className="text-sm font-medium">Décimas:</label>
                                        <Input id={`decimas-${group.id}`} type="number" step={0.1} defaultValue={group.decimasAdicionales} onChange={e => handleDecimasChange(group.id, e.target.value)} className="h-8 w-20" />
                                      </div>
                                      <p className="text-sm font-bold mt-2">NOTA FINAL</p>
                                      <Input
                                        className="text-3xl font-bold w-24 h-12 text-center text-blue-600 border-none bg-transparent"
                                        type="number"
                                        step={0.1}
                                        value={String(Number(group.nota || 0) + (group.decimasAdicionales || 0))}
                                        onChange={e => handleNotaChange(group.id, e.target.value)}
                                        placeholder="N/A"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="font-bold mb-2 text-[var(--text-accent)]">Corrección Detallada</h4>
                                    <div className="overflow-x-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Sección</TableHead>
                                            <TableHead>Detalle</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {group.retroalimentacion.correccion_detallada?.map((item, index) => (
                                            <TableRow key={index}>
                                              <TableCell className="font-medium">{renderForWeb(item.seccion)}</TableCell>
                                              <TableCell>{renderForWeb(item.detalle)}</TableCell>
                                            </TableRow>
                                          ))}
                                          {Object.keys(group.detalle_desarrollo || {}).map(key => {
                                            const item = group.detalle_desarrollo?.[key];
                                            if (!item) return null;
                                            return (
                                              <TableRow key={key}>
                                                <TableCell className="font-medium text-purple-600">{key.replace(/_/g, ' ')}</TableCell>
                                                <TableCell>
                                                  <p className='font-semibold text-sm mb-1'>Puntaje: {item.puntaje}</p>
                                                  <p className='text-xs italic text-[var(--text-secondary)] mb-1'>Cita Estudiante: &quot;{item.cita_estudiante}&quot;</p>
                                                  <p className='text-sm'>{item.justificacion}</p>
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="font-bold mb-2 text-[var(--text-accent)]">Evaluación de Habilidades</h4>
                                    <div className="overflow-x-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Habilidad</TableHead>
                                            <TableHead>Nivel</TableHead>
                                            <TableHead>Evidencia</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {group.retroalimentacion.evaluacion_habilidades?.map((item, index) => (
                                            <TableRow key={index}>
                                              <TableCell className="font-medium">{renderForWeb(item.habilidad)}</TableCell>
                                              <TableCell>{renderForWeb(item.evaluacion)}</TableCell>
                                              <TableCell className="italic">&quot;{renderForWeb(item.evidencia)}&quot;</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                    <div>
                                      <h4 className="font-bold text-[var(--text-accent)]">Fortalezas</h4>
                                      <div className="text-sm mt-2 p-3 bg-[var(--bg-muted-subtle)] border border-[var(--border-color)] rounded-lg">
                                        {renderForWeb(group.retroalimentacion.resumen_general?.fortalezas)}
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-[var(--text-accent)]">Áreas de Mejora</h4>
                                      <div className="text-sm mt-2 p-3 bg-[var(--bg-muted-subtle)] border border-[var(--border-color)] rounded-lg">
                                        {renderForWeb(group.retroalimentacion.resumen_general?.areas_mejora)}
                                      </div>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </>
          )}
          <TabsContent value="dashboard" className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-[var(--text-accent)]">Resumen de Notas</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => exportToDocOrCsv('csv')}>Exportar CSV</Button>
                <Button onClick={() => exportToDocOrCsv('doc')}>Exportar Word</Button>
              </div>
            </div>
            <NotesDashboard studentGroups={studentGroups} curso={form.getValues('curso')} fecha={form.getValues('fechaEvaluacion')} />
          </TabsContent>
          <TabsContent value="presentacion" className="mt-8">
            <Card className="max-w-4xl mx-auto border-2 shadow-xl bg-[var(--bg-card)] border-[var(--border-color)] p-10 text-center">
              <img src={LIBELIA_LOGO_PNG_BASE64} alt="Logo Libel-IA" className="mx-auto h-20 w-20 mb-6" />
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
    </div>
  );
}