import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { createClient } from '@supabase/supabase-js';

// This is a lightweight, dedicated function to avoid timeouts on cold starts.
const app = new Hono().basePath('/api/public');

interface LogEntry {
  step: string;
  command: string;
  status: 'success' | 'failure' | 'warning';
  details: string;
}


app.get('/diagnostics', async (c) => {
    const logs: LogEntry[] = [];

    logs.push({
        step: 'API Server Check',
        command: 'GET /api/public/diagnostics',
        status: 'success',
        details: 'API server is responsive and has started the diagnostic process.'
    });

    let supabase;
    try {
        supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_ANON_KEY!
        );
        logs.push({
            step: 'Supabase Client Initialization',
            command: 'createClient(SUPABASE_URL, SUPABASE_ANON_KEY)',
            status: 'success',
            details: 'Supabase client initialized successfully using the provided environment variables.'
        });
    } catch (e: any) {
        logs.push({
            step: 'Supabase Client Initialization',
            command: 'createClient(SUPABASE_URL, SUPABASE_ANON_KEY)',
            status: 'failure',
            details: `Failed to initialize Supabase client. This usually means the VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables are missing or invalid. Error: ${e.message}`
        });
        return c.json({ logs });
    }

    // Check 'settings' table
    try {
        const { error } = await supabase.from('settings').select('key').limit(1);
        if (error && error.code === '42P01') { // undefined_table
            throw new Error(`The 'settings' table does not exist. The database schema has not been set up correctly. Please run the setup script. (Code: ${error.code})`);
        }
        if (error && error.message.includes('permission denied')) {
            logs.push({
                step: "Check 'settings' Table & RLS",
                command: "supabase.from('settings').select('key').limit(1)",
                status: 'success',
                details: "Connection successful. Row Level Security is correctly blocking anonymous access to the 'settings' table as expected."
            });
        } else if (error) {
            throw error; // Other, more serious errors
        } else {
            logs.push({
                step: "Check 'settings' Table & RLS",
                command: "supabase.from('settings').select('key').limit(1)",
                status: 'warning',
                details: "Successfully queried the 'settings' table. This could indicate that RLS is not enabled for anonymous reads on this table, which may be a security risk."
            });
        }
    } catch (e: any) {
        logs.push({
            step: "Check 'settings' Table & RLS",
            command: "supabase.from('settings').select('key').limit(1)",
            status: 'failure',
            details: `An error occurred while checking the 'settings' table. Details: ${e.message}`
        });
    }
    
    // Check 'people' table
    try {
        const { error } = await supabase.from('people').select('id, "firstName"').limit(1);
        if (error && error.code === '42P01') { // undefined_table
            throw new Error(`The 'people' table does not exist. The database schema has not been set up correctly. Please run the setup script. (Code: ${error.code})`);
        }
        if (error && error.message.includes('permission denied')) {
            logs.push({
                step: "Check 'people' Table & RLS",
                command: 'supabase.from(\'people\').select(\'id, "firstName"\').limit(1)',
                status: 'success',
                details: "Connection successful. RLS is correctly blocking anonymous access to the 'people' table as expected."
            });
        } else if (error) {
            throw error;
        } else {
             logs.push({
                step: "Check 'people' Table & RLS",
                command: 'supabase.from(\'people\').select(\'id, "firstName"\').limit(1)',
                status: 'warning',
                details: "Successfully queried the 'people' table. This could indicate that RLS is not enabled for anonymous reads on this table, which may be a security risk."
            });
        }
    } catch (e: any) {
        logs.push({
            step: "Check 'people' Table & RLS",
            command: 'supabase.from(\'people\').select(\'id, "firstName"\').limit(1)',
            status: 'failure',
            details: `An error occurred while checking the 'people' table. Details: ${e.message}`
        });
    }

    return c.json({ logs });
});

export default handle(app);