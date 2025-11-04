'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import EvaluacionPDF from './EvaluacionPDF';

// 🔑 NUEVO: Define las props que recibirá
interface NotesDashboardProps {
  studentGroups?: any[];
  curso?: string;
  fecha?: Date;
}

// 🔑 NUEVO: Agrégalo al componente
const NotesDashboard = ({ studentGroups, curso, fecha }: NotesDashboardProps) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    const fetchEvaluations = async () => {
      try {
        const res = await fetch('/api/evaluations');
        if (res.ok) {
          const data = await res.json();
          setEvaluations(data);
        }
      } catch (error) {
        console.error('Error fetching evaluations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvaluations();
  }, [session, status, router]);

  const handleSelectEvaluation = (evaluation: any) => {
    setSelectedEvaluation(evaluation);
  };

  if (status === 'loading' || loading) {
    return <div className="p-6">Cargando evaluaciones...</div>;
  }

  if (!session) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mis Evaluaciones</h1>

      {evaluations.length === 0 ? (
        <p>No tienes evaluaciones aún.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {evaluations.map((evaluacion) => (
            <div
              key={evaluacion.id}
              className="border rounded-lg p-4 hover:shadow-md cursor-pointer"
              onClick={() => handleSelectEvaluation(evaluacion)}
            >
              <h3 className="font-semibold">{evaluacion.nombreEstudiante || 'Estudiante'}</h3>
              <p>Nota: {evaluacion.nota}</p>
              <p>Área: {evaluacion.areaConocimiento}</p>
              <p className="text-sm text-gray-500">
                {new Date(evaluacion.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {selectedEvaluation && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Vista Previa del PDF</h3>
          <EvaluacionPDF
            nombreEstudiante={selectedEvaluation.nombreEstudiante}
            puntaje={selectedEvaluation.puntaje}
            nota={selectedEvaluation.nota}
            retroalimentacion={selectedEvaluation.retroalimentacion}
            areaConocimiento={selectedEvaluation.areaConocimiento}
          />
        </div>
      )}
    </div>
  );
};

export default NotesDashboard;