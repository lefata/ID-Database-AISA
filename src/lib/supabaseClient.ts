import { createClient } from '@supabase/supabase-js';

// FIX: Cast `import.meta` to `any` to resolve TypeScript error. Vite replaces these variables at build time.
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
// FIX: Cast `import.meta` to `any` to resolve TypeScript error. Vite replaces these variables at build time.
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not set. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);