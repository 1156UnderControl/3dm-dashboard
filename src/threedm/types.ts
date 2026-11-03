export type Role = 'admin' | 'member';
export interface Member { email: string; role: Role; displayName?: string }
export interface AppConfig { aiProvider: 'anthropic' | 'openai'; model: string }
export interface Season {
  id: string; name: string; year: number; status: 'active' | 'archived';
  // Task 11 narrows this to SeasonExtraction (src/ai/seasonSchema.ts).
  model?: Record<string, unknown>;
  createdAt: number;
}
export interface Group { id: string; name: string; memberEmails: string[] }
export type StepStatus = 'nao_iniciado' | 'em_andamento' | 'em_revisao' | 'concluido';
export interface StepState {
  stepId: string; groupId?: string; deadline?: string /*YYYY-MM-DD*/;
  status: StepStatus; conclusion: string; closedBy?: string; closedAt?: number;
}
export type Origin = 'human' | 'ai' | 'ai-accepted' | 'ai-edited';
export interface Item {
  id: string; stepId: string; kind: string; data: Record<string, unknown>;
  origin: Origin; state: 'active' | 'rejected'; order: number; aiKey?: string; citation?: string;
  createdBy: string; updatedBy: string; updatedAt: number;
}
export type HistoryAction = 'create' | 'update' | 'accept' | 'reject' | 'delete' | 'step-update' | 'close' | 'reopen';
export type NewItem = {
  stepId: string; kind: string; data: Record<string, unknown>;
  origin?: Origin; aiKey?: string; citation?: string;
};
export interface HistoryEvent {
  at: number; by: string; stepId: string; itemId?: string; action: HistoryAction;
  before?: unknown; after?: unknown; reason?: string;
}
