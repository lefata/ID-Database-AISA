import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { GoogleGenAI } from '@google/genai';
import { sql } from '@vercel/postgres';
import { PersonCategory } from '../src/types';

export const config = {
  runtime: 'edge',
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

const app = new Hono().basePath('/api');

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
    return (response.text ?? '').trim();
  } catch (error) {
    console.error("Error generating bio with Gemini:", error);
    return "A valued member of our community.";
  }
};

// GET all people
app.get('/people', async (c) => {
  try {
    const { rows } = await sql`SELECT * FROM people ORDER BY lastName, firstName;`;
    return c.json(rows);
  } catch (e) {
    console.error(e);
    return c.json({ error: 'Failed to fetch people' }, 500);
  }
});

// POST (create) new people
app.post('/people', async (c) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY_ALIAS_FOR_GEMINI! });
  const peopleToAdd: NewPersonData[] = await c.req.json();

  if (!Array.isArray(peopleToAdd) || peopleToAdd.length === 0) {
    return c.json({ error: 'Invalid payload' }, 400);
  }

  try {
    const tempIdToNewIdMap: Record<string, number> = {};
    const studentPayloads: NewPersonData[] = [];
    const nonStudentPayloads: NewPersonData[] = [];

    peopleToAdd.forEach(p => {
        if (p.category === PersonCategory.STUDENT) studentPayloads.push(p);
        else nonStudentPayloads.push(p);
    });

    // 1. Insert non-students (parents, staff) and get their new IDs
    for (const person of nonStudentPayloads) {
        const roleOrClass = person.role || 'Parent';
        const bio = await generateBio(ai, person.firstName, person.lastName, person.category, roleOrClass);
        const googleSheetId = `GS-${Math.floor(10000 + Math.random() * 90000)}`;

        const result = await sql`
            INSERT INTO people (category, firstName, lastName, image, role, class, bio, googleSheetId)
            VALUES (${person.category}, ${person.firstName}, ${person.lastName}, ${person.image}, ${person.role}, ${person.class}, ${bio}, ${googleSheetId})
            RETURNING id;
        `;
        const newId = result.rows[0].id;
        tempIdToNewIdMap[person.tempId] = newId;
    }

    // 2. Insert students, using the newly created guardian IDs
    for (const student of studentPayloads) {
        const newGuardianIds = student.guardianTempIds?.map(tempId => tempIdToNewIdMap[tempId]).filter(Boolean) || [];
        const allGuardianIds = [...new Set([...(student.guardianIds || []), ...newGuardianIds])];
        
        const bio = await generateBio(ai, student.firstName, student.lastName, PersonCategory.STUDENT, student.class!);
        const googleSheetId = `GS-${Math.floor(10000 + Math.random() * 90000)}`;

        await sql`
            INSERT INTO people (category, firstName, lastName, image, class, guardianIds, bio, googleSheetId)
            VALUES (${student.category}, ${student.firstName}, ${student.lastName}, ${student.image}, ${student.class}, ${allGuardianIds as any}, ${bio}, ${googleSheetId});
        `;
    }

    return c.json({ success: true }, 201);
  } catch (e: any) {
    console.error(e);
    return c.json({ error: 'Failed to create profiles', details: e.message }, 500);
  }
});


export default handle(app);