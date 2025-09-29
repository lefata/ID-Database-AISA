import { Hono } from 'hono';
import { GoogleGenAI } from '@google/genai';
import { PersonCategory } from '../src/types';

// Define the shape of bindings available to our worker
type Bindings = {
  // FIX: Replaced D1Database with any to handle missing Cloudflare types.
  DB: any;
  API_KEY_ALIAS_FOR_GEMINI: string;
};

// Define the shape of the data received from the frontend
type NewPersonData = {
  tempId: string;
  category: PersonCategory;
  firstName: string;
  lastName: string;
  image: string;
  role?: string;
  class?: string;
  guardianIds?: number[];
  guardianTempIds?: string[];
};


const app = new Hono<{ Bindings: Bindings }>();

// --- API ROUTES ---
// Create a new Hono instance dedicated to API routes
const api = new Hono<{ Bindings: Bindings }>();


// Helper function to generate a bio using Gemini
const generateBio = async (
  ai: GoogleGenAI,
  firstName: string,
  lastName: string,
  category: PersonCategory,
  roleOrClass: string
): Promise<string> => {
  const roleDescription = category === PersonCategory.STUDENT ? `a student in ${roleOrClass}` : `a ${roleOrClass}`;
  const prompt = `Generate a short, positive, one-sentence professional description for ${firstName} ${lastName}, who is ${roleDescription}. Keep it under 20 words. Example: 'A dedicated educator shaping future minds.' or 'An enthusiastic learner with a bright future.'`;
  try {
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return response.text.trim();
  } catch (error) {
    console.error("Error generating bio with Gemini:", error);
    return "A valued member of our community.";
  }
};

// Legacy endpoint for AddPersonForm to generate bios
api.post('/generate-bio', async (c) => {
  const ai = new GoogleGenAI({ apiKey: c.env.API_KEY_ALIAS_FOR_GEMINI });
  try {
    const { firstName, lastName, category, roleOrClass } = await c.req.json();
    if (!firstName || !lastName || !category || !roleOrClass) {
      return c.json({ error: 'Missing required fields for bio generation.' }, 400);
    }
    const bio = await generateBio(ai, firstName, lastName, category, roleOrClass);
    return c.json({ bio });
  } catch (error) {
    console.error('Error in /api/generate-bio:', error);
    return c.json({ error: 'Failed to generate bio.' }, 500);
  }
});


// GET all people
api.get('/people', async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM people ORDER BY lastName, firstName").all();
    // Parse guardianIds from JSON string to number array
    const typedResults = results.map(person => ({
        ...person,
        guardianIds: person.guardianIds ? JSON.parse(person.guardianIds as string) : [],
    }));
    return c.json(typedResults);
  } catch (e) {
    console.error(e);
    return c.json({ error: 'Failed to fetch people' }, 500);
  }
});

// POST (create) new people
api.post('/people', async (c) => {
  const ai = new GoogleGenAI({ apiKey: c.env.API_KEY_ALIAS_FOR_GEMINI });
  const peopleToAdd: NewPersonData[] = await c.req.json();

  if (!Array.isArray(peopleToAdd) || peopleToAdd.length === 0) {
    return c.json({ error: 'Invalid payload' }, 400);
  }

  try {
    const tempIdToNewIdMap: Record<string, number> = {};
    const studentPayloads: NewPersonData[] = [];
    // FIX: Replaced D1PreparedStatement with any to handle missing Cloudflare types.
    const statements: any[] = [];

    // Separate parents/staff from students to process them first
    for (const personData of peopleToAdd) {
      if (personData.category === PersonCategory.STUDENT) {
        studentPayloads.push(personData);
      } else {
        const roleOrClass = personData.role || 'Parent'; // Default for guardians
        const bio = await generateBio(ai, personData.firstName, personData.lastName, personData.category, roleOrClass);
        const googleSheetId = `GS-${Math.floor(10000 + Math.random() * 90000)}`;

        statements.push(
          c.env.DB.prepare(
            'INSERT INTO people (category, firstName, lastName, image, role, class, bio, googleSheetId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(personData.category, personData.firstName, personData.lastName, personData.image, personData.role, personData.class, bio, googleSheetId)
        );
      }
    }

    // Batch insert non-students (parents, staff)
    if (statements.length > 0) {
        const results = await c.env.DB.batch(statements);
        
        // Map tempIds to the newly created database IDs
        let nonStudentIndex = 0;
        for (const personData of peopleToAdd) {
            if (personData.category !== PersonCategory.STUDENT) {
                 // D1 batch returns results with meta, but in local testing it can be null.
                 // Assuming order is preserved and success.
                // FIX: Replaced generic type argument with a type cast to fix untyped function call error.
                const newId = (results[nonStudentIndex]?.meta?.last_row_id) ?? (await c.env.DB.prepare("SELECT last_insert_rowid() as id").first() as {id: number})!.id;
                tempIdToNewIdMap[personData.tempId] = newId;
                nonStudentIndex++;
            }
        }
    }

    // Now process students, resolving their guardian IDs
    // FIX: Replaced D1PreparedStatement with any to handle missing Cloudflare types.
    const studentStatements: any[] = [];
    for (const student of studentPayloads) {
      const newGuardianIds = student.guardianTempIds?.map(tempId => tempIdToNewIdMap[tempId]).filter(Boolean) || [];
      const allGuardianIds = [...new Set([...(student.guardianIds || []), ...newGuardianIds])];
      const bio = await generateBio(ai, student.firstName, student.lastName, PersonCategory.STUDENT, student.class!);
      const googleSheetId = `GS-${Math.floor(10000 + Math.random() * 90000)}`;

      studentStatements.push(
        c.env.DB.prepare(
          'INSERT INTO people (category, firstName, lastName, image, class, guardianIds, bio, googleSheetId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(student.category, student.firstName, student.lastName, student.image, student.class, JSON.stringify(allGuardianIds), bio, googleSheetId)
      );
    }
    
    if (studentStatements.length > 0) {
        await c.env.DB.batch(studentStatements);
    }

    return c.json({ success: true }, 201);
  } catch (e: any) {
    console.error(e);
    return c.json({ error: 'Failed to create profiles', details: e.message }, 500);
  }
});

// Mount the API router under the /api path.
// All requests to /api/* will be handled by the 'api' Hono instance.
app.route('/api', api);

// --- STATIC ASSETS ---
// Static assets are now handled exclusively by the `site.bucket = "./dist"`
// configuration in `wrangler.toml`. This is the standard practice for
// Cloudflare Pages and avoids routing conflicts. We no longer need a
// fallback route in the worker.

export default app;
