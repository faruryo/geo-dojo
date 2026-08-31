import { supabase } from '@/lib/supabase/client';

export async function getBrowserUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}
