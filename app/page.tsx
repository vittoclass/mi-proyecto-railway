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
          console.error("Error loading saved config:", error)
          return
        }

        if (savedData && savedData[0]?.data) {
          setEvaluations(savedData[0].data)
        }
      } catch (err) {
        console.error("Unexpected error loading config:", err)
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
    <main>
      {/* Tu interfaz va aquí */}
    </main>
  )
}
