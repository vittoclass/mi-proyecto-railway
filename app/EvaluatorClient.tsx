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
import { Button, buttonVariants } from '@/components/ui/button';
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
import { useEvaluator } from './useEvaluator'; 

// 1. Importamos las partes estructurales del PDF que NO fallan en SSR.
import { Document, Page, Text, View, StyleSheet, Image as PDFImage } from '@react-pdf/renderer';

// 2. Hacemos las partes interactivas (que interactúan con el DOM) dinámicas y desactivamos SSR (ssr: false).
const PDFDownloadLink = dynamic(() => import('@react-pdf/renderer').then(mod => mod.PDFDownloadLink), { 
    ssr: false, 
    loading: () => <Button variant="outline" disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando PDF...</Button> 
});
const PDFViewer = dynamic(() => import('@react-pdf/renderer').then(mod => mod.PDFViewer), { ssr: false });
const pdf = dynamic(() => import('@react-pdf/renderer').then(mod => mod.pdf), { ssr: false });
// ***************************************************************

const SmartCameraModal = dynamic(() => import('@/components/smart-camera-modal'), { ssr: false, loading: () => <p>Cargando...</p> });
const Label = React.forwardRef<HTMLLabelElement, React.ComponentPropsWithoutRef<'label'>>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('text-sm font-medium', className)} {...props} />
));
Label.displayName = 'Label';

// --- Tus constantes y estilos (DRAGONFLY_SVG, DRAGONFLY_DATA_URL, wordmarkClass, GlobalStyles) se mantienen ---
const DRAGONFLY_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="#4f46e5"><path d="M50 0C22.4 0 0 22.4 0 50s22.4 50 50 50 50-22.4 50-50S77.6 0 50 0zm25 35c0 1.9-1.3 3.5-3.1 3.9C69.4 48.7 61 58 50 58s-19.4-9.3-21.9-19.1c-1.8-.4-3.1-2-3.1-3.9 0-2.8 2.2-5 5-5h.1c-.1 0 0 0 0 0h37.9c2.8 0 5 2.2 5 5zM37.5 75.5c-3.1 0-5-2.6-5-5.5s1.9-5.5 5-5.5 5 2.6 5 5.5-1.9 5.5-5 5.5zm25 0c-3.1 0-5-2.6-5-5.5s1.9-5.5 5-5.5 5 2.6 5 5.5-1.9 5.5-5 5.5zM50 45c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z" /></svg>`;
const DRAGONFLY_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(DRAGONFLY_SVG).toString('base64')}`;
const wordmarkClass = 'text-indigo-600 font-extrabold tracking-tight';
const GlobalStyles = () => ( <style jsx global>{`
  .pdf-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
  }
  .pdf-modal {
      background-color: white;
      border-radius: 0.5rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      width: 600px; /* Tamaño por defecto */
      height: auto;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
  }
  .pdf-modal-header {
      padding: 1rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
  }
  .pdf-modal-body {
      padding: 1rem;
      overflow: auto;
      flex-grow: 1;
  }
`}</style> );


// --- DEFINICIÓN DE ESTILOS (sin cambios) ---
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Helvetica',
        fontSize: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        borderBottom: 1,
        paddingBottom: 10,
        borderColor: '#000000',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoLibelia: {
        width: 30,
        height: 30,
        marginRight: 10,
    },
    title: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 8,
        color: '#666666',
    },
    headerRight: {
        alignItems: 'flex-end',
    },
    logoColegio: {
        width: 50,
        height: 50,
        marginBottom: 5,
    },
    infoText: {
        fontSize: 8,
        marginBottom: 1,
        color: '#333333',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        padding: 5,
        backgroundColor: '#F0F0F0',
        borderRadius: 5,
    },
    scoreBox: {
        alignItems: 'center',
        padding: 5,
        border: 1,
        borderColor: '#DDDDDD',
        borderRadius: 5,
        marginRight: 10,
        width: 60,
    },
    scoreText: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#333333',
    },
    scoreValue: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#000000',
    },
    headerRightInfo: {
        flexGrow: 1,
        alignItems: 'flex-end',
    },
    section: {
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#000000',
        borderBottom: 1,
        borderColor: '#EEEEEE',
        paddingBottom: 2,
    },
    bodyText: {
        fontSize: 9,
        lineHeight: 1.4,
        textAlign: 'justify',
    },
    // Estilos de Tablas
    table: {
        display: 'flex',
        width: 'auto',
        borderStyle: 'solid',
        borderWidth: 1,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        marginTop: 5,
        borderColor: '#DDDDDD',
    },
    tableRowHeader: {
        flexDirection: 'row',
        backgroundColor: '#EEEEEE',
        borderStyle: 'solid',
        borderWidth: 0,
        borderBottomWidth: 1,
        borderColor: '#DDDDDD',
        alignItems: 'center',
        height: 18,
    },
    tableRow: {
        flexDirection: 'row',
        borderStyle: 'solid',
        borderWidth: 0,
        borderBottomWidth: 1,
        borderColor: '#EEEEEE',
        minHeight: 15,
        alignItems: 'center',
    },
    // Columnas de Corrección Detallada
    tableColHeaderSeccion: { width: '30%', borderRightWidth: 1, borderColor: '#DDDDDD', padding: 3, fontWeight: 'bold' },
    tableColHeaderDetalle: { width: '70%', padding: 3, fontWeight: 'bold' },
    tableColSeccion: { width: '30%', borderRightWidth: 1, borderColor: '#EEEEEE', padding: 3 },
    tableColDetalle: { width: '70%', padding: 3 },
    // Columnas de Evaluación de Habilidades
    tableColHeaderHabilidad: { width: '35%', borderRightWidth: 1, borderColor: '#DDDDDD', padding: 3, fontWeight: 'bold' },
    tableColHeaderNivel: { width: '15%', borderRightWidth: 1, borderColor: '#DDDDDD', padding: 3, fontWeight: 'bold' },
    tableColHeaderEvidencia: { width: '50%', padding: 3, fontWeight: 'bold' },
    tableColHabilidad: { width: '35%', borderRightWidth: 1, borderColor: '#EEEEEE', padding: 3 },
    tableColNivel: { width: '15%', borderRightWidth: 1, borderColor: '#EEEEEE', padding: 3 },
    tableColEvidencia: { width: '50%', padding: 3 },
    // Columnas de Respuestas Alternativas
    tableColHeaderPregunta: { width: '20%', borderRightWidth: 1, borderColor: '#DDDDDD', padding: 3, fontWeight: 'bold' },
    tableColHeaderRespuesta: { width: '40%', borderRightWidth: 1, borderColor: '#DDDDDD', padding: 3, fontWeight: 'bold' },
    tableColHeaderRespuestaCorrecta: { width: '40%', padding: 3, fontWeight: 'bold' },
    tableColPregunta: { width: '20%', borderRightWidth: 1, borderColor: '#EEEEEE', padding: 3 },
    tableColRespuesta: { width: '40%', borderRightWidth: 1, borderColor: '#EEEEEE', padding: 3 },
    tableColRespuestaCorrecta: { width: '40%', padding: 3 },
});


// --- splitCorreccionForTwoPages (Se mantiene) ---
const splitCorreccionForTwoPages = (lista: any[] | undefined) => {
  if (!lista || lista.length === 0) {
    return { first: [], rest: [] };
  }
  
  const halfIndex = Math.ceil(lista.length / 2);
  
  return {
    first: lista.slice(0, halfIndex),
    rest: lista.slice(halfIndex),
  };
};


// --- Componente ReportDocument (sin cambios lógicos) ---
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
            {logoPreview && typeof logoPreview === 'string' && logoPreview.startsWith('data:image') ? (
              <PDFImage src={logoPreview} style={styles.logoColegio} />
            ) : null}
            <Text style={styles.infoText}>Profesor: {formData.nombreProfesor || 'N/A'}</Text>
            <Text style={styles.infoText}>Asignatura: {formData.asignatura || 'N/A'}</Text>
            <Text style={styles.infoText}>Evaluación: {formData.nombrePrueba || 'N/A'}</Text>
            <Text style={styles.infoText}>Fecha: {format(new Date(), 'dd/MM/yyyy')}</Text>
          </View>
        </View>
        
        {/* Sección de Puntaje y Fortalezas/Mejoras */}
        <View style={styles.sectionHeader}>
            <View style={styles.scoreBox}>
                <Text style={styles.scoreText}>Puntaje</Text>
                <Text style={styles.scoreValue}>{group.puntaje || 'N/A'}</Text>
            </View>
            <View style={styles.scoreBox}>
                <Text style={styles.scoreText}>Nota</Text>
                <Text style={styles.scoreValue}>{group.nota || 'N/A'}</Text>
            </View>
            <View style={styles.headerRightInfo}>
                <Text style={styles.infoText}>Alumno: {group.studentName}</Text>
                <Text style={styles.infoText}>Curso: {formData.curso || 'N/A'}</Text>
            </View>
        </View>

        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fortalezas</Text>
            <Text style={styles.bodyText}>{resumen.fortalezas}</Text>
        </View>

        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Áreas de Mejora</Text>
            <Text style={styles.bodyText}>{resumen.areas_mejora}</Text>
        </View>

        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Corrección Detallada</Text>
            <View style={styles.table}>
                <View style={styles.tableRowHeader}>
                    <Text style={styles.tableColHeaderSeccion}>Sección</Text>
                    <Text style={styles.tableColHeaderDetalle}>Detalle</Text>
                </View>
                {correccionP1.map((item: any, index: number) => (
                    <View style={styles.tableRow} key={index}>
                        <Text style={styles.tableColSeccion}>{item.seccion}</Text>
                        <Text style={styles.tableColDetalle}>{item.detalle}</Text>
                    </View>
                ))}
            </View>
        </View>
      </Page>
      
      {/* Segunda Página */}
      {(correccionP2.length > 0 || habilidades.length > 0 || alternativas.length > 0) && (
        <Page size="A4" style={styles.page}>
            {/* Si hay corrección que no cupo en la P1, la mostramos aquí */}
            {correccionP2.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Corrección Detallada (Cont.)</Text>
                    <View style={styles.table}>
                        <View style={styles.tableRowHeader}>
                            <Text style={styles.tableColHeaderSeccion}>Sección</Text>
                            <Text style={styles.tableColHeaderDetalle}>Detalle</Text>
                        </View>
                        {correccionP2.map((item: any, index: number) => (
                            <View style={styles.tableRow} key={index}>
                                <Text style={styles.tableColSeccion}>{item.seccion}</Text>
                                <Text style={styles.tableColDetalle}>{item.detalle}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* Evaluación de Habilidades */}
            {habilidades.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Evaluación de Habilidades</Text>
                    <View style={styles.table}>
                        <View style={styles.tableRowHeader}>
                            <Text style={styles.tableColHeaderHabilidad}>Habilidad</Text>
                            <Text style={styles.tableColHeaderNivel}>Nivel</Text>
                            <Text style={styles.tableColHeaderEvidencia}>Evidencia</Text>
                        </View>
                        {habilidades.map((item: any, index: number) => (
                            <View style={styles.tableRow} key={index}>
                                <Text style={styles.tableColHabilidad}>{item.habilidad}</Text>
                                <Text style={styles.tableColNivel}>{item.evaluacion}</Text>
                                <Text style={styles.tableColEvidencia}>{item.evidencia}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
            
            {/* Respuestas Alternativas */}
            {alternativas.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Respuestas Alternativas</Text>
                    <View style={styles.table}>
                        <View style={styles.tableRowHeader}>
                            <Text style={styles.tableColHeaderPregunta}>Pregunta</Text>
                            <Text style={styles.tableColHeaderRespuesta}>Respuesta Estudiante</Text>
                            <Text style={styles.tableColHeaderRespuestaCorrecta}>Respuesta Correcta</Text>
                        </View>
                        {alternativas.map((item: any, index: number) => (
                            <View style={styles.tableRow} key={index}>
                                <Text style={styles.tableColPregunta}>{item.pregunta}</Text>
                                <Text style={styles.tableColRespuesta}>{item.respuesta_estudiante}</Text>
                                <Text style={styles.tableColRespuestaCorrecta}>{item.respuesta_correcta}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </Page>
      )}
    </Document>
  );
};


// ==== Tipos (sin cambios) ====
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

// ==== Componente Principal (LÓGICA Y SINTAXIS COMPLETAMENTE RESTAURADA) ====
export default function EvaluatorClient() {
  // 1. Estados y Hooks
  const [activeTab, setActiveTab] = useState('evaluator');
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [classSize, setClassSize] = useState(1);
  const [debugGroupId, setDebugGroupId] = useState<string | null>(null);
  const { evaluate, isLoading } = useEvaluator();
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
  // Fin de los hooks.

  // 2. useEffects y Lógica de inicialización
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
  
  // 3. Funciones de manejo (Cuerpo COMPLETO y sintácticamente válido)
  const processFiles = (files: File[]) => { 
      const newFiles = files.map(file => ({
          id: `file-${Date.now()}-${Math.random()}`,
          file: file,
          previewUrl: URL.createObjectURL(file),
          dataUrl: '', 
      }));
      setUnassignedFiles(prev => [...prev, ...newFiles]);
  };
  
  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files[0]) {
          const file = event.target.files[0];
          setLogoPreview(URL.createObjectURL(file));
      }
  };
  
  const assignFileToGroup = (fileId: string, groupId: string) => {
    const fileToAssign = unassignedFiles.find(f => f.id === fileId);
    if (fileToAssign) {
        setUnassignedFiles(prev => prev.filter(f => f.id !== fileId));
        setStudentGroups(prev => prev.map(g => 
            g.id === groupId ? { ...g, files: [...g.files, fileToAssign] } : g
        ));
    }
  };
  
  const removeFileFromGroup = (groupId: string, fileId: string) => {
    let fileToReturn: FilePreview | undefined;
    setStudentGroups(prev => prev.map(g => {
        if (g.id === groupId) {
            fileToReturn = g.files.find(f => f.id === fileId);
            return { ...g, files: g.files.filter(f => f.id !== fileId) };
        }
        return g;
    }));

    if (fileToReturn) {
        setUnassignedFiles(prev => [...prev, fileToReturn!]);
    }
  };
  
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
        // --- MODIFICACIÓN CLAVE: ENVÍO DE PAUTA CORRECTA ---
        pautaCorrectaAlternativas: pautaCorrecta, 
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
  }; // <--- CIERRE DE LA FUNCIÓN onEvaluateAll (¡CRÍTICO!)
  
  const debugGroup = debugGroupId ? studentGroups.find(g => g.id === debugGroupId) : null;

  // 4. Renderizado (JSX CORREGIDO)
  return (
    <div className="flex flex-col h-screen">
      {/* Global Styles for PDF Modal */}
      <GlobalStyles />
      
      {/* Modal de depuración */}
      {debugGroup && (
        <div className="pdf-modal-backdrop fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="pdf-modal bg-white rounded-lg shadow-xl" style={{width: '600px', height: 'auto', maxHeight: '80vh'}}>
            <div className="pdf-modal-header p-4 border-b flex justify-between items-center">
              <div className="font-semibold text-lg">Depuración de Datos - {debugGroup.studentName}</div>
              <Button variant="outline" size="sm" onClick={() => setDebugGroupId(null)}>Cerrar</Button>
            </div>
            <div className="pdf-modal-body p-4 overflow-auto">
              <p className="text-sm text-gray-600 mb-2">Este es el objeto exacto que se envió a la API. Verifica que `respuestasAlternativas` contenga lo que ingresaste.</p>
              <pre className="bg-gray-100 p-4 rounded-md text-xs whitespace-pre-wrap">
                {JSON.stringify(debugGroup.debugPayload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Smart Camera Modal */}
      {isCameraOpen && (
        <SmartCameraModal 
          onClose={() => setIsCameraOpen(false)} 
          onCapture={(file: File) => {
            const newFile = {
              id: `file-${Date.now()}`,
              file: file,
              previewUrl: URL.createObjectURL(file),
              dataUrl: '', // Se llenará en processFiles
            };
            setUnassignedFiles(prev => [...prev, newFile]);
            setIsCameraOpen(false);
            processFiles([file]); // Procesar inmediatamente el archivo
          }}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-6 w-6 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-800">Libel-IA Evaluator</h1>
        </div>
        
        {/* Componente TabsList dentro del header */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex justify-center">
          <TabsList>
            <TabsTrigger value="evaluator">
              <ClipboardList className="h-4 w-4 mr-2" />Evaluador
            </TabsTrigger>
            <TabsTrigger value="info">
              <Home className="h-4 w-4 mr-2" />Información de la Prueba
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="flex items-center space-x-2">
          <a
            href="https://libelia.cl" 
            target="_blank" 
            rel="noopener noreferrer" 
            className={cn(buttonVariants({ variant: "ghost" }), "text-sm")}
          >
            Libelia.cl
          </a>
        </div>
      </header>

      {/* Main Content (Se mueve el componente Tabs a este bloque) */}
      <div className="flex-grow p-6 bg-gray-50 overflow-auto">
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">

          {/* Contenido de la pestaña INFO */}
          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle>Información General de la Evaluación</CardTitle>
                <CardDescription>Detalles sobre el profesor, el curso y la evaluación.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="nombrePrueba"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre de la Prueba</Label>
                            <FormControl>
                              <Input placeholder="Ensayo de Historia 2024" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="asignatura"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Asignatura</Label>
                            <FormControl>
                              <Input placeholder="Lenguaje y Comunicación" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="curso"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Curso</Label>
                            <FormControl>
                              <Input placeholder="3° Medio" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="nombreProfesor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Profesor/a</Label>
                            <FormControl>
                              <Input placeholder="Juan Pérez" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="areaConocimiento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Área de Conocimiento (IA)</Label>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona el área de conocimiento" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="literature">Literatura/Lenguaje</SelectItem>
                                <SelectItem value="science">Ciencias</SelectItem>
                                <SelectItem value="history">Historia/Sociales</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-2">
                          <Label htmlFor="logo-upload">Logo Institucional (Opcional)</Label>
                          <div className="flex items-center space-x-2">
                              <input 
                                  type="file" 
                                  ref={logoInputRef}
                                  id="logo-upload" 
                                  accept="image/*" 
                                  onChange={handleLogoChange} 
                                  className="hidden"
                              />
                              <Button 
                                  type="button" 
                                  variant="outline" 
                                  onClick={() => logoInputRef.current?.click()}
                              >
                                  <ImageUp className="h-4 w-4 mr-2" />
                                  Subir Logo
                              </Button>
                              {logoPreview && (
                                  <div className="relative">
                                      <img src={logoPreview} alt="Logo Preview" className="h-10 w-10 object-contain border rounded p-1" />
                                      <X className="h-4 w-4 absolute top-0 right-0 cursor-pointer bg-red-500 text-white rounded-full" onClick={() => setLogoPreview(null)} />
                                  </div>
                              )}
                          </div>
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="rubrica"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rúbrica/Instrucciones de Evaluación (Texto Clave)</Label>
                          <FormControl>
                            <Textarea
                              placeholder="Describa la rúbrica para las preguntas de desarrollo: Los estudiantes deben tener 3 argumentos..."
                              className="min-h-[150px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>Esta es la base para la evaluación de la IA. Sé detallado.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="puntajeTotal"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Puntaje Total Máximo</Label>
                            <FormControl>
                              <Input placeholder="100" type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                          control={form.control}
                          name="flexibilidad"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Flexibilidad de Evaluación (IA)</Label>
                                  <div className="flex items-center space-x-4 pt-2">
                                      <Slider
                                          defaultValue={[3]}
                                          max={5}
                                          step={1}
                                          onValueChange={field.onChange}
                                          className="w-[60%]"
                                      />
                                      <span className="text-sm font-medium">{field.value[0]}</span>
                                      <span className="text-xs text-muted-foreground">1 (Rígido) a 5 (Creativo)</span>
                                  </div>
                                  <FormDescription>
                                      Define la "tolerancia" de la IA para respuestas no literales en las preguntas de desarrollo.
                                  </FormDescription>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="pauta"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pauta Alternativas (Opcional)</Label>
                          <FormControl>
                            <Textarea
                              placeholder="Ej: 1A, 2C, 3V, 4F, 5D. Solo para preguntas de alternativa/VF."
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>Ingresa la pauta separada por comas (N° Pregunta y Respuesta: 1A, 2C, 3V)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contenido de la pestaña EVALUADOR */}
          <TabsContent value="evaluator">
            {/* File Upload and Class Size */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="col-span-1">
                <CardContent className="p-4 space-y-2">
                  <Label htmlFor="file-upload">Subir Archivos (PDF/Imágenes)</Label>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    id="file-upload" 
                    accept="image/*,application/pdf" 
                    multiple 
                    onChange={(e) => {
                      if (e.target.files) {
                        processFiles(Array.from(e.target.files));
                      }
                    }}
                    className="hidden"
                  />
                  <Button onClick={() => fileInputRef.current?.click()} className="w-full">
                    <FileUp className="h-4 w-4 mr-2" />
                    Seleccionar Archivos
                  </Button>
                  <Button onClick={() => setIsCameraOpen(true)} variant="secondary" className="w-full">
                    <Camera className="h-4 w-4 mr-2" />
                    Usar Cámara
                  </Button>
                </CardContent>
              </Card>

              <Card className="col-span-1">
                <CardContent className="p-4 space-y-2">
                  <Label htmlFor="class-size">Cantidad de Alumnos a Evaluar</Label>
                  <div className="flex items-center space-x-2">
                    <Input 
                      id="class-size"
                      type="number" 
                      min="1" 
                      value={classSize}
                      onChange={(e) => setClassSize(parseInt(e.target.value) || 1)}
                    />
                    <Button onClick={() => setClassSize(prev => prev + 1)} variant="outline">+</Button>
                    <Button onClick={() => setClassSize(prev => Math.max(1, prev - 1))} variant="outline">-</Button>
                  </div>
                  <FormDescription>Crea grupos para cada estudiante.</FormDescription>
                </CardContent>
              </Card>

              <Card className="col-span-2">
                <CardContent className="p-4 flex flex-col justify-center space-y-2 h-full">
                  <Button 
                    onClick={form.handleSubmit(onEvaluateAll)} 
                    disabled={isLoading || studentGroups.every(g => g.files.length === 0)}
                    className="w-full h-12 text-lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Evaluando ({studentGroups.filter(g => g.isEvaluating).length} en curso)...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Evaluar Todos los Alumnos
                      </>
                    )}
                  </Button>
                  <FormDescription className="text-center">Asegúrate de haber llenado la **Rúbrica** y asignado **todos los archivos** antes de evaluar.</FormDescription>
                </CardContent>
              </Card>
            </div>

            {/* Unassigned Files */}
            {unassignedFiles.length > 0 && (
              <Card className="mb-6 border-l-4 border-yellow-500">
                <CardHeader>
                  <CardTitle className="flex items-center text-yellow-700">
                      <Bug className="h-5 w-5 mr-2" /> Archivos Sin Asignar
                  </CardTitle>
                  <CardDescription>Arrastra estos archivos a la tarjeta del alumno que corresponda. Los archivos se procesan al ser asignados.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4">
                  {unassignedFiles.map(file => (
                    <div key={file.id} className="relative p-2 border rounded-lg bg-yellow-50" draggable onDragStart={(e) => e.dataTransfer.setData("fileId", file.id)}>
                      <img src={file.previewUrl} alt="Preview" className="h-16 w-16 object-cover rounded" />
                      <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 text-white hover:bg-red-700 opacity-0 group-hover/file:opacity-100 transition-opacity p-0" onClick={() => setUnassignedFiles(prev => prev.filter(f => f.id !== file.id))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Student Groups */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {studentGroups.map(group => (
                <Card
                  key={group.id}
                  onDrop={(e) => assignFileToGroup(e.dataTransfer.getData("fileId"), group.id)}
                  onDragOver={(e) => e.preventDefault()}
                  className={cn(
                      'transition-all duration-300',
                      group.isEvaluating && 'border-indigo-500 border-2 shadow-lg',
                      group.error && 'border-red-500 border-2 shadow-lg',
                      group.isEvaluated && !group.error && 'border-green-500 border-2 shadow-lg'
                  )}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <Input 
                          value={group.studentName}
                          onChange={(e) => setStudentGroups(prev => prev.map(g => g.id === group.id ? { ...g, studentName: e.target.value } : g))}
                          className="text-lg font-bold p-0 border-none h-auto focus-visible:ring-0 focus-visible:border-none"
                      />
                      <div className="text-2xl font-extrabold text-right">
                          {group.puntaje || (group.isEvaluating ? '-' : '0')}
                      </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      {/* Status */}
                      <div className="text-sm">
                          {group.isEvaluating && <span className="text-indigo-600 flex items-center"><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Evaluando...</span>}
                          {group.error && <span className="text-red-600 flex items-center"><Bug className="h-4 w-4 mr-2" /> Error: {group.error}</span>}
                          {group.isEvaluated && !group.isEvaluating && !group.error && <span className="text-green-600 flex items-center font-bold">¡Evaluado! Nota: {group.nota}</span>}
                          {!group.isEvaluated && !group.isEvaluating && !group.error && <span className="text-gray-500">Esperando archivos...</span>}
                      </div>

                      {/* Assigned Files */}
                      <div className="flex flex-wrap gap-2 min-h-[40px] border p-2 rounded-md bg-gray-50">
                          {group.files.length === 0 && <span className="text-sm text-gray-400">Arrastra las respuestas aquí.</span>}
                          {group.files.map(file => (
                              <div key={file.id} className="relative group/file">
                                  <img src={file.previewUrl} alt="File" className="h-12 w-12 object-cover rounded border" />
                                  <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 text-white hover:bg-red-700 opacity-0 group-hover/file:opacity-100 transition-opacity p-0" 
                                      onClick={() => removeFileFromGroup(group.id, file.id)}
                                  >
                                      <X className="h-3 w-3" />
                                  </Button>
                              </div>
                          ))}
                      </div>

                      {/* Manual Inputs */}
                      <div className="space-y-2">
                          <Label htmlFor={`answers-${group.id}`}>Respuestas Alternativas (Ej: 1A, 2C)</Label>
                          <Input 
                              id={`answers-${group.id}`}
                              placeholder="Respuestas Ej: 1a, 2c, 3v"
                              value={group.studentAnswers}
                              onChange={(e) => handleStudentAnswersChange(group.id, e.target.value)}
                          />
                          <Label htmlFor={`puntaje-${group.id}`}>Puntaje Desarrollo (Manual)</Label>
                          <Input 
                              id={`puntaje-${group.id}`}
                              type="number" 
                              placeholder="Puntaje Manual (Ej: 15)"
                              value={group.puntajeDesarrollo}
                              onChange={(e) => handlePuntajeDesarrolloChange(group.id, e.target.value)}
                          />
                      </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                      <Button 
                          onClick={() => setDebugGroupId(group.id)} 
                          variant="outline" 
                          size="sm"
                          disabled={!group.debugPayload}
                      >
                          <Eye className="h-4 w-4 mr-2" /> Debug
                      </Button>
                      {group.isEvaluated && group.retroalimentacion && (
                          <PDFDownloadLink 
                              document={<ReportDocument group={group} formData={form.getValues()} logoPreview={logoPreview} />} 
                              fileName={`Informe-${group.studentName}-${format(new Date(), 'yyyyMMdd')}.pdf`}
                              className={cn(buttonVariants({ size: "sm" }))}
                          >
                              {({ loading }) => loading ? 'Generando...' : (
                                  <span className="flex items-center">
                                      <Printer className="h-4 w-4 mr-2" /> Descargar PDF
                                  </span>
                              )}
                          </PDFDownloadLink>
                      )}
                  </CardFooter>
                </Card>
              ))}
            </div>
            <NotesDashboard />
          </TabsContent>

        </Tabs> 
      </div>
    </div>
  );
}