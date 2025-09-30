import { createClient } from '@supabase/supabase-js';

// These variables are sourced from Vercel's environment variables.
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  const missingVars: string[] = [];
  if (!supabaseUrl) missingVars.push('SUPABASE_URL');
  if (!supabaseServiceKey) missingVars.push('SUPABASE_SERVICE_KEY');
  // This error will be caught during development or at build time on Vercel.
  throw new Error(`Supabase admin environment variables (${missingVars.join(', ')}) are not set.`);
}

// This client has admin privileges and should only be used in secure server-side environments.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});