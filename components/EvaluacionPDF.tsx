import React from "react";
import { Page, Text, View, Document, StyleSheet, Image, Font } from "@react-pdf/renderer";

// ✅ CORRECCIÓN CLAVE: Registro completo de todas las variantes de Roboto
Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf",
      fontWeight: 400,
      fontStyle: "normal",
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-italic-webfont.ttf",
      fontWeight: 400,
      fontStyle: "italic",
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf",
      fontWeight: 700,
      fontStyle: "normal",
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bolditalic-webfont.ttf",
      fontWeight: 700,
      fontStyle: "italic",
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: "Roboto",
  },
  section: {
    margin: 10,
    padding: 10,
    border: "1px solid #e0e0e0",
    borderRadius: 4,
  },
  header: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "bold",
    color: "#4F46E5",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 4,
    color: "#374151",
  },
  label: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#6B7280",
  },
  value: {
    fontSize: 10,
    marginBottom: 4,
    color: "#111827",
  },
  placeholder: {
    fontSize: 9,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  table: {
    display: "table",
    width: "100%",
    marginTop: 8,
    border: "1px solid #e5e7eb",
  },
  tableRow: {
    flexDirection: "row",
  },
  tableColHeader: {
    width: "33%",
    borderRight: "1px solid #e5e7eb",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    padding: 4,
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
  },
  tableCol: {
    width: "33%",
    borderRight: "1px solid #e5e7eb",
    padding: 4,
    fontSize: 8,
    textAlign: "left",
  },
});

interface Props {
  group: any;
  formData: any;
  logoPreview: string | null;
}

const EvaluacionPDF = ({ group, formData, logoPreview }: Props) => {
  const studentName = group?.studentName || "Alumno no identificado";
  const puntaje = group?.puntaje || "N/A";
  const nota = group?.nota !== undefined ? group.nota : "N/A";
  const retro = group?.retroalimentacion || {};

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Encabezado */}
        <View style={styles.section}>
          {logoPreview ? (
            <Image src={logoPreview} style={{ width: 100, height: 50, marginBottom: 10 }} />
          ) : (
            <Text style={{ textAlign: "center", fontSize: 10, color: "#6B7280", marginBottom: 10 }}>
              [Logo del Colegio]
            </Text>
          )}
          <Text style={styles.header}>Reporte de Evaluación — {studentName}</Text>
          <Text style={styles.value}>Fecha: {new Date().toLocaleDateString()}</Text>
          <Text style={styles.value}>Profesor: {formData?.nombreProfesor || "No especificado"}</Text>
          <Text style={styles.value}>Asignatura: {formData?.asignatura || "No especificada"}</Text>
          <Text style={styles.value}>Curso: {formData?.curso || "No especificado"}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
            <View>
              <Text style={styles.label}>PUNTAJE</Text>
              <Text style={{ ...styles.value, fontSize: 14, fontWeight: "bold" }}>{puntaje}</Text>
            </View>
            <View>
              <Text style={styles.label}>NOTA FINAL</Text>
              <Text style={{ ...styles.value, fontSize: 14, fontWeight: "bold", color: "#059669" }}>{nota}</Text>
            </View>
          </View>
        </View>

        {/* Retroalimentación Detallada */}
        {retro && (
          <>
            {/* Fortalezas y Áreas de Mejora */}
            {(retro.resumen_general?.fortalezas || retro.resumen_general?.areas_mejora) && (
              <View style={styles.section}>
                <Text style={styles.subtitle}>Resumen Pedagógico</Text>
                {retro.resumen_general?.fortalezas && (
                  <>
                    <Text style={styles.label}>Fortalezas:</Text>
                    <Text style={styles.value}>{retro.resumen_general.fortalezas}</Text>
                  </>
                )}
                {retro.resumen_general?.areas_mejora && (
                  <>
                    <Text style={styles.label}>Áreas de Mejora:</Text>
                    <Text style={styles.value}>{retro.resumen_general.areas_mejora}</Text>
                  </>
                )}
              </View>
            )}

            {/* Corrección Detallada */}
            {Array.isArray(retro.correccion_detallada) && retro.correccion_detallada.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.subtitle}>Corrección por Sección</Text>
                <View style={styles.table}>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableColHeader}>Sección</Text>
                    <Text style={styles.tableColHeader}>Detalle</Text>
                    <Text style={styles.tableColHeader}>Recomendación</Text>
                  </View>
                  {retro.correccion_detallada.map((item: any, index: number) => (
                    <View key={index} style={styles.tableRow}>
                      <Text style={styles.tableCol}>{item.seccion || "N/A"}</Text>
                      <Text style={styles.tableCol}>{item.detalle || "Sin detalle"}</Text>
                      <Text style={styles.tableCol}>{item.recomendacion || "Sin recomendación"}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.subtitle}>Corrección por Sección</Text>
                <Text style={styles.placeholder}>La IA no generó corrección detallada para esta evaluación.</Text>
              </View>
            )}

            {/* Evaluación de Habilidades */}
            {Array.isArray(retro.evaluacion_habilidades) && retro.evaluacion_habilidades.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.subtitle}>Evaluación de Habilidades</Text>
                <View style={styles.table}>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableColHeader}>Habilidad</Text>
                    <Text style={styles.tableColHeader}>Nivel</Text>
                    <Text style={styles.tableColHeader}>Evidencia</Text>
                  </View>
                  {retro.evaluacion_habilidades.map((item: any, index: number) => (
                    <View key={index} style={styles.tableRow}>
                      <Text style={styles.tableCol}>{item.habilidad || "N/A"}</Text>
                      <Text style={styles.tableCol}>{item.evaluacion || "N/A"}</Text>
                      <Text style={styles.tableCol}>{item.evidencia || "Sin evidencia"}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.subtitle}>Evaluación de Habilidades</Text>
                <Text style={styles.placeholder}>La IA no evaluó habilidades específicas en esta entrega.</Text>
              </View>
            )}

            {/* Alternativas */}
            {Array.isArray(retro.retroalimentacion_alternativas) && retro.retroalimentacion_alternativas.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.subtitle}>Análisis de Alternativas</Text>
                {retro.retroalimentacion_alternativas.map((item: any, index: number) => (
                  <View key={index} style={{ marginBottom: 6 }}>
                    <Text style={styles.label}>Pregunta {index + 1}:</Text>
                    <Text style={styles.value}>{item.pregunta || "Sin pregunta"}</Text>
                    <Text style={styles.label}>Tu respuesta:</Text>
                    <Text style={{ ...styles.value, color: "#DC2626" }}>{item.respuesta_estudiante || "N/A"}</Text>
                    <Text style={styles.label}>Respuesta correcta:</Text>
                    <Text style={{ ...styles.value, color: "#059669" }}>{item.respuesta_correcta || "N/A"}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.subtitle}>Análisis de Alternativas</Text>
                <Text style={styles.placeholder}>No se detectaron preguntas de alternativas en esta evaluación.</Text>
              </View>
            )}
          </>
        )}

        <View style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
          <Text style={{ fontSize: 8, textAlign: "center", color: "#6B7280" }}>
            Generado por Libel-IA — Inteligencia Artificial para Educadores • {new Date().toLocaleString()}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default EvaluacionPDF;