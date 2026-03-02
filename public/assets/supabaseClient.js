import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export { SUPABASE_URL, SUPABASE_ANON_KEY };
