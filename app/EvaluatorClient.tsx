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
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Sparkles, FileUp, Camera, Users, X, Printer, CalendarIcon, ImageUp, ClipboardList, Home, Palette, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

// App hooks/components (tus originales)
import { useEvaluator } from './useEvaluator';
import { NotesDashboard } from '../components/NotesDashboard';

// PDF
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image as PDFImage, PDFViewer, pdf } from '@react-pdf/renderer';

const SmartCameraModal = dynamic(() => import('../components/smart-camera-modal'), { ssr: false, loading: () => <p>Cargando...</p> });

const Label = React.forwardRef<HTMLLabelElement, React.ComponentPropsWithoutRef<'label'>>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('text-sm font-medium', className)} {...props} />
));
Label.displayName = 'Label';

// ==== Logo ====
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
    /* Modal PDF */
    .pdf-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 60; }
    .pdf-modal { width: 95vw; height: 90vh; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
    .pdf-modal-header { padding: 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); }
    .pdf-modal-body { flex: 1; }
    .pdf-modal-actions { display: flex; gap: 8px; }
    /* Bloque "Nivel" compacto en UI */
    .compact-field { margin-top: 4px; }
    .compact-field label { font-size: 12px; font-weight: 600; margin-bottom: 2px; }
    .compact-field .range-hints { font-size: 10px; margin-top: 2px; }
    @media (max-width: 600px) { body { font-size: 12px; line-height: 1.4; } }
  `}</style>
);

// ==== Estilos PDF (compactos; sin cortes a la derecha) ====
const styles = StyleSheet.create({
  page: { padding: 20, fontSize: 10, lineHeight: 1.25 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { textAlign: 'right' },
  logoLibelia: { height: 28, width: 28 },
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

  table: { display: 'table', width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 6 },
  tableRow: { margin: 'auto', flexDirection: 'row', borderBottomWidth: 1, borderColor: '#E5E7EB' },
  tableColHeader: { width: '35%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', padding: 2 },
  tableColHeaderDetail: { width: '65%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', padding: 2 },
  tableCol: { width: '35%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', padding: 2 },
  tableColDetail: { width: '65%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', padding: 2 },

  // Alternativas 40/30/30
  col40: { width: '40%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', padding: 2 },
  col30: { width: '30%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', padding: 2 },

  // Habilidades: Nivel delgado (45/18/37)
  habCol45: { width: '45%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', padding: 2 },
  habCol18: { width: '18%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', padding: 2, textAlign: 'center' as any },
  habCol37: { width: '37%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB', padding: 2 },

  tableCellHeader: { margin: 1, fontSize: 8, fontWeight: 'bold' },
  tableCell: { margin: 1, fontSize: 8, flexWrap: 'wrap' as any, textAlign: 'left' as any },

  section: { marginBottom: 6, breakInside: 'avoid' as any },

  // Mini tarjetas para llenar bien la P1
  miniGrid: { flexDirection: 'row', gap: 6, marginTop: 6 },
  miniCard: { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', padding: 5, borderRadius: 6, textAlign: 'center' as any },
  miniLabel: { fontSize: 8, fontWeight: 'bold', color: '#4B5563', marginBottom: 2 },
  miniValue: { fontSize: 11, fontWeight: 'bold', color: '#4F46E5' },
});

// ====== Helpers para balancear las 2 páginas ======
const splitCorreccionForTwoPages = (lista: any[] | undefined) => {
  if (!lista || lista.length === 0) return { first: [], rest: [] };
  // Máximo conservador para P1 para no empujar a P2 “en blanco”
  const MAX_P1 = Math.min(5, lista.length); // 4-5 filas suelen caber con fortalezas/áreas y KPIs
  return { first: lista.slice(0, MAX_P1), rest: lista.slice(MAX_P1) };
};

// ==== Documento PDF: P1 llena, P2 continúa; sin saltos raros ====
const ReportDocument = ({ group, formData, logoPreview }: any) => {
  const resumen = group.retroalimentacion?.resumen_general || { fortalezas: 'N/A', areas_mejora: 'N/A' };
  const puntaje = group.puntaje || 'N/A';
  const notaNum = Number(group.nota) || 0;
  const notaFinal = (notaNum + (group.decimasAdicionales || 0)).toFixed(1);

  const correccion = group.retroalimentacion?.correccion_detallada || [];
  const { first: correccionP1, rest: correccionP2 } = splitCorreccionForTwoPages(correccion);

  return (
    <Document>
      {/* Página 1 */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <PDFImage src={DRAGONFLY_DATA_URL} style={styles.logoLibelia} />
            <View>
              <Text style={styles.title}>Libel-IA</Text>
              <Text style={styles.subtitle}>Informe de Evaluación Pedagógica</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {logoPreview && <PDFImage src={logoPreview} style={styles.logoColegio} />}
            <Text style={styles.infoText}>Profesor: {formData.nombreProfesor || 'N/A'}</Text>
            <Text style={styles.infoText}>Asignatura: {formData.asignatura || 'N/A'}</Text>
            <Text style={styles.infoText}>Evaluación: {formData.nombrePrueba || 'N/A'}</Text>
            <Text style={styles.infoText}>Fecha: {format(new Date(), 'dd/MM/yyyy')}</Text>
          </View>
        </View>

        <Text style={styles.studentLine}>Alumno: {group.studentName} · Curso: {formData.curso || 'N/A'}</Text>

        {/* KPIs */}
        <View style={styles.miniGrid}>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>Puntaje</Text>
            <Text style={styles.miniValue}>{puntaje}</Text>
          </View>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>Nota</Text>
            <Text style={styles.miniValue}>{notaFinal}</Text>
          </View>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>Fecha</Text>
            <Text style={styles.miniValue}>{format(new Date(), 'dd/MM/yyyy')}</Text>
          </View>
        </View>

        {/* Fortalezas / Áreas */}
        <View style={styles.feedbackGrid}>
          <View style={[styles.feedbackCard, styles.fortalezas]}>
            <Text style={styles.feedbackTitle}>✅ Fortalezas</Text>
            <Text style={styles.feedbackText}>{resumen.fortalezas}</Text>
          </View>
          <View style={[styles.feedbackCard, styles.areasMejora]}>
            <Text style={styles.feedbackImproveTitle}>✏️ Áreas de Mejora</Text>
            <Text style={styles.feedbackText}>{resumen.areas_mejora}</Text>
          </View>
        </View>

        {/* Corrección Detallada (solo primeras filas, sin wrap para no empujar salto raro) */}
        {correccionP1.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Corrección Detallada</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, { backgroundColor: '#F9FAFB' }]}>
                <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Sección</Text></View>
                <View style={styles.tableColHeaderDetail}><Text style={styles.tableCellHeader}>Detalle</Text></View>
              </View>
              {correccionP1.map((item: any, index: number) => (
                <View key={index} style={styles.tableRow}>
                  <View style={styles.tableCol}><Text style={styles.tableCell}>{item.seccion}</Text></View>
                  <View style={styles.tableColDetail}><Text style={styles.tableCell}>{item.detalle}</Text></View>
                </View>
              ))}
            </View>
          </View>
        )}
      </Page>

      {/* Página 2 */}
      <Page size="A4" style={styles.page}>
        {/* Resto de Corrección */}
        {correccionP2.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Corrección Detallada (cont.)</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, { backgroundColor: '#F9FAFB' }]}>
                <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Sección</Text></View>
                <View style={styles.tableColHeaderDetail}><Text style={styles.tableCellHeader}>Detalle</Text></View>
              </View>
              {correccionP2.map((item: any, index: number) => (
                <View key={index} style={styles.tableRow}>
                  <View style={styles.tableCol}><Text style={styles.tableCell}>{item.seccion}</Text></View>
                  <View style={styles.tableColDetail}><Text style={styles.tableCell}>{item.detalle}</Text></View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Habilidades */}
        {group.retroalimentacion?.evaluacion_habilidades?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Evaluación de Habilidades</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, { backgroundColor: '#F9FAFB' }]}>
                <View style={styles.habCol45}><Text style={styles.tableCellHeader}>Habilidad</Text></View>
                <View style={styles.habCol18}><Text style={styles.tableCellHeader}>Nivel</Text></View>
                <View style={styles.habCol37}><Text style={styles.tableCellHeader}>Evidencia</Text></View>
              </View>
              {group.retroalimentacion.evaluacion_habilidades.map((item: any, index: number) => (
                <View key={index} style={styles.tableRow}>
                  <View style={styles.habCol45}><Text style={styles.tableCell}>{item.habilidad}</Text></View>
                  <View style={styles.habCol18}><Text style={styles.tableCell}>{item.evaluacion}</Text></View>
                  <View style={styles.habCol37}><Text style={styles.tableCell}>{item.evidencia}</Text></View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Alternativas */}
        {group.retroalimentacion?.retroalimentacion_alternativas?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Respuestas Alternativas</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, { backgroundColor: '#F9FAFB' }]}>
                <View style={styles.col40}><Text style={styles.tableCellHeader}>Pregunta</Text></View>
                <View style={styles.col30}><Text style={styles.tableCellHeader}>Respuesta Estudiante</Text></View>
                <View style={styles.col30}><Text style={styles.tableCellHeader}>Respuesta Correcta</Text></View>
              </View>
              {group.retroalimentacion.retroalimentacion_alternativas.map((item: any, index: number) => (
                <View key={index} style={styles.tableRow}>
                  <View style={styles.col40}><Text style={styles.tableCell}>{item.pregunta}</Text></View>
                  <View style={styles.col30}><Text style={styles.tableCell}>{item.respuesta_estudiante}</Text></View>
                  <View style={styles.col30}><Text style={styles.tableCell}>{item.respuesta_correcta}</Text></View>
                </View>
              ))}
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
};

// ==== Tipos (coinciden con tu flujo) ====
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
}

// ==== Componente Principal ====
export default function EvaluatorClient() {
  const [unassignedFiles, setUnassignedFiles] = useState<FilePreview[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [classSize, setClassSize] = useState(1);
  const [isExtractingNames, setIsExtractingNames] = useState(false);
  const [theme, setTheme] = useState('theme-ocaso');
  const [activeTab, setActiveTab] = useState('inicio');

  // NUEVO: modal de vista previa (desktop) / blob (móvil)
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

  // Inicializar grupos con tamaño de curso
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

  // === Funciones existentes (no tocadas) ===
  const processFiles = (files: File[]) => {
    const validFiles = Array.from(files).filter(file => {
      if (['image/jpeg', 'image/png', 'image/bmp', 'application/pdf', 'image/tiff'].includes(file.type)) return true;
      alert(`Formato no soportado para "${file.name}". Usa: JPEG, PNG, BMP, PDF o TIFF.`);
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
  const handleFilesSelected = (files: FileList | null) => { if (files) processFiles(Array.from(files)); };
  const handleCapture = (dataUrl: string) => {
    fetch(dataUrl).then(res => res.blob()).then(blob => {
      processFiles([new File([blob], `captura-${Date.now()}.png`, { type: 'image/png' })]);
    });
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
  const removeUnassignedFile = (fileId: string) => { setUnassignedFiles(prev => prev.filter(f => f.id !== fileId)); };

  const handleNameExtraction = async () => {
    if (unassignedFiles.length === 0) {
      alert('Sube primero la página que contiene el nombre.');
      return;
    }
    setIsExtractingNames(true);
    const formDataFD = new FormData();
    formDataFD.append('files', unassignedFiles[0].file);
    try {
      const response = await fetch('/api/extract-name', { method: 'POST', body: formDataFD });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Error desconocido.');
      if (data.suggestions && data.suggestions.length > 0) {
        const bestSuggestion = data.suggestions[0];
        alert(`Sugerencia detectada: ${bestSuggestion}`);
        const firstDefaultStudentIndex = studentGroups.findIndex(g => g.studentName.startsWith('Alumno'));
        if (firstDefaultStudentIndex !== -1) updateStudentName(studentGroups[firstDefaultStudentIndex].id, bestSuggestion);
      } else alert('No se detectaron nombres en la imagen.');
    } catch (error) {
      console.error('Error en extracción:', error);
      alert(`Error al extraer nombres: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsExtractingNames(false);
    }
  };

  const onEvaluateAll = async () => {
    const { rubrica, pauta, flexibilidad, tipoEvaluacion, areaConocimiento } = form.getValues();
    if (!rubrica) {
      form.setError('rubrica', { type: 'manual', message: 'La rúbrica es requerida.' });
      return;
    }
    for (const group of studentGroups) {
      if (group.files.length === 0) continue;
      setStudentGroups(prev => prev.map(g => g.id === group.id ? { ...g, isEvaluating: true, isEvaluated: false, error: undefined } : g));
      const payload = { fileUrls: group.files.map(f => f.dataUrl), rubrica, pauta, flexibilidad: flexibilidad[0], tipoEvaluacion, areaConocimiento };
      const result = await evaluate(payload);
      setStudentGroups(prev => prev.map(g => g.id === group.id ? { ...g, isEvaluating: false, isEvaluated: true, ...(result.success ? result : { error: result.error }) } : g));
    }
  };

  const exportToDocOrCsv = (formatType: 'csv' | 'doc') => {
    const { curso, fechaEvaluacion } = form.getValues();
    const fechaStr = fechaEvaluacion ? format(fechaEvaluacion, 'dd/MM/yyyy') : '';
    const evaluatedGroups = studentGroups.filter(g => g.isEvaluated);
    if (evaluatedGroups.length === 0) {
      alert('No hay evaluaciones para exportar.');
      return;
    }
    // Mantén tu export original aquí (no se modifica)
  };

  const isCurrentlyEvaluatingAny = studentGroups.some(g => g.isEvaluating);
  const previewGroup = previewGroupId ? studentGroups.find(g => g.id === previewGroupId) : null;

  // ==== Vista previa: desktop modal / móvil nueva pestaña (blob) ====
  const handlePreview = async (groupId: string) => {
    const group = studentGroups.find(g => g.id === groupId);
    if (!group || !group.retroalimentacion) return;

    if (isMobile) {
      // Generar blob y abrir en nueva pestaña (mejor compatibilidad móvil)
      const blob = await pdf(<ReportDocument group={group} formData={form.getValues()} logoPreview={logoPreview} />).toBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } else {
      setPreviewGroupId(groupId); // modal con PDFViewer en desktop
    }
  };

  return (
    <div className={activeTab === 'inicio' ? 'theme-ocaso' : theme}>
      <GlobalStyles />
      {isCameraOpen && <SmartCameraModal onCapture={handleCapture} onClose={() => setIsCameraOpen(false)} />}

      {/* MODAL de Vista Previa PDF (desktop) */}
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
          <TabsList className="grid w-full grid-cols-3 bg-[var(--bg-muted)]">
            <TabsTrigger value="inicio"><Home className="mr-2 h-4 w-4" />Inicio</TabsTrigger>
            <TabsTrigger value="evaluator"><Sparkles className="mr-2 h-4 w-4" />Evaluador</TabsTrigger>
            <TabsTrigger value="dashboard"><ClipboardList className="mr-2 h-4 w-4" />Resumen</TabsTrigger>
          </TabsList>

          <TabsContent value="inicio" className="mt-8 text-center">
            <Card className="max-w-3xl mx-auto border-2 shadow-lg bg-[var(--bg-card)] border-[var(--border-color)]" style={{ backgroundImage: 'radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, rgba(9, 9, 11, 0) 70%)' }}>
              <CardContent className="p-12">
                <img src={DRAGONFLY_DATA_URL} alt="Logo" className="mx-auto h-36 w-36 mb-4" />
                <h1 className={`text-6xl font-bold ${wordmarkClass} font-logo`}>Libel-IA</h1>
                <p className="mt-3 text-xl italic text-cyan-300">“Evaluación con Inteligencia Docente: Hecha por un Profe, para Profes”</p>
                <p className="mt-6 text-lg text-[var(--text-secondary)]">Asistente pedagógico inteligente que analiza las respuestas de tus estudiantes, genera retroalimentación detallada y crea informes al instante.</p>
                <Button size="lg" className="mt-8 text-lg py-6 px-8" onClick={() => setActiveTab('evaluator')}>
                  Comenzar a Evaluar <Sparkles className="ml-2 h-5 w-5" />
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evaluator" className="space-y-8 mt-4">
            <div className="flex items-center gap-3">
              <img src={DRAGONFLY_DATA_URL} alt="Logo Libel-IA" className="h-8 w-8" />
              <span className={`font-semibold text-xl ${wordmarkClass} font-logo`}>Libel-IA</span>
            </div>

            <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
              <CardHeader><CardTitle className="text-[var(--text-accent)]">Paso 1: Configuración de la Evaluación</CardTitle></CardHeader>
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

                    {/* ---- BLOQUE "NIVEL" COMPACTO ---- */}
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

                    <FormField control={form.control} name="rubrica" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-[var(--text-accent)]">Rúbrica (Criterios)</FormLabel>
                        <FormControl><Textarea placeholder="Ej: Evalúa claridad, estructura, ortografía..." className="min-h-[100px]" {...field} /></FormControl>
                        <FormDescription>Importante: Incluye el puntaje total de la evaluación (Ej: "Puntaje total: 60 puntos").</FormDescription>
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

            {/* Paso 2: Cargar y agrupar (igual) */}
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
                    <input type="file" multiple ref={fileInputRef} onChange={(e) => handleFilesSelected(e.target.files)} className="hidden" />
                    <p className="text-sm text-[var(--text-secondary)]">Consejo: Sube primero la página con el nombre.</p>
                  </div>
                </div>

                {unassignedFiles.length > 0 && (
                  <div className="p-4 border rounded-lg bg-[var(--bg-muted-subtle)] border-[var(--border-color)]">
                    <h3 className="font-semibold mb-3 flex items-center text-[var(--text-accent)]">
                      <ClipboardList className="mr-2 h-5 w-5" /> Archivos Pendientes
                    </h3>
                    <div className="flex flex-wrap gap-4 items-center">
                      {unassignedFiles.map(file => (
                        <div key={file.id} className="relative w-24 h-24">
                          <img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-cover rounded-md" />
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

            {/* Grupos */}
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
                        {group.files.map(file => (
                          <div key={file.id} className="relative w-20 h-20">
                            <img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-cover rounded-md" />
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

            {/* Resultados */}
            {studentGroups.some(g => g.isEvaluated || g.isEvaluating) && (
              <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
                <CardHeader><CardTitle className="text-[var(--text-accent)]">Paso 3: Resultados</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {studentGroups.filter(g => g.isEvaluated || g.isEvaluating).map(group => {
                    const finalNota = (Number(group.nota) || 0) + group.decimasAdicionales;
                    return (
                      <div key={group.id} className={`p-6 rounded-lg border-l-4 ${group.error ? 'border-red-500' : 'border-green-500'} bg-[var(--bg-card)] shadow`}>
                        <div className="flex justify-between items-center flex-wrap gap-2">
                          <h3 className="font-bold text-xl text-[var(--text-accent)]">{group.studentName}</h3>
                          {group.isEvaluating && <div className="flex items-center text-sm text-[var(--text-secondary)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</div>}
                          {group.isEvaluated && !group.error && (
                            <div className="flex items-center gap-2">
                              {/* Ver informe (modal desktop / blob móvil) */}
                              <Button variant="outline" size="sm" onClick={() => handlePreview(group.id)}>
                                <Eye className="mr-2 h-4 w-4" /> Ver informe
                              </Button>
                              {/* Descargar PDF */}
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
                                    <p className="text-xl font-semibold">{group.puntaje || 'N/A'}</p>
                                  </div>
                                  <div className="text-right">
                                    <div className="flex items-center gap-2">
                                      <label htmlFor={`decimas-${group.id}`} className="text-sm font-medium">Décimas:</label>
                                      <Input id={`decimas-${group.id}`} type="number" step={0.1} defaultValue={group.decimasAdicionales} onChange={e => handleDecimasChange(group.id, e.target.value)} className="h-8 w-20" />
                                    </div>
                                    <p className="text-sm font-bold mt-2">NOTA FINAL</p>
                                    <p className="text-3xl font-bold text-blue-600">{finalNota.toFixed(1)}</p>
                                  </div>
                                </div>

                                {/* Pantalla: tablas/resumen sin cambios */}
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
                                            <TableCell className="font-medium">{item.seccion}</TableCell>
                                            <TableCell>{item.detalle}</TableCell>
                                          </TableRow>
                                        ))}
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
                                            <TableCell className="font-medium">{item.habilidad}</TableCell>
                                            <TableCell>{item.evaluacion}</TableCell>
                                            <TableCell className="italic">"{item.evidencia}"</TableCell>
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
                                      {group.retroalimentacion.resumen_general?.fortalezas}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-[var(--text-accent)]">Áreas de Mejora</h4>
                                    <div className="text-sm mt-2 p-3 bg-[var(--bg-muted-subtle)] border border-[var(--border-color)] rounded-lg">
                                      {group.retroalimentacion.resumen_general?.areas_mejora}
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
          </TabsContent>

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
        </Tabs>
      </main>
    </div>
  );
}