import EvaluatorClient from './EvaluatorClient';
import CreditGate from '@/components/CreditGate';   // 👈 agregado

export default function Home() {
  return (
    <CreditGate>
      <EvaluatorClient />   {/* 👈 tu app, intacta */}
    </CreditGate>
  );
}
