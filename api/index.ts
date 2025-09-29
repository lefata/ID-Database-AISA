import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { GoogleGenAI } from '@google/genai';
import { PersonCategory } from '../src/types';
import { supabase } from './supabaseClient';

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
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .order('lastName', { ascending: true })
    .order('firstName', { ascending: true });

  if (error) {
    console.error('Supabase fetch error:', error);
    return c.json({ error: 'Failed to fetch people' }, 500);
  }
  return c.json(data);
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

    // 1. Prepare and insert non-students (parents, staff) to get their new IDs
    if (nonStudentPayloads.length > 0) {
      const nonStudentInsertData = await Promise.all(
        nonStudentPayloads.map(async (person) => {
          const roleOrClass = person.role || 'Parent';
          const bio = await generateBio(ai, person.firstName, person.lastName, person.category, roleOrClass);
          const googleSheetId = `GS-${Math.floor(10000 + Math.random() * 90000)}`;
          return {
            category: person.category,
            firstName: person.firstName,
            lastName: person.lastName,
            image: person.image,
            role: person.role,
            class: person.class,
            bio,
            googleSheetId,
          };
        })
      );
      
      const { data: insertedNonStudents, error } = await supabase
        .from('people')
        .insert(nonStudentInsertData)
        .select('id');
      
      if (error) throw new Error(`Supabase non-student insert error: ${error.message}`);
      
      insertedNonStudents.forEach((row, index) => {
          const tempId = nonStudentPayloads[index].tempId;
          tempIdToNewIdMap[tempId] = row.id;
      });
    }


    // 2. Prepare and insert students, using the newly created guardian IDs
    if (studentPayloads.length > 0) {
        const studentInsertData = await Promise.all(
            studentPayloads.map(async (student) => {
                const newGuardianIds = student.guardianTempIds?.map(tempId => tempIdToNewIdMap[tempId]).filter(Boolean) || [];
                const allGuardianIds = [...new Set([...(student.guardianIds || []), ...newGuardianIds])];
                
                const bio = await generateBio(ai, student.firstName, student.lastName, PersonCategory.STUDENT, student.class!);
                const googleSheetId = `GS-${Math.floor(10000 + Math.random() * 90000)}`;
                return {
                    category: student.category,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    image: student.image,
                    class: student.class,
                    guardianIds: allGuardianIds,
                    bio,
                    googleSheetId,
                }
            })
        );
        
        const { error } = await supabase.from('people').insert(studentInsertData);
        if (error) throw new Error(`Supabase student insert error: ${error.message}`);
    }


    return c.json({ success: true }, 201);
  } catch (e: any) {
    console.error(e);
    return c.json({ error: 'Failed to create profiles', details: e.message }, 500);
  }
});


export default handle(app);