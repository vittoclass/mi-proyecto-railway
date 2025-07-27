// app/page.tsx
import EvaluatorClient from './EvaluatorClient'; // Asegúrate que EvaluatorClient.tsx esté en la carpeta app/

export default function Home() {
  // Renderiza directamente el componente que ya tiene toda la lógica
  return <EvaluatorClient />;
}