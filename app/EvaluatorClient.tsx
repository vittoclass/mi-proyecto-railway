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
import { Loader2, Sparkles, FileUp, Camera, Users, X, Printer, CalendarIcon, ImageUp, ClipboardList, Home, Palette, Eye, Bug } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Tus imports ---
import { NotesDashboard } from '@/components/NotesDashboard';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image as PDFImage, PDFViewer, pdf } from '@react-pdf/renderer';
import { useEvaluator } from './useEvaluator';
const SmartCameraModal = dynamic(() => import('@/components/smart-camera-modal'), { ssr: false, loading: () => <p>Cargando...</p> });
const Label = React.forwardRef<HTMLLabelElement, React.ComponentPropsWithoutRef<'label'>>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('text-sm font-medium', className)} {...props} />
));
Label.displayName = 'Label';

// --- Tus constantes y estilos (sin cambios) ---
const DRAGONFLY_SVG = `...`;
const DRAGONFLY_DATA_URL = `...`;
const wordmarkClass = '...';
const GlobalStyles = () => ( <style jsx global>{`...`}</style> );
const styles = StyleSheet.create({ /* ... tus estilos PDF ... */ });
const splitCorreccionForTwoPages = (lista: any[] | undefined) => { /* ... tu helper ... */ };

// --- CAMBIO CLAVE: Componente PDF más robusto y con la corrección del logo ---
const ReportDocument = ({ group, formData, logoPreview }: any) => {
  const retro = group.retroalimentacion || {};
  const resumen = retro.resumen_general || { fortalezas: 'N/A', areas_mejora: 'N/A' };
  const correccion = retro.correccion_detallada || [];
  const habilidades = retro.evaluacion_habilidades || [];
  const alternativas = retro.retroalimentacion_alternativas || [];
  
  const { first: correccionP1, rest: correccionP2 } = splitCorreccionForTwoPages(correccion);

  return (
    <Document>
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
            {/* --- SOLUCIÓN: Se añade una verificación para el logo antes de renderizarlo --- */}
            {logoPreview && typeof logoPreview === 'string' && logoPreview.startsWith('data:image') ? (
              <PDFImage src={logoPreview} style={styles.logoColegio} />
            ) : null}
            <Text style={styles.infoText}>Profesor: {formData.nombreProfesor || 'N/A'}</Text>
            <Text style={styles.infoText}>Asignatura: {formData.asignatura || 'N/A'}</Text>
            <Text style={styles.infoText}>Evaluación: {formData.nombrePrueba || 'N/A'}</Text>
            <Text style={styles.infoText}>Fecha: {format(new Date(), 'dd/MM/yyyy')}</Text>
          </View>
        </View>
        {/* ... (El resto de tu documento PDF se mantiene igual) ... */}
      </Page>
    </Document>
  );
};


// ==== Tipos (Actualizados) ====
const formSchema = z.object({
  rubrica: z.string().min(10, 'La rúbrica es necesaria.'),
  puntajeTotal: z.string().min(1, 'El puntaje total es obligatorio.').regex(/^[0-9]+$/, 'El puntaje debe ser un número entero.'),
  pauta: z.string().optional(),
  flexibilidad: z.array(z.number()).default([3]),
  nombreProfesor: z.string().optional(),
  nombrePrueba: z.string().optional(),
  asignatura: z.string().optional(),
  curso: z.string().optional(),
  areaConocimiento: z.string().default('general'),
});
interface FilePreview { id: string; file: File; previewUrl: string; dataUrl: string; }
interface StudentGroup {
  id: string;
  studentName: string;
  files: FilePreview[];
  studentAnswers: string;
  puntajeDesarrollo: number;
  retroalimentacion?: any;
  puntaje?: string;
  nota?: number | string;
  isEvaluated: boolean;
  isEvaluating: boolean;
  error?: string;
  debugPayload?: object; // Para el depurador visual
}

// --- Funciones de ayuda (sin cambios) ---
const parseAnswers = (text: string | undefined): { [key: string]: string } => {
  if (!text) return {};
  const answers: { [key: string]: string } = {};
  text.split(',').map(part => part.trim()).filter(Boolean).forEach(part => {
    const match = part.match(/^(\d+)\s*([a-zA-ZfFvV])/);
    if (match) answers[match[1]] = match[2].toLowerCase();
  });
  return answers;
};

// ==== Componente Principal ====
export default function EvaluatorClient() {
  const [activeTab, setActiveTab] = useState('evaluator');
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [classSize, setClassSize] = useState(1);
  const [debugGroupId, setDebugGroupId] = useState<string | null>(null);
  const { evaluate, isLoading } = useEvaluator();
  // ... (otros estados sin cambios)
  const [unassignedFiles, setUnassignedFiles] = useState<FilePreview[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rubrica: '',
      puntajeTotal: '100',
      pauta: '',
      flexibilidad: [3],
      nombreProfesor: '',
      nombrePrueba: '',
      asignatura: '',
      curso: '',
      areaConocimiento: 'general',
    },
  });

  useEffect(() => {
    const count = Math.max(1, classSize);
    setStudentGroups(Array.from({ length: count }, (_, i) => ({
      id: `student-${Date.now()}-${i}`,
      studentName: `Alumno ${i + 1}`,
      files: [],
      studentAnswers: '',
      puntajeDesarrollo: 0,
      isEvaluated: false,
      isEvaluating: false,
    })));
  }, [classSize]);

  // ... (otras funciones como processFiles, handleLogoChange, etc., se mantienen igual)
  
  const handleStudentAnswersChange = (groupId: string, value: string) => {
    setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, studentAnswers: value } : g));
  };
  
  const handlePuntajeDesarrolloChange = (groupId: string, value: string) => {
    const puntaje = parseInt(value, 10) || 0;
    setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, puntajeDesarrollo: puntaje } : g));
  };

  const onEvaluateAll = async () => {
    const { rubrica, pauta, flexibilidad, areaConocimiento, puntajeTotal } = form.getValues();
    if (!rubrica) { return; }

    const pautaCorrecta = parseAnswers(pauta);

    for (const group of studentGroups) {
      if (group.files.length === 0) continue;
      setStudentGroups(prev => prev.map(g => g.id === group.id ? { ...g, isEvaluating: true, error: undefined } : g));

      const respuestasAlumno = parseAnswers(group.studentAnswers);
      
      const puntajeAlternativas = Object.keys(respuestasAlumno).reduce((acc, pregunta) => {
          return (pautaCorrecta[pregunta] && pautaCorrecta[pregunta] === respuestasAlumno[pregunta]) ? acc + 1 : acc;
      }, 0);

      const payload = {
        fileUrls: group.files.map(f => f.dataUrl),
        rubrica, pauta, flexibilidad: flexibilidad[0], areaConocimiento,
        puntajeTotal: Number(puntajeTotal),
        respuestasAlternativas: respuestasAlumno,
        // --- MODIFICACIÓN: ENVÍO DE PAUTA CORRECTA ---
        pautaCorrectaAlternativas: pautaCorrecta, // Nuevo campo con el objeto de respuestas correctas
      };

      setStudentGroups(prev => prev.map(g => g.id === group.id ? { ...g, debugPayload: payload } : g));
      
      const result = await evaluate(payload);

      setStudentGroups(prev => prev.map(g => {
        if (g.id === group.id) {
          if (result.success) {
            const puntajeFinalCalculado = puntajeAlternativas + g.puntajeDesarrollo;
            return {
              ...g, isEvaluating: false, isEvaluated: true,
              retroalimentacion: result.retroalimentacion,
              puntaje: `${puntajeFinalCalculado}/${puntajeTotal}`,
              nota: result.nota,
            };
          }
          return { ...g, isEvaluating: false, isEvaluated: true, error: result.error };
        }
        return g;
      }));
    }
  };

  const debugGroup = debugGroupId ? studentGroups.find(g => g.id === debugGroupId) : null;

  return (
    <div>
      {/* Modal de depuración */}
      {debugGroup && (
        <div className="pdf-modal-backdrop">
          <div className="pdf-modal" style={{width: '600px', height: 'auto', maxHeight: '80vh'}}>
            <div className="pdf-modal-header">
              <div className="font-semibold">Depuración de Datos - {debugGroup.studentName}</div>
              <Button variant="outline" size="sm" onClick={() => setDebugGroupId(null)}>Cerrar</Button>
            </div>
            <div className="pdf-modal-body" style={{padding: '16px', overflow: 'auto'}}>
              <p className="text-sm text-gray-600 mb-2">Este es el objeto exacto que se envió a la API. Verifica que `respuestasAlternativas` contenga lo que ingresaste.</p>
              <pre className="bg-gray-100 p-4 rounded-md text-xs whitespace-pre-wrap">
                {JSON.stringify(debugGroup.debugPayload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
      
      {/* ... (El resto de tu JSX se mantiene igual) ... */}
    </div>
  );
}