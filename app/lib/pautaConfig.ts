// pautaConfig.ts

interface ItemPuntaje {
    id: string;
    maxScore: number;
    isDevelopment: boolean;
}

/**
 * Función que aísla la lógica de puntuación de la prueba.
 * * En un sistema final, esta función recibiría los resultados del OMR
 * (Respuestas del Alumno) y los compararía con la pauta correcta.
 * * Para propósitos de estabilidad, el servidor debe recibir la corrección
 * de alternativas ya realizada por una fuente externa (un OMR o un profesor).
 * * @param pautaEstructurada La pauta de puntajes del profesor (ej: SM1:1; P1:2;)
 * @param pautaCorrectaAlternativas La pauta de respuestas correctas (ej: {SM1: 'A'})
 * @returns El puntaje total de Alternativas, el array de pauta de desarrollo para el Prompt, y la pauta general de ítems.
 */
export function processPautaConfig(
    pautaEstructurada: string, 
    pautaCorrectaAlternativas: { [key: string]: string } | undefined
): {
    itemScores: ItemPuntaje[];
    maxDesarrolloScore: number;
    maxAlternativasScore: number;
} {
    
    const itemScores = parsePautaEstructurada(pautaEstructurada);
    
    let maxDesarrolloScore = 0;
    let maxAlternativasScore = 0;

    for (const item of itemScores) {
        if (item.isDevelopment) {
            maxDesarrolloScore += item.maxScore;
        } else {
            maxAlternativasScore += item.maxScore;
        }
    }
    
    // Devolvemos la estructura necesaria para que route.ts pueda calcular el total
    return {
        itemScores,
        maxDesarrolloScore,
        maxAlternativasScore,
    };
}

// Replicamos la función parsePautaEstructurada aquí para que el módulo sea autónomo
function parsePautaEstructurada(pautaStr: string): ItemPuntaje[] {
    const items: ItemPuntaje[] = [];
    if (!pautaStr) return items;

    const pairs = pautaStr.split(';').map(p => p.trim()).filter(p => p.length > 0);

    for (const pair of pairs) {
        const [id, scoreStr] = pair.split(':').map(s => s.trim());
        const maxScore = parseInt(scoreStr, 10);
        
        if (id && !isNaN(maxScore) && maxScore > 0) {
            items.push({
                id: id,
                maxScore: maxScore,
                isDevelopment: id.toLowerCase().includes('desarrollo') || id.toLowerCase().match(/^p\d+/) !== null
            });
        }
    }
    return items;
}