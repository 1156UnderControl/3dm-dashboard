export interface MatrixInput {
  archetypes: string[];
  priorities: { id: string; bucket: 'Precisamos' | 'Queremos' }[];
  coverage: { archetypeId: string; priorityId: string; atende: boolean }[];
  attributes: { atributo: string; peso: number }[];
  scores: { archetypeId: string; attribute: string; nota: number }[];
}
export interface MatrixResult { coveragePct: number; weighted: number; finalPct: number; missingNeeds: string[] }

export function scoreMatrix(input: MatrixInput): Record<string, MatrixResult> {
  const { archetypes, priorities, coverage, attributes, scores } = input;
  const totalPeso = attributes.reduce((s, a) => s + a.peso, 0);
  const out: Record<string, MatrixResult> = {};
  for (const arch of archetypes) {
    const covered = (pid: string) =>
      coverage.some((c) => c.archetypeId === arch && c.priorityId === pid && c.atende);
    const coveredCount = priorities.filter((p) => covered(p.id)).length;
    const coveragePct = priorities.length === 0 ? 1 : coveredCount / priorities.length;
    const missingNeeds = priorities.filter((p) => p.bucket === 'Precisamos' && !covered(p.id)).map((p) => p.id);
    const sum = attributes.reduce((s, a) => {
      const nota = scores.find((x) => x.archetypeId === arch && x.attribute === a.atributo)?.nota ?? 0;
      return s + a.peso * nota;
    }, 0);
    const weighted = totalPeso === 0 ? 0 : sum / (totalPeso * 5);
    out[arch] = { coveragePct, weighted, finalPct: Math.round((100 * (coveragePct + weighted)) / 2), missingNeeds };
  }
  return out;
}
