import { sql } from '@vercel/postgres';
import 'dotenv/config';

async function setupDatabase() {
  console.log('🚀 Starting database setup...');

  // Explicitly check for the connection string
  if (!process.env.POSTGRES_URL) {
    console.error('❌ Error: POSTGRES_URL environment variable is not set.');
    console.error('Please create a .env file and add your Vercel Postgres connection string.');
    process.exit(1);
  }

  try {
    console.log('📝 Creating "people" table if it doesn\'t exist...');
    await sql`
      CREATE TABLE IF NOT EXISTS people (
        id SERIAL PRIMARY KEY,
        category VARCHAR(20) NOT NULL,
        "firstName" VARCHAR(50) NOT NULL,
        "lastName" VARCHAR(50) NOT NULL,
        image TEXT NOT NULL,
        role VARCHAR(50),
        class VARCHAR(50),
        "guardianIds" INTEGER[],
        bio TEXT NOT NULL,
        "googleSheetId" VARCHAR(20) NOT NULL
      );
    `;
    console.log('✅ Table "people" schema is up to date.');

    // Check if table is empty before seeding
    const { rows } = await sql`SELECT COUNT(*) as count FROM people;`;
    if (parseInt(rows[0].count, 10) > 0) {
        console.log('ℹ️ Database already contains data. Skipping seed process.');
        console.log('✨ Database setup complete! You can now run `npm run dev` to start the application.');
        return;
    }
    
    console.log('🌱 Seeding database with initial data...');
    // Use 'RETURNING id' to get the IDs of the inserted parents for the student
    const eleanor = await sql`
        INSERT INTO people (category, "firstName", "lastName", role, image, bio, "googleSheetId")
        VALUES ('Staff', 'Eleanor', 'Vance', 'Principal', 'https://picsum.photos/seed/eleanor/200/200', 'A visionary leader dedicated to fostering an inspiring learning environment.', 'GS-83610')
        RETURNING id;
    `;
    const marcus = await sql`
        INSERT INTO people (category, "firstName", "lastName", role, image, bio, "googleSheetId")
        VALUES ('Parent/Guardian', 'Marcus', 'Cole', 'Parent/Guardian', 'https://picsum.photos/seed/marcus/200/200', 'An engaged parent committed to supporting the school community.', 'GS-19283')
        RETURNING id;
    `;
    const olivia = await sql`
        INSERT INTO people (category, "firstName", "lastName", role, image, bio, "googleSheetId")
        VALUES ('Parent/Guardian', 'Olivia', 'Chen', 'Parent/Guardian', 'https://picsum.photos/seed/olivia/200/200', 'A creative and supportive presence in our community.', 'GS-55431')
        RETURNING id;
    `;

    const marcusId = marcus.rows[0].id;
    const oliviaId = olivia.rows[0].id;

    await sql`
        INSERT INTO people (category, "firstName", "lastName", class, image, bio, "googleSheetId", "guardianIds")
        VALUES ('Student', 'Leo', 'Cole', 'Grade 5', 'https://picsum.photos/seed/leo/200/200', 'A curious and bright student with a passion for science.', 'GS-48265', ARRAY[${marcusId}, ${oliviaId}]);
    `;

    console.log('✅ Initial data seeded successfully.');
    console.log('✨ Database setup complete! You can now run `npm run dev` to start the application.');

  } catch (error) {
    console.error('❌ An error occurred during database setup:', error);
    console.error('Please ensure your Vercel Postgres database is running and the POSTGRES_URL in your .env file is correct.');
    process.exit(1);
  }
}

setupDatabase();
