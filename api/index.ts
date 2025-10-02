import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import type { User, SupabaseClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
};

let sheets: any;

async function getSheetsClient() {
  if (sheets) return sheets;

  const credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
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

async function getSheetIdForStudent(firstName: string, lastName:string): Promise<string | null> {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME || 'Sheet1';
    
    if (!sheetId) {
        console.warn('GOOGLE_SHEET_ID is not set. Skipping student ID lookup.');
        return null;
    }

    const client = await getSheetsClient();
    const searchName = `${firstName.trim()} ${lastName.trim()}`.toLowerCase();
    
    const range = `${sheetName}!A:M`;

    try {
        const response = await client.spreadsheets.values.get(
            {
                spreadsheetId: sheetId,
                range: range,
            },
            {
                timeout: 20000,
            }
        );

        const rows = response.data.values;
        if (rows && rows.length) {
            for (const row of rows) {
                const rowFirstName = row[0] || '';
                const rowLastName = row[1] || '';
                const rowFullName = `${rowFirstName.trim()} ${rowLastName.trim()}`.toLowerCase();

                if (rowFullName === searchName) {
                    const studentId = row[12];
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

type AppContext = {
  Variables: {
    user: User;
    supabase: SupabaseClient;
  };
};

const app = new Hono<AppContext>().basePath('/api');

app.use('/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
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

async function uploadImageToStorage(supabase: SupabaseClient, base64Data: string, personName: string): Promise<string> {
    if (!base64Data || !base64Data.startsWith('data:image')) {
        return base64Data;
    }

    const base64Str = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const binaryStr = atob(base64Str);
    const len = binaryStr.length;
    const imageBuffer = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        imageBuffer[i] = binaryStr.charCodeAt(i);
    }
    
    const mimeTypeMatch = base64Data.match(/data:(image\/\w+);base64,/);
    if (!mimeTypeMatch) {
        throw new Error('Invalid image data URL');
    }
    const mimeType = mimeTypeMatch[1];
    const fileExtension = mimeType.split('/')[1] || 'png';

    const sanitizedName = personName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const filePath = `avatars/${sanitizedName}-${Date.now()}.${fileExtension}`;

    const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filePath, imageBuffer, {
            contentType: mimeType,
            upsert: false,
        });

    if (error) {
        console.error('Supabase storage upload error:', error);
        throw new Error(`Failed to upload image: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path);
    return publicUrl;
}

const generateBio = async (ai: GoogleGenAI, firstName: string, lastName: string, category: PersonCategory, roleOrClass: string): Promise<string> => {
    const roleDescription = category === PersonCategory.STUDENT ? `a student in ${roleOrClass}` : `a ${roleOrClass}`;
    const prompt = `Generate a short, positive, one-sentence professional description for ${firstName} ${lastName}, who is ${roleDescription}. Keep it under 20 words. Example: 'A dedicated educator shaping future minds.' or 'An enthusiastic learner with a bright future.'`;
    const fallbackBio = "A valued member of our community.";
    try {
        const response = await withTimeout<GenerateContentResponse>(
            ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt }),
            20000
        );
        const bioText = (response.text ?? '').trim();
        return bioText || fallbackBio;
    } catch (error) {
        console.error("Error or timeout generating bio with Gemini:", error);
        return fallbackBio;
    }
};

app.get('/settings', async (c) => {
    const supabase = c.get('supabase');
    const { data, error } = await supabase.from('settings').select('key, value');
    if (error) {
        console.error('Supabase settings fetch error:', error);
        return c.json({ error: 'Failed to fetch settings' }, 500);
    }
    if (!Array.isArray(data)) {
        return c.json({});
    }
    const settings = data.reduce((acc, row) => {
        if (row && row.key) {
            acc[row.key] = row.value;
        }
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

app.get('/people', async (c) => {
  const supabase = c.get('supabase');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '21');
  const search = c.req.query('search') || '';
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from('people').select('*', { count: 'exact' });

  if (search) {
    const searchWords = search.trim().split(' ').filter(w => w.length > 0);
    const orConditions = searchWords.map(word => `firstName.ilike.%${word}%,lastName.ilike.%${word}%`).join(',');
    query = query.or(orConditions);
  }

  const { data: people, error, count } = await query.order('lastName').order('firstName').range(from, to);

  if (error) {
    console.error('Supabase fetch error:', error);
    return c.json({ error: `Failed to fetch people: ${error.message}` }, 500);
  }
  
  if (!Array.isArray(people) || people.length === 0) {
      return c.json({ people: [], total: count || 0 });
  }

  const studentGuardianIds = people
      .filter(p => p.category === PersonCategory.STUDENT && p.guardianIds?.length)
      .flatMap(p => p.guardianIds);

  if (studentGuardianIds.length > 0) {
      const uniqueGuardianIds = [...new Set(studentGuardianIds)];
      const { data: guardians, error: guardianError } = await supabase
          .from('people')
          .select('id, firstName, lastName')
          .in('id', uniqueGuardianIds);

      if (guardianError) {
          console.error('Failed to fetch guardian details:', guardianError);
      } else if (guardians) {
          const guardianMap = new Map(guardians.map(g => [g.id, g]));
          people.forEach((person: any) => {
              if (person.category === PersonCategory.STUDENT && person.guardianIds) {
                  person.guardianDetails = person.guardianIds
                      .map((id: number) => guardianMap.get(id))
                      .filter(Boolean);
              }
          });
      }
  }

  return c.json({ people, total: count || 0 });
});

app.get('/associates', async (c) => {
    const supabase = c.get('supabase');
    const search = c.req.query('search') || '';

    if (!search || search.length < 2) {
        return c.json([]);
    }

    let query = supabase
        .from('people')
        .select('id, firstName, lastName')
        .in('category', [PersonCategory.STAFF, PersonCategory.PARENT]);
    
    const searchWords = search.trim().split(' ').filter(w => w.length > 0);
    const orConditions = searchWords.map(word => `firstName.ilike.%${word}%,lastName.ilike.%${word}%`).join(',');
    query = query.or(orConditions);
    
    const { data, error } = await query.limit(10);

    if (error) {
        console.error('Supabase fetch associates error:', error);
        return c.json({ error: `Failed to fetch associates: ${error.message}` }, 500);
    }
    return c.json(data || []);
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
            image: await uploadImageToStorage(supabase, person.image, `${person.firstName}-${person.lastName}`),
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
                    image: await uploadImageToStorage(supabase, student.image, `${student.firstName}-${student.lastName}`),
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
    
    if (updateData.image && updateData.image.startsWith('data:image')) {
        updateData.image = await uploadImageToStorage(
            supabase, 
            updateData.image, 
            `${updateData.firstName}-${updateData.lastName}`
        );
    }
    
    const { error } = await supabase
        .from('people')
        .update(updateData)
        .eq('id', id);

    if (error) {
        console.error('Supabase update error:', error);
        return c.json({ error: 'Failed to update person', details: error.message }, 500);
    }

    return c.json({ success: true });
});

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

adminApp.get('/diagnostics', async (c) => {
    const supabase = c.get('supabase');
    let results: any = {};

    // 1. Check Supabase connection by fetching a simple record
    const { error: dbError } = await supabase.from('settings').select('key').limit(1);
    if (dbError) {
        results.supabaseConnection = { status: 'Failed', error: dbError };
        // Don't return early, try other checks
    } else {
        results.supabaseConnection = { status: 'Success', message: 'Successfully connected to Supabase.' };
    }
    
    // 2. Fetch all settings
    const { data: settingsData, error: settingsError } = await supabase.from('settings').select('key, value');
    results.settingsFetch = {
        status: settingsError ? 'Failed' : 'Success',
        data: settingsError ? settingsError : settingsData,
    };
    
    // 3. Fetch a sample profile
    const { data: profileData, error: profileError } = await supabase.from('people').select('*').limit(1);
    results.sampleProfileFetch = {
        status: profileError ? 'Failed' : 'Success',
        data: profileError ? profileError : profileData,
    };

    return c.json(results);
});


app.route('/admin', adminApp);

export default handle(app);