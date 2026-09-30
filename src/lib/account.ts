import { supabase } from './supabase';

/** Supprime les données du compte (RGPD). La déconnexion suit côté app. */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_account');
  if (error) throw new Error(error.message);
}
