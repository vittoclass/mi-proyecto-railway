'use client'

import { useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@supabase/supabase-js"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type StudentEvaluation = {
  nombre: string
  curso: string
  fecha: string
  evaluacion: string
  retroalimentacion: string
  puntaje: string
}

export default function Home() {
  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([])
  const [nombre, setNombre] = useState("")
  const [curso, setCurso] = useState("")
  const [evaluacion, setEvaluacion] = useState("")
  const [retroalimentacion, setRetroalimentacion] = useState("")
  const [puntaje, setPuntaje] = useState("")
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  useEffect(() => {
    const fetchEvaluations = async () => {
      try {
        const { data: savedData, error } = await supabase
          .from("evaluaciones")
          .select("data")
          .eq("usuario_id", "usuario_demo")
          .order("fecha", { ascending: false })
          .limit(1)

        if (error) {
          console.error("Error al cargar los datos:", error.message)
          setError("Hubo un problema al conectar con la base de datos.")
          return
        }

        if (savedData && savedData[0]?.data?.length > 0) {
          setEvaluations(savedData[0].data)
        } else {
          setEvaluations([])
        }
      } catch (err: any) {
        console.error("Error inesperado:", err.message)
        setError("Error inesperado al cargar las evaluaciones.")
      }
    }

    fetchEvaluations()
  }, [])

  const saveEvaluations = useCallback((newEvaluations: StudentEvaluation[]) => {
    setEvaluations((prev) => {
      const updated = [...prev, ...newEvaluations]
      supabase.from("evaluaciones").insert([
        {
          usuario_id: "usuario_demo",
          fecha: new Date().toISOString(),
          data: updated,
        },
      ])
      return updated
    })
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newEvaluation: StudentEvaluation = {
      nombre,
      curso,
      fecha: new Date().toLocaleDateString(),
      evaluacion,
      retroalimentacion,
      puntaje,
    }
    saveEvaluations([newEvaluation])
    setNombre("")
    setCurso("")
    setEvaluacion("")
    setRetroalimentacion("")
    setPuntaje("")
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Evaluaciones guardadas</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {evaluations.length === 0 && !error && (
        <p>No hay evaluaciones registradas aún.</p>
      )}

      {evaluations.length > 0 && (
        <ul>
          {evaluations.map((evalItem, idx) => (
            <li key={idx} style={{ marginBottom: "1rem", borderBottom: "1px solid #ccc", paddingBottom: "1rem" }}>
              <p><strong>Nombre:</strong> {evalItem.nombre || "N/A"}</p>
              <p><strong>Curso:</strong> {evalItem.curso || "N/A"}</p>
              <p><strong>Fecha:</strong> {evalItem.fecha || "N/A"}</p>
              <p><strong>Evaluación:</strong> {evalItem.evaluacion || "N/A"}</p>
              <p><strong>Retroalimentación:</strong> {evalItem.retroalimentacion || "N/A"}</p>
              <p><strong>Puntaje:</strong> {evalItem.puntaje || "N/A"}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Aquí continúa tu interfaz profesional */}
    </main>
  )
}
