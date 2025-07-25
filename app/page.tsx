'use client'

import { useEffect, useState, useRef } from "react"
import { createClient } from '@supabase/supabase-js'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Evaluacion {
  nombre: string
  curso: string
  profesor: string
  departamento: string
  imagen: string
  fecha: string
  evaluacion: string
  retroalimentacion: string
  puntaje: string
}

export default function Page() {
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([])
  const [nombre, setNombre] = useState("")
  const [curso, setCurso] = useState("")
  const [profesor, setProfesor] = useState("")
  const [departamento, setDepartamento] = useState("")
  const [evaluacion, setEvaluacion] = useState("")
  const [retroalimentacion, setRetroalimentacion] = useState("")
  const [puntaje, setPuntaje] = useState("")
  const [imagenURL, setImagenURL] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const { data, error } = await supabase.storage.from("imagenes").upload(`evaluaciones/${file.name}`, file, {
      cacheControl: '3600',
      upsert: true
    })

    if (error) {
      console.error("Error al subir la imagen:", error)
    } else {
      const { data: urlData } = supabase
        .storage
        .from("imagenes")
        .getPublicUrl(`evaluaciones/${file.name}`)
      setImagenURL(urlData.publicUrl)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const nuevaEvaluacion: Evaluacion = {
      nombre,
      curso,
      profesor,
      departamento,
      imagen: imagenURL,
      fecha: new Date().toLocaleDateString(),
      evaluacion,
      retroalimentacion,
      puntaje
    }

    const { error } = await supabase
      .from("evaluaciones")
      .insert([{ ...nuevaEvaluacion }])

    if (error) {
      alert("Hubo un problema al conectar con la base de datos.")
      console.error(error)
    } else {
      alert("Evaluaciones guardadas")
      setEvaluaciones([...evaluaciones, nuevaEvaluacion])
    }
  }

  return (
    <main style={{ padding: 20, fontFamily: 'Arial' }}>
      <h1>Evaluador IA LibelIA</h1>

      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Nombre del estudiante" value={nombre} onChange={e => setNombre(e.target.value)} required />
        <input type="text" placeholder="Curso" value={curso} onChange={e => setCurso(e.target.value)} required />
        <input type="text" placeholder="Nombre del profesor" value={profesor} onChange={e => setProfesor(e.target.value)} required />
        <input type="text" placeholder="Departamento" value={departamento} onChange={e => setDepartamento(e.target.value)} required />
        <textarea placeholder="Texto del estudiante" value={evaluacion} onChange={e => setEvaluacion(e.target.value)} required />
        <textarea placeholder="Retroalimentación" value={retroalimentacion} onChange={e => setRetroalimentacion(e.target.value)} required />
        <input type="text" placeholder="Puntaje" value={puntaje} onChange={e => setPuntaje(e.target.value)} required />

        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} />
        <button type="submit">Guardar Evaluación</button>
      </form>

      <div>
        <h2>Historial</h2>
        {evaluaciones.map((evalItem, index) => (
          <div key={index} style={{ border: '1px solid #999', margin: 10, padding: 10 }}>
            <p><strong>Estudiante:</strong> {evalItem.nombre}</p>
            <p><strong>Curso:</strong> {evalItem.curso}</p>
            <p><strong>Profesor:</strong> {evalItem.profesor}</p>
            <p><strong>Departamento:</strong> {evalItem.departamento}</p>
            <p><strong>Evaluación:</strong> {evalItem.evaluacion}</p>
            <p><strong>Retroalimentación:</strong> {evalItem.retroalimentacion}</p>
            <p><strong>Puntaje:</strong> {evalItem.puntaje}</p>
            <img src={evalItem.imagen} alt="Evidencia" width="200" />
          </div>
        ))}
      </div>
    </main>
  )
}
