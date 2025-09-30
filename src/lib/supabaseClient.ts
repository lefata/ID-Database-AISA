// FIX: Define ImportMeta interface to provide types for import.meta.env,
// as the vite/client types seem to be unavailable in this environment.
interface ImportMeta {
    readonly env: {
        readonly VITE_SUPABASE_URL: string;
        readonly VITE_SUPABASE_ANON_KEY: string;
    };
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not set. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);