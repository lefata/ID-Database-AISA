import { google } from 'googleapis';

// Cache the client so we don't re-authenticate on every request
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

  const authClient = await auth.getClient();
  sheets = google.sheets({ version: 'v4', auth: authClient });
  return sheets;
}

/**
 * Searches for a student in the Google Sheet and returns their ID from Column M.
 * @param firstName The first name of the student.
 * @param lastName The last name of the student.
 * @returns The student's ID string if found, otherwise null.
 */
export async function getSheetIdForStudent(firstName: string, lastName: string): Promise<string | null> {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME || 'Sheet1';
    
    if (!sheetId) {
        console.warn('GOOGLE_SHEET_ID is not set. Skipping student ID lookup.');
        return null;
    }

    const client = await getSheetsClient();
    const searchName = `${firstName.trim()} ${lastName.trim()}`.toLowerCase();
    
    // Assumes First Name is in column A, Last Name is in column B, and ID is in column M.
    // Adjust the range if your sheet structure is different.
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
        // Student not found
        return null;
    } catch (err) {
        console.error('Error fetching data from Google Sheets API:', err);
        // Throw the error so the calling function can handle the fallback
        throw new Error('Failed to communicate with Google Sheets.');
    }
}