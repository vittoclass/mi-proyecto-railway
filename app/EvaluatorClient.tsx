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
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image as PDFImage, PDFViewer, pdf } from '@react-pdf/renderer';
import { useEvaluator } from './useEvaluator';
const SmartCameraModal = dynamic(() => import('@/components/smart-camera-modal'), { ssr: false, loading: () => <p>Cargando...</p> });
const Label = React.forwardRef<HTMLLabelElement, React.ComponentPropsWithoutRef<'label'>>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('text-sm font-medium', className)} {...props} />
));
Label.displayName = 'Label';

// --- Tus constantes (DRAGONFLY_SVG, DRAGONFLY_DATA_URL, wordmarkClass, GlobalStyles) se mantienen ---
const DRAGONFLY_SVG = `...`;
const DRAGONFLY_DATA_URL = `...`;
const wordmarkClass = '...';
const GlobalStyles = () => ( <style jsx global>{`...`}</style> );


// --- CORRECCIÓN CRÍTICA: DEFINICIÓN COMPLETA DE ESTILOS PARA EVITAR ERROR DE TIPO ---
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
    tableColHeaderRespuesta: { width: '40%', padding: 3, fontWeight: 'bold' },
    tableColPregunta: { width: '20%', borderRightWidth: 1, borderColor: '#EEEEEE', padding: 3 },
    tableColRespuesta: { width: '40%', padding: 3 },
});
// --- FIN DE LA CORRECCIÓN CRÍTICA DE ESTILOS ---


// --- CORRECCIÓN ANTERIOR: splitCorreccionForTwoPages (Se mantiene) ---
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
// --- FIN splitCorreccionForTwoPages ---


// --- Componente ReportDocument (sin cambios lógicos, ahora con estilos) ---
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
            {/* ... (Contenido de la segunda página sin cambios) ... */}
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
                            <Text style={styles.tableColHeaderRespuesta}>Respuesta Correcta</Text>
                        </View>
                        {alternativas.map((item: any, index: number) => (
                            <View style={styles.tableRow} key={index}>
                                <Text style={styles.tableColPregunta}>{item.pregunta}</Text>
                                <Text style={styles.tableColRespuesta}>{item.respuesta_estudiante}</Text>
                                <Text style={styles.tableColRespuesta}>{item.respuesta_correcta}</Text>
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
// ... (resto del archivo EvaluatorClient.tsx sin cambios) ...

// [EL RESTO DE LAS FUNCIONES Y EL COMPONENTE PRINCIPAL SE MANTIENEN IGUAL]

export default function EvaluatorClient() {
    // ...
}