import type {SupabaseClient} from '@supabase/supabase-js';
import type {DraftContext} from './contextual-assistant';

/** Resolve a saved record under the caller JWT; browser fields are only an unsaved draft. */
export async function assistantRecordContext(client: SupabaseClient, employee: string, context: DraftContext, signal: AbortSignal) {
  if (!context.record) return null;
  const {data: identity, error: identityError} = await client.rpc('refresh_current_device');
  if (identityError || identity?.employeeNumber !== employee) throw Error('Registro indisponível para esta sessão.');
  const globalRoles = ['admin', 'app_manager', 'maintenance_director', 'maintenance_manager'];
  const localRoles = ['mechanic', 'maintenance_assistant', 'maintenance_coordinator', 'maintenance_leader', 'maintenance_inspector'];
  const global = globalRoles.includes(identity.accessProfile);
  const base = typeof identity.assignedBase === 'string' ? identity.assignedBase.trim() : '';
  if (!global && (!localRoles.includes(identity.accessProfile) || !base)) throw Error('Registro indisponível para seu perfil/base.');
  let query = client.from('maintenance_records').select('id,revision,prefix,model,base,title,status,description:data->>description,originalObservation:technical_case->originalObservation').eq('id', context.record.id);
  if (!global) query = query.eq('base', base);
  const {data, error} = await query.abortSignal(signal).maybeSingle();
  if (error || !data) throw Error('Registro indisponível para seu perfil/base.');
  if (data.revision !== context.record.revision) throw Error('Este relato mudou. Feche e reabra o card antes de consultar a IA.');
  return data;
}
