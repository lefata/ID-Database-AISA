import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  // FIX: Replaced process.cwd() with '.' to resolve TypeScript error about missing 'cwd' property on type 'Process'.
  const env = loadEnv(mode, '.', '')
  
  return {
    plugins: [react()],
    define: {
      // This makes the app more robust for environments where only non-prefixed variables are set.
      // It prioritizes the VITE_ prefixed variable, then falls back to the non-prefixed one.
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY),
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
    }
  }
})