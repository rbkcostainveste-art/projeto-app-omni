export type AssistantApplyResult = {
  status: 'draft' | 'saved' | 'pending' | 'unchanged';
  message: string;
};
export type AssistantApplyOptions = {persist: boolean};
export type AssistantFormApply = (values: Record<string, string>) => void | AssistantApplyResult | Promise<void | AssistantApplyResult>;

export function applicationResult(result: void | AssistantApplyResult, mode: 'draft' | 'record'): AssistantApplyResult {
  if (result) return result;
  return mode === 'draft'
    ? {status: 'draft', message: 'Campos preenchidos no formulário. O registro ainda não foi salvo.'}
    : {status: 'pending', message: 'Alteração enviada. A confirmação de gravação ainda está pendente.'};
}
