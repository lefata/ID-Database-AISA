import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import type { User, SupabaseClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

// --- START: Merged from googleSheetsClient.ts and types.ts ---
// Cache the Google Sheets client so we don't re-authenticate on every request
let sheets: any;

async function getSheetsClient() {
  if (sheets) return sheets;

  const credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // The private key can come with escaped newlines, which need to be un-escaped.
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Google service account credentials are not set in environment variables.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const authClient = await auth.getClient() as any;
  sheets = google.sheets({ version: 'v4', auth: authClient });
  return sheets;
}

/**
 * Searches for a student in the Google Sheet and returns their ID from Column M.
 */
async function getSheetIdForStudent(firstName: string, lastName: string): Promise<string | null> {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME || 'Sheet1';
    
    if (!sheetId) {
        console.warn('GOOGLE_SHEET_ID is not set. Skipping student ID lookup.');
        return null;
    }

    const client = await getSheetsClient();
    const searchName = `${firstName.trim()} ${lastName.trim()}`.toLowerCase();
    
    // Assumes First Name is in column A, Last Name is in column B, and ID is in column M.
    const range = `${sheetName}!A:M`;

    try {
        const response = await client.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: range,
        });

        const rows = response.data.values;
        if (rows && rows.length) {
            for (const row of rows) {
                const rowFirstName = row[0] || '';
                const rowLastName = row[1] || '';
                const rowFullName = `${rowFirstName.trim()} ${rowLastName.trim()}`.toLowerCase();

                if (rowFullName === searchName) {
                    const studentId = row[12]; // Column M is at index 12
                    return studentId || null;
                }
            }
        }
        return null;
    } catch (err) {
        console.error('Error fetching data from Google Sheets API:', err);
        throw new Error('Failed to communicate with Google Sheets.');
    }
}

export enum PersonCategory {
  STAFF = 'Staff',
  STUDENT = 'Student',
  PARENT = 'Parent/Guardian',
}

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
// --- END: Merged from googleSheetsClient.ts and types.ts ---


type AppContext = {
  Variables: {
    user: User;
    supabase: SupabaseClient;
  };
};

const app = new Hono<AppContext>().basePath('/api');

// --- AUTH MIDDLEWARE ---
app.use('/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return c.json({ error: 'Invalid token' }, 401);
  }
  c.set('user', data.user);
  c.set('supabase', supabase);
  await next();
});

// Helper function to generate a bio
const generateBio = async (ai: GoogleGenAI, firstName: string, lastName: string, category: PersonCategory, roleOrClass: string): Promise<string> => {
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

// --- SETTINGS ROUTES ---
app.get('/settings', async (c) => {
    const supabase = c.get('supabase');
    const { data, error } = await supabase.from('settings').select('key, value');
    if (error) {
        console.error('Supabase settings fetch error:', error);
        return c.json({ error: 'Failed to fetch settings' }, 500);
    }
    const settings = data.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
    }, {} as { [key: string]: string });
    return c.json(settings);
});

app.put('/settings', async (c) => {
    const user = c.get('user');
    const supabase = c.get('supabase');
    if (user.user_metadata?.role !== 'admin') {
        return c.json({ error: 'Forbidden: Admins only' }, 403);
    }
    
    const { key, value } = await c.req.json();
    if (!key || value === undefined) {
        return c.json({ error: 'Key and value are required' }, 400);
    }

    const { error } = await supabase.from('settings').upsert({ key, value });

    if (error) {
        console.error('Supabase settings update error:', error);
        return c.json({ error: 'Failed to update setting.', details: error.message, code: error.code }, 500);
    }
    return c.json({ success: true });
});


// --- PEOPLE ROUTES ---
app.get('/people', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase.from('people').select('*').order('lastName').order('firstName');
  if (error) {
    console.error('Supabase fetch error:', error);
    return c.json({ error: `Failed to fetch people: ${error.message}` }, 500);
  }
  return c.json(data);
});

app.post('/people', async (c) => {
  const supabase = c.get('supabase');
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

    if (nonStudentPayloads.length > 0) {
      const nonStudentInsertData = await Promise.all(
        nonStudentPayloads.map(async (person) => ({
            category: person.category,
            firstName: person.firstName,
            lastName: person.lastName,
            image: person.image,
            role: person.role,
            class: person.class,
            bio: await generateBio(ai, person.firstName, person.lastName, person.category, person.role || 'Parent'),
            googleSheetId: `GS-${Math.floor(10000 + Math.random() * 90000)}`,
        }))
      );
      
      const { data: inserted, error } = await supabase.from('people').insert(nonStudentInsertData).select('id');
      if (error) throw new Error(`Supabase non-student insert error: ${error.message}`);
      
      inserted.forEach((row, index) => {
          tempIdToNewIdMap[nonStudentPayloads[index].tempId] = row.id;
      });
    }

    if (studentPayloads.length > 0) {
        const studentInsertData = await Promise.all(
            studentPayloads.map(async (student) => {
                const newGuardianIds = student.guardianTempIds?.map(tempId => tempIdToNewIdMap[tempId]).filter(Boolean) || [];
                const allGuardianIds = [...new Set([...(student.guardianIds || []), ...newGuardianIds])];
                
                let googleSheetId: string;
                try {
                    googleSheetId = await getSheetIdForStudent(student.firstName, student.lastName) ?? `GS-${Math.floor(10000 + Math.random() * 90000)}`;
                } catch (e) {
                    console.warn(`Could not retrieve student ID from Google Sheet for ${student.firstName} ${student.lastName}. Falling back to random ID.`, e);
                    googleSheetId = `GS-${Math.floor(10000 + Math.random() * 90000)}`;
                }

                return {
                    category: student.category,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    image: student.image,
                    class: student.class,
                    guardianIds: allGuardianIds,
                    bio: await generateBio(ai, student.firstName, student.lastName, PersonCategory.STUDENT, student.class!),
                    googleSheetId: googleSheetId,
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

app.put('/people/:id', async (c) => {
    const user = c.get('user');
    const supabase = c.get('supabase');
    if (user.user_metadata?.role !== 'admin') {
        return c.json({ error: 'Forbidden: Admins only' }, 403);
    }

    const id = c.req.param('id');
    const updateData = await c.req.json();
    
    const { firstName, lastName, role, class: personClass, image, guardianIds } = updateData;
    
    const payload: { [key: string]: any } = {};
    if (firstName) payload.firstName = firstName;
    if (lastName) payload.lastName = lastName;
    if (role) payload.role = role;
    if (personClass) payload.class = personClass;
    if (image) payload.image = image;
    if (Array.isArray(guardianIds)) {
        payload.guardianIds = guardianIds;
    }
    
    if (Object.keys(payload).length === 0) {
        return c.json({ error: 'No update data provided' }, 400);
    }

    const { error } = await supabase
        .from('people')
        .update(payload)
        .eq('id', id);

    if (error) {
        console.error('Supabase update error:', error);
        return c.json({ error: 'Failed to update person', details: error.message }, 500);
    }

    return c.json({ success: true });
});


// --- ADMIN-ONLY ROUTES ---
const adminApp = new Hono<AppContext>();

adminApp.use('/*', async (c, next) => {
    const user = c.get('user');
    if (user.user_metadata?.role !== 'admin') {
        return c.json({ error: 'Forbidden: Admins only' }, 403);
    }
    await next();
});

adminApp.get('/pending-users', async (c) => {
    try {
        const { supabaseAdmin } = await import('./supabaseAdminClient');
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

        if (error) {
            return c.json({ error: 'Failed to list users', details: error.message }, 500);
        }

        const pendingUsers = data.users
            .filter((user: User) => !user.email_confirmed_at)
            .map(user => ({
                id: user.id,
                email: user.email,
                created_at: user.created_at,
            }));
            
        return c.json(pendingUsers);
    } catch (e: any) {
        return c.json({ error: 'Admin client failed to load. Check server configuration.', details: e.message }, 500);
    }
});

adminApp.post('/users/:id/confirm', async (c) => {
    const userId = c.req.param('id');
    try {
        const { supabaseAdmin } = await import('./supabaseAdminClient');
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            email_confirm: true,
        });
        if (error) {
            return c.json({ error: 'Failed to confirm user', details: error.message }, 500);
        }
        return c.json({ success: true, user: data.user });
    } catch (e: any) {
        return c.json({ error: 'Admin client failed to load. Check server configuration.', details: e.message }, 500);
    }
});

adminApp.get('/users', async (c) => {
    try {
        const { supabaseAdmin } = await import('./supabaseAdminClient');
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

        if (error) {
            return c.json({ error: 'Failed to list users', details: error.message }, 500);
        }
        
        const managedUsers = data.users.map(user => ({
            id: user.id,
            email: user.email,
            role: user.user_metadata?.role || 'user',
        }));

        return c.json(managedUsers);
    } catch (e: any) {
        return c.json({ error: 'Admin client failed to load', details: e.message }, 500);
    }
});

adminApp.put('/users/:id/role', async (c) => {
    const userId = c.req.param('id');
    const { role } = await c.req.json();

    if (role !== 'admin' && role !== 'user') {
        return c.json({ error: 'Invalid role specified' }, 400);
    }

    try {
        const { supabaseAdmin } = await import('./supabaseAdminClient');
        const { data: userToUpdate, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (fetchError) throw fetchError;
        
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: { ...userToUpdate.user.user_metadata, role },
        });

        if (error) {
            return c.json({ error: 'Failed to update user role', details: error.message }, 500);
        }

        return c.json({ success: true, user: data.user });
    } catch (e: any) {
        return c.json({ error: 'Admin client failed to load or update failed', details: e.message }, 500);
    }
});

adminApp.delete('/users/:id', async (c) => {
    const userId = c.req.param('id');
    const currentUser = c.get('user');

    if (userId === currentUser.id) {
        return c.json({ error: "Admins cannot delete their own account." }, 400);
    }
    
    try {
        const { supabaseAdmin } = await import('./supabaseAdminClient');
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) {
            throw error;
        }
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: 'Failed to delete user', details: e.message }, 500);
    }
});


app.route('/admin', adminApp);

export default handle(app);