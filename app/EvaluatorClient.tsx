'use client'
import { useState, useRef, ChangeEvent, useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import dynamic from 'next/dynamic'
import * as React from "react"
import { format } from "date-fns"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Sparkles, FileUp, Camera, Users, X, Printer, CalendarIcon, ImageUp, ClipboardList, Home, Palette } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEvaluator } from "./useEvaluator"
import { NotesDashboard } from "../components/NotesDashboard"
const SmartCameraModal = dynamic(() => import('../components/smart-camera-modal'), { ssr: false, loading: () => <p>Cargando...</p> })
const Label = React.forwardRef<HTMLLabelElement, React.ComponentPropsWithoutRef<'label'>>(({ className, ...props }, ref) => ( <label ref={ref} className={cn("text-sm font-medium", className)} {...props} /> ));
Label.displayName = "Label"

// LOGO Libel-IA (libélula) — diseño estilizado, gradiente y formas suaves
const DRAGONFLY_SVG = `
<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg" aria-label="Libel-IA logo">
  <defs>
    <linearGradient id="lg-a" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="50%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#06B6D4"/>
    </linearGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="1.4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect x="147" y="72" width="6" height="92" rx="3" fill="url(#lg-a)" filter="url(#soft)"/>
  <circle cx="150" cy="66" r="11" fill="url(#lg-a)"/>
  <path d="M30,80 C90,40 210,40 270,80 C210,92 90,92 30,80Z" fill="url(#lg-a)" opacity="0.25"/>
  <path d="M40,110 C100,90 200,90 260,110 C200,122 100,122 40,110Z" fill="url(#lg-a)" opacity="0.2"/>
  <rect x="149" y="166" width="2" height="14" rx="1" fill="#6366F1"/>
  <rect x="149" y="182" width="2" height="10" rx="1" fill="#22D3EE"/>
</svg>
`;
const DRAGONFLY_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(DRAGONFLY_SVG)}`;
const wordmarkClass = "text-transparent bg-clip-text bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400";

// ADICIONES PARA TEMAS Y ESTILOS
const GlobalStyles = () => (
  <style jsx global>{`
    @import url('https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@700&display=swap');
    .font-logo {
      font-family: 'Josefin Sans', sans-serif;
    }
    :root, .theme-default {
      --bg-main: #F9FAFB; --bg-card: #FFFFFF; --bg-muted: #F3F4F6; --bg-muted-subtle: #F9FAFB; --bg-primary: #4338CA; --bg-primary-hover: #3730A3; --text-primary: #1F2937; --text-secondary: #6B7280; --text-on-primary: #FFFFFF; --text-accent: #4338CA; --border-color: #E5E7EB; --border-focus: #4F46E5; --ring-color: #4F46E5;
    }
    .theme-ocaso {
      color: var(--text-primary);
      --bg-main: #09090b; --bg-card: #18181b; --bg-muted: #27272a; --bg-muted-subtle: #18181b; --bg-primary: #7C3AED; --bg-primary-hover: #6D28D9; --text-primary: #F4F4F5; --text-secondary: #a1a1aa; --text-on-primary: #FFFFFF; --text-accent: #a78bfa; --border-color: #27272a; --border-focus: #8B5CF6; --ring-color: #8B5CF6;
    }

    .theme-corporativo {
      --bg-main: #F0F4F8; --bg-card: #FFFFFF; --bg-muted: #E3E8EE; --bg-muted-subtle: #F8FAFC; --bg-primary: #2563EB; --bg-primary-hover: #1D4ED8; --text-primary: #0F172A; --text-secondary: #475569; --text-on-primary: #FFFFFF; --text-accent: #2563EB; --border-color: #CBD5E1; --border-focus: #2563EB; --ring-color: #2563EB;
    }
  `}</style>
);

interface CorreccionDetallada { seccion: string; detalle: string; }
interface EvaluacionHabilidad { habilidad: string; evaluacion: string; evidencia: string; }
interface RetroalimentacionEstructurada {
  correccion_detallada?: CorreccionDetallada[];
  evaluacion_habilidades?: EvaluacionHabilidad[];
  resumen_general?: { fortalezas: string; areas_mejora: string; };
}

const formSchema = z.object({
  tipoEvaluacion: z.string().default('prueba'),
  rubrica: z.string().min(10, "La rúbrica es necesaria."),
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
interface StudentGroup { id: string; studentName: string; files: FilePreview[]; retroalimentacion?: RetroalimentacionEstructurada; puntaje?: string; nota?: number | string; decimasAdicionales: number; isEvaluated: boolean; isEvaluating: boolean; error?: string; }

export default function EvaluatorClient() {
    const [unassignedFiles, setUnassignedFiles] = useState<FilePreview[]>([]);
    const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [classSize, setClassSize] = useState(1);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [isExtractingNames, setIsExtractingNames] = useState(false);
    const { evaluate, isLoading } = useEvaluator();
    const [theme, setTheme] = useState('theme-ocaso');
    const [activeTab, setActiveTab] = useState("inicio");

    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        tipoEvaluacion: 'prueba', rubrica: "", pauta: "", flexibilidad: [3],
        nombreProfesor: "", nombrePrueba: "", departamento: "", asignatura: "", curso: "",
        fechaEvaluacion: new Date(), areaConocimiento: 'general',
      },
    });

    useEffect(() => {
        const count = Math.max(1, classSize);
        setStudentGroups(Array.from({ length: count }, (_, i) => ({
            id: `student-${Date.now()}-${i}`, studentName: `Alumno ${i + 1}`, files: [],
            isEvaluated: false, isEvaluating: false, decimasAdicionales: 0,
        })));
        setUnassignedFiles([]);
    }, [classSize]);

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
    const handleCapture = (dataUrl: string) => { fetch(dataUrl).then(res => res.blob()).then(blob => { processFiles([new File([blob], `captura-${Date.now()}.png`, { type: 'image/png' })]); }); setIsCameraOpen(false); };
    const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setLogoPreview(reader.result as string); reader.readAsDataURL(file); } };
    const updateStudentName = (groupId: string, newName: string) => setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, studentName: newName } : g));
    const assignFileToGroup = (fileId: string, groupId: string) => { const fileToMove = unassignedFiles.find(f => f.id === fileId); if (!fileToMove) return; setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, files: [...g.files, fileToMove] } : g)); setUnassignedFiles(files => files.filter(f => f.id !== fileId)); };
    const removeFileFromGroup = (fileId: string, groupId: string) => { let fileToMoveBack: FilePreview | undefined; setStudentGroups(groups => groups.map(g => { if (g.id === groupId) { fileToMoveBack = g.files.find(f => f.id === fileId); return { ...g, files: g.files.filter(f => f.id !== fileId) }; } return g; })); if (fileToMoveBack) setUnassignedFiles(prev => [...prev, fileToMoveBack!]); };
    const handleDecimasChange = (groupId: string, value: string) => { const decimas = parseFloat(value) || 0; setStudentGroups(groups => groups.map(g => g.id === groupId ? { ...g, decimasAdicionales: decimas } : g)); };

    const removeUnassignedFile = (fileId: string) => {
        setUnassignedFiles(prev => prev.filter(f => f.id !== fileId));
    };

    const handleNameExtraction = async () => {
        if (unassignedFiles.length === 0) { alert("Sube primero la página que contiene el nombre."); return; }
        setIsExtractingNames(true);
        const formData = new FormData();
        formData.append("files", unassignedFiles[0].file);
        try {
            const response = await fetch('/api/extract-name', { method: 'POST', body: formData });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'Error desconocido.');
            if (data.suggestions && data.suggestions.length > 0) {
                const bestSuggestion = data.suggestions[0];
                alert(`Sugerencia detectada: ${bestSuggestion}`);
                const firstDefaultStudentIndex = studentGroups.findIndex(g => g.studentName.startsWith('Alumno'));
                if (firstDefaultStudentIndex !== -1) updateStudentName(studentGroups[firstDefaultStudentIndex].id, bestSuggestion);
            } else alert("No se detectaron nombres en la imagen.");
        } catch (error) {
            console.error("Error en extracción:", error);
            alert(`Error al extraer nombres: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        } finally {
            setIsExtractingNames(false);
        }
    };

    const generateReport = (group: StudentGroup) => {
        const { nombreProfesor, departamento, asignatura, curso, nombrePrueba } = form.getValues();
        const reportWindow = window.open("", "_blank");
        if (!reportWindow) {
            alert("Habilita las ventanas emergentes.");
            return;
        }

        const buildTable = (title: string, headers: string[], data: any[], rowBuilder: (item: any) => string) => {
            if (!data || !Array.isArray(data) || data.length === 0) return '';
            return `<div class="section-card"><h2>${title}</h2><table class="styled-table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${data.map(rowBuilder).join('')}</tbody></table></div>`;
        };

        const resumen = group.retroalimentacion?.resumen_general || { fortalezas: 'N/A', areas_mejora: 'N/A' };
        const finalNota = ((Number(group.nota) || 0) + group.decimasAdicionales).toFixed(1);
        const sanitizedStudentName = group.studentName.replace(/[^a-zA-Z0-9 ]/g, "");

        const reportHTML = `
            <html>
                <head>
                    <title>Informe - ${group.studentName}</title>
                    <meta charset="utf-8" />
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
                    <style>
                        body {
                            font-family: 'Inter', sans-serif;
                            background-color: #f3f4f6;
                            margin: 0;
                            padding: 10px;
                            color: #1f2937;
                            font-size: 10px;
                            line-height: 1.2;
                        }
                        .report-outer-container {
                            max-width: 800px;
                            margin: auto;
                        }
                        .report-content {
                            background: white;
                            padding: 15px;
                            border-radius: 8px;
                            box-shadow: 0 2px 3px rgba(0,0,0,0.1);
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            padding-bottom: 10px;
                            border-bottom: 1px solid #e5e7eb;
                        }
                        .header-left {
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        }
                        .header-left img {
                            height: 30px;
                        }
                        .header-left h1 {
                            font-size: 20px;
                            font-weight: 700;
                            color: #4f46e5;
                            margin: 0;
                            line-height: 1;
                        }
                        .header-left p {
                            font-size: 10px;
                            color: #6b7280;
                            margin: 0;
                        }
                        .header-right {
                            text-align: right;
                        }
                        .header-right img {
                            max-height: 35px;
                            max-width: 120px;
                            object-fit: contain;
                            margin-bottom: 6px;
                        }
                        .header-right p {
                            font-size: 9px;
                            margin: 1px 0;
                            color: #4b5563;
                        }
                        .student-summary-grid {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 10px;
                            margin-top: 10px;
                        }
                        .summary-card {
                            background-color: #f9fafb;
                            border: 1px solid #e5e7eb;
                            padding: 10px;
                            border-radius: 6px;
                            text-align: center;
                        }
                        .summary-card .label {
                            font-size: 10px;
                            font-weight: 600;
                            color: #4b5563;
                            margin-bottom: 3px;
                        }
                        .summary-card .value {
                            font-size: 28px;
                            font-weight: 700;
                            color: #4f46e5;
                            line-height: 1;
                        }
                        .summary-card .value-small {
                            font-size: 16px;
                        }
                        .feedback-grid {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 10px;
                            margin-top: 10px;
                        }
                        .feedback-card {
                            padding: 10px;
                            border-radius: 6px;
                        }
                        .feedback-card h2 {
                            font-size: 14px;
                            font-weight: 600;
                            margin: 0 0 8px 0;
                            display: flex;
                            align-items: center;
                        }
                        .feedback-card p {
                            font-size: 10px;
                            line-height: 1.2;
                            margin: 0;
                        }
                        .fortalezas {
                            background-color: #f0fdf4;
                            border: 1px solid #bbf7d0;
                            color: #14532d;
                        }
                        .fortalezas h2 {
                            color: #166534;
                        }
                        .areas-mejora {
                            background-color: #fffbeb;
                            border: 1px solid #fde68a;
                            color: #78350f;
                        }
                        .areas-mejora h2 {
                            color: #854d0e;
                        }
                        .section-card {
                            margin-top: 15px;
                        }
                        .section-card h2 {
                            font-size: 16px;
                            font-weight: 600;
                            padding-bottom: 6px;
                            border-bottom: 1px solid #e5e7eb;
                            margin: 0 0 10px 0;
                        }
                        .styled-table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        .styled-table th, .styled-table td {
                            padding: 8px;
                            text-align: left;
                            border-bottom: 1px solid #e5e7eb;
                            font-size: 10px;
                        }
                        .styled-table th {
                            font-weight: 600;
                            background-color: #f9fafb;
                        }
                        .styled-table tr:last-child td {
                            border-bottom: none;
                        }
                        .styled-table td:first-child {
                            font-weight: 600;
                            color: #374151;
                        }
                        .styled-table i {
                            color: #6b7280;
                        }
                        .actions-container {
                            margin-top: 15px;
                            display: flex;
                            gap: 10px;
                        }
                        .action-button {
                            flex: 1;
                            padding: 8px;
                            font-size: 14px;
                            font-weight: 600;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            transition: background-color 0.2s, transform 0.1s;
                        }
                        .action-button:hover {
                            transform: translateY(-1px);
                        }
                        .action-button:active {
                            transform: translateY(0);
                        }
                        .pdf-button {
                            background-color: #4f46e5;
                            color: white;
                        }
                        .pdf-button:hover {
                            background-color: #4338ca;
                        }
                        .word-button {
                            background-color: #1d4ed8;
                            color: white;
                        }
                        .word-button:hover {
                            background-color: #1e40af;
                        }
                        .action-button:disabled {
                            background-color: #a5b4fc;
                            cursor: not-allowed;
                            transform: none;
                        }
                    </style>
                    <script>
                        function setButtonsLoading(isLoading) {
                            const pdfButton = document.getElementById('pdf-button');
                            const wordButton = document.getElementById('word-button');
                            if (isLoading) {
                                pdfButton.innerText = 'Generando...';
                                pdfButton.disabled = true;
                                wordButton.disabled = true;
                            } else {
                                pdfButton.innerText = 'Descargar PDF';
                                pdfButton.disabled = false;
                                wordButton.disabled = false;
                            }
                        }

                        function downloadPDF() {
                            setButtonsLoading(true);
                            const report = document.getElementById('report-content');

                            html2canvas(report, {
                                scale: 2,
                                useCORS: true,
                                windowWidth: report.scrollWidth,
                                windowHeight: report.scrollHeight
                            }).then(canvas => {
                                const imgData = canvas.toDataURL('image/png');
                                const pdf = new window.jspdf.jsPDF({
                                    orientation: 'p',
                                    unit: 'mm',
                                    format: 'a4'
                                });

                                const imgProps = pdf.getImageProperties(imgData);
                                const pdfWidth = pdf.internal.pageSize.getWidth();
                                const pdfPageHeight = pdf.internal.pageSize.getHeight();
                                const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

                                let heightLeft = imgHeight;
                                let position = 0;
                                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                                heightLeft -= pdfPageHeight;
                                while (heightLeft > 0) {
                                    position = heightLeft - imgHeight;
                                    pdf.addPage();
                                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                                    heightLeft -= pdfPageHeight;
                                }

                                pdf.save('informe-${sanitizedStudentName}.pdf');
                                setButtonsLoading(false);
                            }).catch(err => {
                                alert("Error al generar PDF. Ver la consola para detalles.");
                                console.error(err);
                                setButtonsLoading(false);
                            });
                        }

                        function downloadWord() {
                            setButtonsLoading(true);
                            const reportContent = document.getElementById('report-content').innerHTML;
                            const header = \`
                                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                                <head><meta charset='utf-8'><title>Informe de Evaluación</title></head><body>\`;
                            const footer = '</body></html>';
                            const sourceHTML = header + reportContent + footer;
                            const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
                            const fileDownload = document.createElement("a");
                            document.body.appendChild(fileDownload);
                            fileDownload.href = source;
                            fileDownload.download = 'informe-${sanitizedStudentName}.doc';
                            fileDownload.click();
                            document.body.removeChild(fileDownload);
                            setButtonsLoading(false);
                        }
                    </script>
                </head>
                <body>
                    <div class="report-outer-container">
                        <div class="report-content" id="report-content">
                            <div class="header">
                                <div class="header-left">
                                    <img src="${DRAGONFLY_DATA_URL}" alt="Logo Libel-IA" />
                                    <div>
                                        <h1>Libel-IA</h1>
                                        <p>Informe de Evaluación Pedagógica</p>
                                    </div>
                                </div>
                                <div class="header-right">
                                    ${logoPreview ? `<img src="${logoPreview}" alt="Logo Colegio" />` : ''}
                                    <p><strong>Profesor:</strong> ${nombreProfesor || 'N/A'}</p>
                                    <p><strong>Asignatura:</strong> ${asignatura || 'N/A'}</p>
                                </div>
                            </div>
                            <div class="student-summary-grid">
                                <div class="summary-card">
                                    <div class="label">Nota Final</div>
                                    <div class="value">${finalNota}</div>
                                </div>
                                <div class="summary-card">
                                    <div class="label">Puntaje</div>
                                    <div class="value value-small">${group.puntaje || 'N/A'}</div>
                                </div>
                            </div>
                            <div class="section-card">
                                <h2>Resumen del Estudiante</h2>
                                <p><strong>Alumno:</strong> ${group.studentName} | <strong>Curso:</strong> ${curso || 'N/A'} | <strong>Fecha:</strong> ${format(new Date(), "dd/MM/yyyy")}</p>
                            </div>
                            <div class="feedback-grid">
                                <div class="feedback-card fortalezas">
                                    <h2>✅ Fortalezas</h2>
                                    <p>${resumen.fortalezas}</p>
                                </div>
                                <div class="feedback-card areas-mejora">
                                    <h2>✏️ Áreas de Mejora</h2>
                                    <p>${resumen.areas_mejora}</p>
                                </div>
                            </div>
                            ${buildTable('Corrección Detallada', ['Sección', 'Detalle'], group.retroalimentacion?.correccion_detallada, item => `<tr><td>${item.seccion || ''}</td><td>${item.detalle || ''}</td></tr>`)}
                            ${buildTable('Evaluación de Habilidades', ['Habilidad', 'Nivel', 'Evidencia'], group.retroalimentacion?.evaluacion_habilidades, item => `<tr><td>${item.habilidad || ''}</td><td>${item.evaluacion || ''}</td><td><i>"${item.evidencia || ''}"</i></td></tr>`)}
                        </div>
                        <div class="actions-container">
                            <button id="pdf-button" class="action-button pdf-button" onclick="downloadPDF()">Descargar PDF</button>
                            <button id="word-button" class="action-button word-button" onclick="downloadWord()">Descargar Word (Editable)</button>
                        </div>
                    </div>
                </body>
            </html>`;

        reportWindow.document.write(reportHTML);
        reportWindow.document.close();
    };

    const onEvaluateAll = async () => {
        const { rubrica, pauta, flexibilidad, tipoEvaluacion, areaConocimiento } = form.getValues();
        if (!rubrica) {
            form.setError("rubrica", { type: "manual", message: "La rúbrica es requerida." });
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
        const { curso, fechaEvaluacion, nombreProfesor, departamento, asignatura } = form.getValues();
        const fechaStr = fechaEvaluacion ? format(fechaEvaluacion, "dd/MM/yyyy") : "";
        const evaluatedGroups = studentGroups.filter(g => g.isEvaluated);
        if (evaluatedGroups.length === 0) {
            alert("No hay evaluaciones para exportar.");
            return;
        }
        if (formatType === 'csv') {
            const rows = [["Alumno", "Curso", "Puntaje", "Nota", "Décimas", "Nota Final", "Fecha"]];
            evaluatedGroups.forEach(g => {
                const finalNota = ((Number(g.nota) || 0) + g.decimasAdicionales).toFixed(1);
                rows.push([g.studentName, curso || "", g.puntaje || "", String(g.nota || 0), String(g.decimasAdicionales), finalNota, fechaStr]);
            });
            const csvContent = rows.map(r => r.map(v => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `resumen-notas_${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            const rows = evaluatedGroups.map(g => {
                const finalNota = ((Number(g.nota) || 0) + g.decimasAdicionales).toFixed(1);
                return `<tr><td>${g.studentName}</td><td>${curso || ""}</td><td>${g.puntaje || ""}</td><td>${g.nota || 0}</td><td>${g.decimasAdicionales}</td><td>${finalNota}</td><td>${fechaStr}</td></tr>`;
            }).join("");
            const htmlContent = `<html><head><meta charset="utf-8" /><title>Resumen de Notas</title><style>body{font-family:Arial,sans-serif}h1{font-size:18px}.meta{font-size:12px;color:#555;margin-bottom:10px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}thead th{background:#f2f2f2}.header{margin-bottom:12px}</style></head><body><div class="header"><h1>Resumen de Notas</h1><div class="meta">${nombreProfesor ? `<div><strong>Profesor:</strong> ${nombreProfesor}</div>` : ''}${asignatura ? `<div><strong>Asignatura:</strong> ${asignatura}</div>` : ''}${departamento ? `<div><strong>Departamento:</strong> ${departamento}</div>` : ''}${curso ? `<div><strong>Curso:</strong> ${curso}</div>` : ''}${fechaStr ? `<div><strong>Fecha:</strong> ${fechaStr}</div>` : ''}</div></div><table><thead><tr><th>Alumno</th><th>Curso</th><th>Puntaje</th><th>Nota</th><th>Décimas</th><th>Nota Final</th><th>Fecha</th></tr></thead><tbody>${rows || `<tr><td colspan="7">No hay evaluaciones.</td></tr>`}</tbody></table></body></html>`;
            const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `resumen-notas_${new Date().toISOString().slice(0,10)}.doc`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const isCurrentlyEvaluatingAny = studentGroups.some(g => g.isEvaluating);

    return (
        <div className={activeTab === 'inicio' ? 'theme-ocaso' : theme}>
            <GlobalStyles />
            {isCameraOpen && <SmartCameraModal onCapture={handleCapture} onClose={() => setIsCameraOpen(false)} />}
            <main className="p-4 md:p-8 max-w-6xl mx-auto font-sans bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-300">
                <div className="mb-6 p-3 rounded-lg flex items-center justify-between bg-[var(--bg-card)] border border-[var(--border-color)]">
                    <div className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-[var(--text-secondary)]" />
                        <span className="text-sm font-medium text-[var(--text-secondary)]">Tema</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant={theme === 'theme-default' ? 'default' : 'ghost'} onClick={() => setTheme('theme-default')} className={cn(theme !== 'theme-default' && "text-[var(--text-secondary)]")}>Predeterminado</Button>
                        <Button size="sm" variant={theme === 'theme-ocaso' ? 'default' : 'ghost'} onClick={() => setTheme('theme-ocaso')} className={cn(theme !== 'theme-ocaso' && "text-[var(--text-secondary)]")}>Ocaso</Button>
                        <Button size="sm" variant={theme === 'theme-corporativo' ? 'default' : 'ghost'} onClick={() => setTheme('theme-corporativo')} className={cn(theme !== 'theme-corporativo' && "text-[var(--text-secondary)]")}>Corporativo</Button>
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
                                <img src={DRAGONFLY_DATA_URL} alt="Logo" className="mx-auto h-36 w-36 mb-4"/>
                                <h1 className={`text-6xl font-bold ${wordmarkClass} font-logo`}>Libel-IA</h1>
                                <p className="mt-3 text-xl italic text-cyan-300">
                                    “Evaluación con Inteligencia Docente: Hecha por un Profe, para Profes”
                                </p>
                                <p className="mt-6 text-lg text-[var(--text-secondary)]">
                                    Asistente pedagógico inteligente que analiza las respuestas de tus estudiantes, genera retroalimentación detallada y crea informes al instante.
                                </p>
                                <Button size="lg" className="mt-8 text-lg py-6 px-8" onClick={() => setActiveTab("evaluator")}>
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
                                                <Input id="class-size" type="number" value={classSize} onChange={(e) => setClassSize(Number(e.target.value) || 1)} className="w-24 text-base" min="1"/>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                <FormField control={form.control} name="curso" render={({ field }) => (<FormItem className="flex items-center space-x-3"><FormLabel className="text-base font-bold mt-2 text-[var(--text-accent)]">Curso:</FormLabel><FormControl><Input placeholder="Ej: 8° Básico" {...field} className="w-40 text-base" /></FormControl></FormItem>)}/>
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
                                                        <SelectItem value="ciencias">Ciencias (Física, Química, Biología)</SelectItem>
                                                        <SelectItem value="ingles">Inglés y Otros Idiomas</SelectItem>
                                                        <SelectItem value="artes">Artes y Creatividad</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}/>
                                        <div className="p-4 border rounded-lg border-[var(--border-color)]">
                                            <h3 className="text-lg font-semibold mb-4 text-[var(--text-accent)]">Personalización del Informe</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <FormField control={form.control} name="nombreProfesor" render={({ field }) => (<FormItem><FormLabel className="text-[var(--text-accent)]">Nombre del Profesor</FormLabel><FormControl><Input placeholder="Ej: Juan Pérez" {...field} /></FormControl></FormItem>)} />
                                                <FormField control={form.control} name="departamento" render={({ field }) => (<FormItem><FormLabel className="text-[var(--text-accent)]">Departamento</FormLabel><FormControl><Input placeholder="Ej: Ciencias" {...field} /></FormControl></FormItem>)} />
                                                <FormField control={form.control} name="asignatura" render={({ field }) => (<FormItem><FormLabel className="text-[var(--text-accent)]">Asignatura</FormLabel><FormControl><Input placeholder="Ej: Lenguaje y Comunicación" {...field} /></FormControl></FormItem>)} />
                                                <FormField control={form.control} name="nombrePrueba" render={({ field }) => (<FormItem><FormLabel className="text-[var(--text-accent)]">Nombre de la Prueba</FormLabel><FormControl><Input placeholder="Ej: Ensayo Final" {...field} /></FormControl></FormItem>)} />
                                                <FormField control={form.control} name="fechaEvaluacion" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="text-[var(--text-accent)]">Fecha</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-[var(--text-secondary)]")}>{field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover></FormItem>)} />
                                                <div className="space-y-2 col-span-full"><Label className="text-[var(--text-accent)]">Logo del Colegio (Opcional)</Label><div className="flex items-center gap-4"><Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}><ImageUp className="mr-2 h-4 w-4" />Subir Logo</Button><input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoChange} className="hidden" />{logoPreview && <img src={logoPreview} alt="Vista previa del logo" className="h-12 w-auto object-contain border p-1 rounded-md" />}</div></div>
                                            </div>
                                        </div>
                                        <FormField control={form.control} name="rubrica" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-[var(--text-accent)]">Rúbrica (Criterios)</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="Ej: Evalúa claridad, estructura, ortografía..." className="min-h-[100px]" {...field} />
                                                </FormControl>
                                                <FormDescription>
                                                    Importante: Incluye el puntaje total de la evaluación (Ej: "Puntaje total: 60 puntos").
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}/>
                                        <FormField control={form.control} name="pauta" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-[var(--text-accent)]">Pauta (Respuestas)</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="Opcional. Pega aquí las respuestas correctas..." className="min-h-[100px]" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}/>
                                        <FormField control={form.control} name="flexibilidad" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-[var(--text-accent)]">Nivel de Flexibilidad</FormLabel>
                                                <FormControl>
                                                    <Slider min={1} max={5} step={1} defaultValue={field.value} onValueChange={field.onChange} />
                                                </FormControl>
                                                <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                                                    <span>Estricto</span>
                                                    <span>Flexible</span>
                                                </div>
                                            </FormItem>
                                        )}/>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>

                        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
                            <CardHeader>
                                <CardTitle className="text-[var(--text-accent)]">Paso 2: Cargar y Agrupar Trabajos</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <h3 className="font-bold text-[var(--text-accent)]">Cargar Archivos</h3>
                                    <div className="flex flex-wrap gap-4 mt-2 items-center">
                                        <Button type="button" onClick={() => { fileInputRef.current?.click(); }}><FileUp className="mr-2 h-4 w-4" /> Subir Archivos</Button>
                                        <Button type="button" variant="secondary" onClick={() => setIsCameraOpen(true)}><Camera className="mr-2 h-4 w-4" /> Usar Cámara</Button>
                                        <input type="file" multiple ref={fileInputRef} onChange={(e) => handleFilesSelected(e.target.files)} className="hidden" />
                                        <p className="text-sm text-[var(--text-secondary)]">Consejo: Sube primero la página con el nombre.</p>
                                    </div>
                                </div>
                                {unassignedFiles.length > 0 && (
                                    <div className="p-4 border rounded-lg bg-[var(--bg-muted-subtle)] border-[var(--border-color)]">
                                        <h3 className="font-semibold mb-3 flex items-center text-[var(--text-accent)]"><ClipboardList className="mr-2 h-5 w-5" /> Archivos Pendientes</h3>
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
                                                        <select onChange={(e) => { if (e.target.value) assignFileToGroup(e.target.value, group.id); e.target.value = ""; }} className="text-sm bg-transparent">
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
                                <CardHeader>
                                    <CardTitle className="text-[var(--text-accent)]">Paso 3: Resultados</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {studentGroups.filter(g => g.isEvaluated || g.isEvaluating).map(group => {
                                        const finalNota = (Number(group.nota) || 0) + group.decimasAdicionales;
                                        return (
                                            <div key={group.id} className={`p-6 rounded-lg border-l-4 ${group.error ? 'border-red-500' : 'border-green-500'} bg-[var(--bg-card)] shadow`}>
                                                <div className="flex justify-between items-center flex-wrap gap-2">
                                                    <h3 className="font-bold text-xl text-[var(--text-accent)]">{group.studentName}</h3>
                                                    {group.isEvaluating && <div className="flex items-center text-sm text-[var(--text-secondary)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</div>}
                                                    {group.isEvaluated && !group.error && <Button variant="ghost" size="sm" onClick={() => generateReport(group)}><Printer className="mr-2 h-4 w-4" />Ver Informe</Button>}
                                                </div>
                                                {group.error ? <p className="text-red-600">Error: {group.error}</p> : <div className="mt-4 space-y-6">
                                                    {group.isEvaluated && group.retroalimentacion && <>
                                                        <div className="flex justify-between items-start bg-[var(--bg-muted-subtle)] p-4 rounded-lg">
                                                            <div>
                                                                <p className="text-sm font-bold">PUNTAJE</p>
                                                                <p className="text-xl font-semibold">{group.puntaje || 'N/A'}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="flex items-center gap-2">
                                                                    <label htmlFor={`decimas-${group.id}`} className="text-sm font-medium">Décimas:</label>
                                                                    <Input id={`decimas-${group.id}`} type="number" step="0.1" defaultValue={group.decimasAdicionales} onChange={e => handleDecimasChange(group.id, e.target.value)} className="h-8 w-20" />
                                                                </div>
                                                                <p className="text-sm font-bold mt-2">NOTA FINAL</p>
                                                                <p className="text-3xl font-bold text-blue-600">{finalNota.toFixed(1)}</p>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold mb-2 text-[var(--text-accent)]">Corrección Detallada</h4>
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
                                                        <div>
                                                            <h4 className="font-bold mb-2 text-[var(--text-accent)]">Evaluación de Habilidades</h4>
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
                                                    </>}
                                                </div>}
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
                        <NotesDashboard studentGroups={studentGroups} curso={form.getValues("curso")} fecha={form.getValues("fechaEvaluacion")} />
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}