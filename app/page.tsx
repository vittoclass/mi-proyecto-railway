// /app/page.tsx
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
  profesor: string
  departamento: string
  fecha: string
  evaluacion: string
  retroalimentacion: string
  puntaje: string
}

export default function Home() {
  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([])
  const [nombre, setNombre] = useState("")
  const [curso, setCurso] = useState("")
  const [profesor, setProfesor] = useState("")
  const [departamento, setDepartamento] = useState("")
  const [evaluacion, setEvaluacion] = useState("")
  const [retroalimentacion, setRetroalimentacion] = useState("")
  const [puntaje, setPuntaje] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
          setError("Hubo un problema al conectar con la base de datos.")
          return
        }

        if (savedData && savedData[0]?.data?.length > 0) {
          setEvaluations(savedData[0].data)
        } else {
          setEvaluations([])
        }
      } catch (err: any) {
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
      profesor,
      departamento,
      fecha: new Date().toLocaleDateString(),
      evaluacion,
      retroalimentacion,
      puntaje,
    }
    saveEvaluations([newEvaluation])
    setNombre("")
    setCurso("")
    setProfesor("")
    setDepartamento("")
    setEvaluacion("")
    setRetroalimentacion("")
    setPuntaje("")
    setSuccess("Evaluación guardada correctamente.")
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "Poppins, sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", color: "#4b0082" }}>Evaluador Educativo LibelIA</h1>

      {error && <p style={{ color: "red", fontWeight: "bold" }}>{error}</p>}
      {success && <p style={{ color: "green", fontWeight: "bold" }}>{success}</p>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "2rem" }}>
        <input type="text" placeholder="Nombre del estudiante" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <input type="text" placeholder="Curso" value={curso} onChange={(e) => setCurso(e.target.value)} required />
        <input type="text" placeholder="Profesor" value={profesor} onChange={(e) => setProfesor(e.target.value)} />
        <input type="text" placeholder="Departamento" value={departamento} onChange={(e) => setDepartamento(e.target.value)} />
        <textarea placeholder="Texto de la evaluación" value={evaluacion} onChange={(e) => setEvaluacion(e.target.value)} required rows={5} />
        <textarea placeholder="Retroalimentación profesional" value={retroalimentacion} onChange={(e) => setRetroalimentacion(e.target.value)} required rows={3} />
        <input type="text" placeholder="Puntaje (nota del 1 al 7)" value={puntaje} onChange={(e) => setPuntaje(e.target.value)} required />
        <button type="submit" style={{ backgroundColor: "#4b0082", color: "white", padding: "0.5rem", borderRadius: "5px" }}>
          Guardar Evaluación
        </button>
      </form>

      <h2 style={{ marginTop: "2rem", color: "#4b0082" }}>Historial de Evaluaciones</h2>
      {evaluations.length === 0 && <p>No hay evaluaciones registradas aún.</p>}
      {evaluations.length > 0 && (
        <ul style={{ marginTop: "1rem" }}>
          {evaluations.map((evalItem, idx) => (
            <li key={idx} style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "1rem", borderRadius: "5px" }}>
              <p><strong>Estudiante:</strong> {evalItem.nombre}</p>
              <p><strong>Curso:</strong> {evalItem.curso}</p>
              <p><strong>Profesor:</strong> {evalItem.profesor}</p>
              <p><strong>Departamento:</strong> {evalItem.departamento}</p>
              <p><strong>Fecha:</strong> {evalItem.fecha}</p>
              <p><strong>Evaluación:</strong> {evalItem.evaluacion}</p>
              <p><strong>Retroalimentación:</strong> {evalItem.retroalimentacion}</p>
              <p><strong>Puntaje:</strong> {evalItem.puntaje}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
