import { createClient } from '@supabase/supabase-js';

// These variables are sourced from Vercel's environment variables.
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars: string[] = [];
  if (!supabaseUrl) missingVars.push('SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('SUPABASE_ANON_KEY');
  // This error will be caught during development or at build time on Vercel.
  throw new Error(`Supabase environment variables (${missingVars.join(', ')}) are not set.`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);