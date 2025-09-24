import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // SOLO backend
export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Obtener historial de evaluaciones de un estudiante
 */
export const getStudentHistory = async (studentId: string) => {
  const { data, error } = await supabase
    .from('evaluations')
    .select('score, feedback, date')
    .eq('student_id', studentId)
    .order('date', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
};
