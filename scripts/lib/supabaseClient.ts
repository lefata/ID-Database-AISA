import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be provided in .env file for the setup script.');
}

// Using the service role key for admin tasks like seeding data.
// This client should only be used in secure, server-side scripts.
export const supabase = createClient(supabaseUrl, supabaseServiceKey);
