import { supabase } from './lib/supabaseClient';
import 'dotenv/config';

async function setupDatabase() {
  console.log('🚀 Starting Supabase database setup...');

  try {
    console.log('ℹ️ This script seeds the "people" table.');
    console.log('ℹ️ Please ensure the table is created in your Supabase dashboard before running this script.');

    // Check if table is empty before seeding
    const { count } = await supabase.from('people').select('*', { count: 'exact', head: true });
    
    if (count !== null && count > 0) {
        console.log('✅ Database already contains data. Skipping seed process.');
        console.log('✨ Database setup complete! You can now run `npm run dev` to start the application.');
        return;
    }
    
    console.log('🌱 Seeding database with initial data...');
    
    // Insert Staff
    await supabase.from('people').insert({
        category: 'Staff',
        firstName: 'Eleanor',
        lastName: 'Vance',
        role: 'Principal',
        image: 'https://picsum.photos/seed/eleanor/200/200',
        bio: 'A visionary leader dedicated to fostering an inspiring learning environment.',
        googleSheetId: 'GS-83610'
    });

    // Insert Parents and get their new IDs
    const { data: marcusData, error: marcusError } = await supabase.from('people').insert({
        category: 'Parent/Guardian',
        firstName: 'Marcus',
        lastName: 'Cole',
        role: 'Parent/Guardian',
        image: 'https://picsum.photos/seed/marcus/200/200',
        bio: 'An engaged parent committed to supporting the school community.',
        googleSheetId: 'GS-19283'
    }).select('id').single();

    const { data: oliviaData, error: oliviaError } = await supabase.from('people').insert({
        category: 'Parent/Guardian',
        firstName: 'Olivia',
        lastName: 'Chen',
        role: 'Parent/Guardian',
        image: 'https://picsum.photos/seed/olivia/200/200',
        bio: 'A creative and supportive presence in our community.',
        googleSheetId: 'GS-55431'
    }).select('id').single();

    if (marcusError || oliviaError) {
        throw new Error(`Failed to insert parents: ${marcusError?.message || oliviaError?.message}`);
    }

    const marcusId = marcusData.id;
    const oliviaId = oliviaData.id;

    // Insert Student with guardian IDs
    await supabase.from('people').insert({
        category: 'Student',
        firstName: 'Leo',
        lastName: 'Cole',
        class: 'Grade 5',
        image: 'https://picsum.photos/seed/leo/200/200',
        bio: 'A curious and bright student with a passion for science.',
        googleSheetId: 'GS-48265',
        guardianIds: [marcusId, oliviaId]
    });


    console.log('✅ Initial data seeded successfully.');
    console.log('✨ Database setup complete! You can now run `npm run dev` to start the application.');

  } catch (error) {
    console.error('❌ An error occurred during database setup:', error);
    console.error('Please ensure your Supabase project is running and the environment variables in your .env file are correct.');
    // FIX: Cast process to any to bypass TypeScript error for process.exit.
    // This is necessary when Node.js types are not properly configured for the script environment.
    (process as any).exit(1);
  }
}

setupDatabase();
