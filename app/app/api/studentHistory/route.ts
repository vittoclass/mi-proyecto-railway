import { NextRequest, NextResponse } from 'next/server';
import { getStudentHistory } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const studentId = req.nextUrl.searchParams.get('studentId');
    if (!studentId) return NextResponse.json({ success: false, error: 'Falta studentId' }, { status: 400 });

    const history = await getStudentHistory(studentId);
    return NextResponse.json({ success: true, history });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
