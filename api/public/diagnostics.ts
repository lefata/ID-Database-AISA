import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { createClient } from '@supabase/supabase-js';

// This is a lightweight, dedicated function to avoid timeouts on cold starts.
const app = new Hono();

app.get('/diagnostics', async (c) => {
    const results: any = {
        apiStatus: { status: 'Success', message: 'API server is responsive.' }
    };

    try {
        const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_ANON_KEY!
        );
        // A simple, fast query to test connectivity.
        // It's expected to fail with an RLS error for an anonymous user, which proves the connection is working.
        const { error: dbError } = await supabase.from('settings').select('key').limit(1);
        
        if (dbError && dbError.message.includes('permission denied')) {
            results.supabaseConnection = { status: 'Success', message: 'Successfully connected to Supabase. RLS is correctly blocking anonymous access.' };
        } else if (dbError) {
             throw dbError; // A more serious error occurred (e.g., connection timeout).
        } else {
            // This case indicates a successful query, which can happen if RLS is off for this table.
            results.supabaseConnection = { status: 'Success', message: 'Successfully connected and queried Supabase.' };
        }
    } catch (e: any) {
        results.supabaseConnection = { status: 'Failed', error: { message: e.message, code: e.code, details: 'This could be due to incorrect SUPABASE_URL/ANON_KEY or a network issue.' } };
    }

    return c.json(results);
});

export default handle(app);