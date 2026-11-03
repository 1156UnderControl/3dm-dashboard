export type ColumnType =
  | 'text' | 'longtext' | 'number' | 'enum' | 'link' | 'image' | 'person' | 'date' | 'bool';
export interface ColumnDef { key: string; label: string; type: ColumnType; options?: string[] }
export interface ItemKindDef { kind: string; label: string; columns: ColumnDef[] }
export type StepView = 'table' | 'priority-board' | 'decision-matrix' | 'cad-flow';
export interface StepDef {
  id: string;
  stage: 1 | 2 | 3 | 4 | 5;
  title: string;
  description: string;
  guidance?: string;
  view: StepView;
  kinds: ItemKindDef[];
}

export const STAGES: { stage: 1 | 2 | 3 | 4 | 5; title: string }[] = [
  { stage: 1, title: 'Análise do jogo' },
  { stage: 2, title: 'Lista de prioridades' },
  { stage: 3, title: 'Prototipagem' },
  { stage: 4, title: 'Arquétipos' },
  { stage: 5, title: 'Requisitos e CAD' },
];

const t = (key: string, label: string): ColumnDef => ({ key, label, type: 'text' });
const lt = (key: string, label: string): ColumnDef => ({ key, label, type: 'longtext' });
const num = (key: string, label: string): ColumnDef => ({ key, label, type: 'number' });
const en = (key: string, label: string, options: string[]): ColumnDef => ({ key, label, type: 'enum', options });
const col = (type: ColumnType, key: string, label: string): ColumnDef => ({ key, label, type });

export const STEPS: StepDef[] = [
  {
    id: '1.1', stage: 1, title: 'Resumo', view: 'table',
    description: 'Resumo das pontuações do jogo e como atingir os RPs (ranking points).',
    guidance: 'Liste as ações que valem pontos, em qual período da partida ocorrem e quanto valem. Registre também cada RP, seu requisito e se depende da aliança.',
    kinds: [
      { kind: 'scoring', label: 'Pontuação', columns: [
        t('acao', 'Ação'), t('periodo', 'Período'), num('pontos', 'Pontos'), t('observacao', 'Observação')] },
      { kind: 'rp', label: 'Ranking Point', columns: [
        t('nome', 'Nome'), lt('requisito', 'Requisito'), col('bool', 'depende_alianca', 'Depende da aliança?')] },
    ],
  },
  {
    id: '1.2', stage: 1, title: 'Decomposição do jogo', view: 'table',
    description: 'Descrição das principais penalidades e regras de gameplay.',
    guidance: 'Esta é a nossa base de dados bruta. Antes de decidir o que fazer, é preciso saber o que o manual permite e proíbe. Para cada regra, escreva por que ela importa e qual a penalidade. Use as perguntas para registrar dúvidas e respostas, com a citação do manual.',
    kinds: [
      { kind: 'rule', label: 'Regra', columns: [
        t('regra', 'Regra'), lt('texto', 'Escrita da regra'), lt('porque', 'Por que é importante?'),
        t('penalidade', 'Penalidade'), en('categoria', 'Categoria', ['Gameplay', 'Robô', 'Bumper', 'Outros'])] },
      { kind: 'question', label: 'Pergunta', columns: [
        t('pergunta', 'Pergunta'), lt('resposta', 'Resposta'), t('citacao', 'Citação')] },
    ],
  },
  {
    id: '1.3', stage: 1, title: 'Simulador de pontuação', view: 'table',
    description: 'Calculadora de pontuação para simular diferentes partidas.',
    guidance: 'Descreva cada cenário com os parâmetros do robô e o cronograma da partida, registre a pontuação obtida e o que se conclui dela.',
    kinds: [
      { kind: 'scenario', label: 'Cenário', columns: [
        t('nome', 'Nome'), lt('parametros', 'Parâmetros'), lt('cronograma', 'Cronograma'),
        num('pontuacao', 'Pontuação'), t('conclusao', 'Conclusão')] },
    ],
  },
  {
    id: '1.3.2', stage: 1, title: 'Papéis e partidas', view: 'table',
    description: 'Papéis de jogo em cada tipo de partida, de classificatórias a Einstein.',
    guidance: 'Para cada fase da competição, defina o papel de cada robô da aliança e do human player, e o que isso implica para o nosso robô.',
    kinds: [
      { kind: 'role-scenario', label: 'Papel por partida', columns: [
        en('nivel', 'Nível', ['Classificatórias regional', 'Eliminatórias regional', 'Classificatórias mundial', 'Eliminatórias mundial', 'Einstein']),
        col('person', 'autor', 'Autor'), t('robo1', 'Robô 1'), t('robo2', 'Robô 2'), t('robo3', 'Robô 3'),
        t('human_player', 'Human player'), t('conclusao', 'Conclusão')] },
    ],
  },
  {
    id: '1.4', stage: 1, title: 'Habilidades do robô', view: 'table',
    description: 'Lista de todas as habilidades que um robô pode ter neste jogo.',
    guidance: 'Liste as possíveis habilidades do robô e os KPIs (indicadores-chave de desempenho) que medem quão bem cada uma é executada.',
    kinds: [
      { kind: 'skill', label: 'Habilidade', columns: [
        t('categoria', 'Categoria'), t('habilidade', 'Habilidade'), lt('kpis', 'KPIs')] },
    ],
  },
  {
    id: '1.5', stage: 1, title: 'Análise histórica', view: 'table',
    description: 'Um breve estudo de ações deste jogo que apareceram em outros jogos.',
    guidance: 'O objetivo desta aba é atalhar o processo de design copiando o que já foi provado. Para cada ação do jogo atual, encontre jogos similares, robôs de referência e o mecanismo usado.',
    kinds: [
      { kind: 'reference', label: 'Referência', columns: [
        t('acao', 'Ação do jogo atual'), t('jogo_ano', 'Ano / Jogo similar'), t('robo_referencia', 'Robô referência'),
        col('link', 'link', 'Link'), t('mecanismo', 'Mecanismo'), lt('observacoes', 'Observações'), col('image', 'foto', 'Foto')] },
    ],
  },
  {
    id: '1.6', stage: 1, title: 'Autônomos', view: 'table',
    description: 'Possíveis rotinas autônomas; revisitar após a week 1.',
    guidance: 'Descreva cada rotina, suas variações e ações, o tempo que leva e quantos pontos rende sozinha e em conjunto com a aliança.',
    kinds: [
      { kind: 'auto', label: 'Autônomo', columns: [
        t('nome', 'Nome'), lt('descricao', 'Descrição'), lt('variacoes', 'Variações'), lt('acoes', 'Ações'),
        num('tempo_s', 'Tempo (s)'), num('pontos_solo', 'Pontos solo'), num('pontos_alianca', 'Pontos com aliança')] },
    ],
  },
  {
    id: '2', stage: 2, title: 'Lista de prioridades', view: 'priority-board',
    description: 'Uma lista que define estrategicamente as prioridades de design da equipe.',
    guidance: 'Precisamos: sem isso o robô é inútil ou não joga o jogo. Queremos: aumenta muito a nossa chance de sucesso e deve ser buscado. Seria bom: traz vantagem, mas só entra se sobrar tempo e recurso. Ignorar: decidimos conscientemente não fazer.',
    kinds: [
      { kind: 'priority', label: 'Prioridade', columns: [
        t('item', 'Item'), en('bucket', 'Categoria', ['Precisamos', 'Queremos', 'Seria bom', 'Ignorar']),
        t('meta', 'Meta'), lt('motivo', 'Motivo')] },
      { kind: 'role', label: 'Papel do robô', columns: [t('papel', 'Papel'), lt('descricao', 'Descrição')] },
    ],
  },
  {
    id: '3', stage: 3, title: 'Prototipagem de conceitos', view: 'table',
    description: 'Uma lista de quais conceitos precisam ser prototipados e qual a fidelidade necessária.',
    guidance: 'O objetivo desta aba não é listar "coisas para construir", mas sim "perguntas para responder". Ruim: "Ver se chuta longe". Bom: "Qual a compressão ideal (em mm) para a nota de precisão desejada?".',
    kinds: [
      { kind: 'prototype', label: 'Protótipo', columns: [
        t('subsistema', 'Subsistema'), t('conceito', 'Conceito proposto'), lt('pergunta', 'Pergunta'),
        en('fidelidade', 'Fidelidade necessária', ['Análise 2D', 'Protótipo físico simples', 'Protótipo físico complexo']),
        t('responsaveis', 'Responsáveis'), lt('obs', 'Observações'), lt('conclusao', 'Conclusões')] },
    ],
  },
  {
    id: '4.1', stage: 4, title: 'Arquétipos propostos', view: 'table',
    description: 'Uma lista com os possíveis robôs que podem resolver o desafio proposto, considerando as prioridades.',
    guidance: 'Proponha arquétipos de robô completos, com imagens 2D e 3D e as habilidades que cada um entrega.',
    kinds: [
      { kind: 'archetype', label: 'Arquétipo', columns: [
        t('nome', 'Nome'), col('image', 'imagem2d', 'Imagem 2D'), col('image', 'imagem3d', 'Imagem 3D'),
        lt('habilidades', 'Habilidades'), lt('observacoes', 'Observações')] },
    ],
  },
  {
    id: '4.2', stage: 4, title: 'Escolha de arquétipo', view: 'decision-matrix',
    description: 'Uma matriz de decisão que nos ajuda a escolher o arquétipo ideal de robô.',
    guidance: 'Defina atributos com pesos, dê notas a cada arquétipo, verifique a cobertura das prioridades e registre a justificativa da escolha.',
    kinds: [
      { kind: 'attribute', label: 'Atributo', columns: [t('atributo', 'Atributo'), num('peso', 'Peso')] },
      { kind: 'score', label: 'Nota', columns: [t('archetypeId', 'Arquétipo'), t('attribute', 'Atributo'), num('nota', 'Nota')] },
      { kind: 'coverage', label: 'Cobertura', columns: [
        t('archetypeId', 'Arquétipo'), t('priorityId', 'Prioridade'), col('bool', 'atende', 'Atende?')] },
      { kind: 'choice', label: 'Escolha', columns: [t('archetypeId', 'Arquétipo'), lt('justificativa', 'Justificativa')] },
    ],
  },
  {
    id: '5.1', stage: 5, title: 'Requisitos funcionais', view: 'table',
    description: 'Uma série de metas estabelecidas por subsistema, que definem as restrições iniciais do projeto.',
    guidance: 'Traduza a estratégia em números. Cada requisito deve ter uma métrica alvo mensurável e as restrições que se aplicam.',
    kinds: [
      { kind: 'requirement', label: 'Requisito', columns: [
        t('subsistema', 'Subsistema'), lt('requisito', 'Requisito funcional'), lt('metrica', 'Métrica alvo'), lt('restricoes', 'Restrições')] },
    ],
  },
  {
    id: '5.2', stage: 5, title: 'Fluxo de CAD', view: 'cad-flow',
    description: 'Estrutura para desenvolvimento de trabalho no CAD.',
    guidance: 'Organize a força de trabalho de design: defina responsáveis por subsistema, datas de Alfa, Beta e Gama, e acompanhe o peso em relação ao orçamento máximo.',
    kinds: [
      { kind: 'cad', label: 'Subsistema no CAD', columns: [
        t('subsistema', 'Subsistema'), col('person', 'lider', 'Líder'), t('apoio', 'Apoio'),
        col('date', 'alfa', 'Alfa'), col('date', 'beta', 'Beta'), col('date', 'gama', 'Gama'),
        num('peso_kg', 'Peso (kg)'),
        en('status', 'Status', ['Não iniciado', 'Em Alfa', 'Em Beta', 'Em Gama', 'Pronto para V1'])] },
      { kind: 'budget', label: 'Orçamento de peso', columns: [num('peso_max_kg', 'Peso máximo (kg)')] },
    ],
  },
  {
    id: '5.3', stage: 5, title: 'Design review', view: 'table',
    description: 'Registro das revisões de design por subsistema.',
    guidance: 'A cada revisão, anote a data, o subsistema revisado e as considerações levantadas.',
    kinds: [
      { kind: 'review', label: 'Revisão', columns: [
        col('date', 'data', 'Data'), t('subsistema', 'Subsistema'), lt('consideracoes', 'Considerações')] },
    ],
  },
];

export function getStep(id: string): StepDef {
  const step = STEPS.find((s) => s.id === id);
  if (!step) throw new Error(`Unknown step id: ${id}`);
  return step;
}
