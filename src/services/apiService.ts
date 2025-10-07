import { Person, Settings, Associate, NewPersonData, PendingUser, ManagedUser } from '../types';

// --- Private Helper ---
const API_BASE_URL = (import.meta as any).env.VITE_API_URL || '';

async function fetchWithTimeout(resource: RequestInfo, options: RequestInit = {}, timeout = 30000) { // Increased timeout for Lambda
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    const url = `${API_BASE_URL}${resource}`;

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);

        if (!response.ok) {
            let errorBody;
            try {
                errorBody = await response.json();
            } catch (e) {
                errorBody = { error: response.statusText || `Request failed with status ${response.status}` };
            }
            const error = new Error(errorBody.error || `Request failed with status ${response.status}`);
            (error as any).status = response.status;
            throw error;
        }
        
        if (response.status === 204) {
            return { success: true };
        }
        
        return response.json();
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout / 1000} seconds.`);
        }
        throw error;
    }
}

// --- People API ---

interface GetPeopleResponse {
    people: Person[];
    total: number;
}

export const getPeople = (token: string, page: number, limit: number, search: string): Promise<GetPeopleResponse> => {
    const url = `/api/people?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
    return fetchWithTimeout(url, { headers: { 'Authorization': `Bearer ${token}` } });
};

export const createPeople = (token: string, peopleData: (NewPersonData | any)[]): Promise<{ success: boolean; warnings?: string[] }> => {
    return fetchWithTimeout('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(peopleData),
    });
};

export const updatePerson = (token: string, personId: number, updateData: Partial<Person>): Promise<{ success: boolean }> => {
    return fetchWithTimeout(`/api/people/${personId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updateData),
    });
};

// --- Associates API (for searching guardians/staff) ---

export const searchAssociates = (token: string, searchTerm: string): Promise<Associate[]> => {
    return fetchWithTimeout(`/api/associates?search=${encodeURIComponent(searchTerm)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

// --- Settings API ---

export const getSettings = (token: string): Promise<Settings> => {
    return fetchWithTimeout('/api/settings', { headers: { 'Authorization': `Bearer ${token}` } });
};

export const updateSetting = (token: string, key: string, value: string): Promise<{ success: boolean }> => {
    return fetchWithTimeout('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ key, value }),
    });
};

// --- Admin API ---

export const getPendingUsers = (token: string): Promise<PendingUser[]> => {
    return fetchWithTimeout('/api/admin/pending-users', { headers: { 'Authorization': `Bearer ${token}` } });
};

export const confirmUser = (token: string, userId: string): Promise<{ success: boolean }> => {
    return fetchWithTimeout(`/api/admin/users/${userId}/confirm`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

export const getUsers = (token: string): Promise<ManagedUser[]> => {
    return fetchWithTimeout('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } });
};

export const updateUserRole = (token: string, userId: string, newRole: 'admin' | 'user'): Promise<{ success: boolean }> => {
    return fetchWithTimeout(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
    });
};

export const deleteUser = (token: string, userId: string): Promise<{ success: boolean }> => {
    return fetchWithTimeout(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

export const runDbVerifyAndRepair = (token: string): Promise<any> => {
    return fetchWithTimeout('/api/admin/db-verify-repair', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
    }, 60000); // 60 second timeout for this potentially long-running task
};


// --- Diagnostics API ---

export const runPublicDiagnostics = (): Promise<any> => {
    return fetchWithTimeout('/api/public/diagnostics', {}, 30000); // Give public diagnostics more time
};