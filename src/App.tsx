import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { IdRepository } from './components/IdRepository';
import { AddPersonForm } from './components/AddPersonForm';
import { AdminDashboard } from './pages/AdminDashboard';
import { LoginPage } from './pages/LoginPage';
import { Person, Settings, Associate } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabaseClient';
import { SpinnerIcon } from './components/icons/SpinnerIcon';

type View = 'repository' | 'add' | 'admin';
const PAGE_LIMIT = 21;

/**
 * A helper function to wrap a fetch request with a timeout.
 * @param resource The URL or request info.
 * @param options The fetch options.
 * @param timeout The timeout in milliseconds.
 * @returns A promise that resolves with the fetch response or rejects on timeout.
 */
async function fetchWithTimeout(resource: RequestInfo, options: RequestInit = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal  
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout / 1000} seconds.`);
    }
    throw error;
  }
}

const AppContent: React.FC = () => {
    const { session, isAdmin, loading: authLoading } = useAuth();
    const [view, setView] = useState<View>('repository');
    const [people, setPeople] = useState<Person[]>([]);
    const [associates, setAssociates] = useState<Associate[]>([]);
    const [settings, setSettings] = useState<Settings>({});
    const [totalPeople, setTotalPeople] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAllData = useCallback(async (page: number, search: string) => {
        if (!session) return;
        setIsLoading(true);
        setError(null);
        try {
            const fetchOptions = { headers: { 'Authorization': `Bearer ${session.access_token}` } };
            const peopleUrl = `/api/people?page=${page}&limit=${PAGE_LIMIT}&search=${encodeURIComponent(search)}`;
            
            // Fetch people, settings, and the list of associates for guardian lookups
            const [peopleResponse, settingsResponse, associatesResponse] = await Promise.all([
                fetchWithTimeout(peopleUrl, fetchOptions),
                fetchWithTimeout('/api/settings', fetchOptions),
                fetchWithTimeout('/api/people/associates', fetchOptions)
            ]);

            // Process People Response
            if (!peopleResponse.ok) {
                 const errorText = await peopleResponse.text();
                 console.error('Error fetching people:', { status: peopleResponse.status, body: errorText });
                 throw new Error(`Failed to fetch people. Server responded with ${peopleResponse.status}.`);
            }
            const { people: fetchedPeople, total } = await peopleResponse.json();
            setPeople(fetchedPeople);
            setTotalPeople(total);
            setCurrentPage(page);

            // Process Settings Response
            if (!settingsResponse.ok) throw new Error('Failed to fetch settings');
            setSettings(await settingsResponse.json());
            
            // Process Associates Response
            if (!associatesResponse.ok) throw new Error('Failed to fetch associates for guardian lookups.');
            setAssociates(await associatesResponse.json());

        } catch (err) {
            console.error("An error occurred during data fetching:", err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred while loading data.');
        } finally {
            setIsLoading(false);
        }
    }, [session]);

    useEffect(() => {
        // Initial data load
        if(session) {
            fetchAllData(1, '');
        }
    }, [session]); // Depend on session to trigger initial load

    const handleSuccess = () => {
        // Refetch the current page after a successful add/edit/delete
        fetchAllData(currentPage, searchTerm);
        setView('repository');
    };

    const handleSearchChange = (term: string) => {
        setSearchTerm(term);
        // Reset to page 1 for new search
        fetchAllData(1, term);
    };

    const handlePageChange = (newPage: number) => {
        fetchAllData(newPage, searchTerm);
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <SpinnerIcon className="w-12 h-12 text-sky-600" />
            </div>
        );
    }

    if (!session) {
        return <LoginPage />;
    }

    const renderContent = () => {
        if (isLoading && people.length === 0) { // Only show full-page spinner on initial load
            return (
                <div className="flex items-center justify-center h-96">
                    <SpinnerIcon className="w-10 h-10 text-sky-600" />
                </div>
            );
        }
        if (error) return <div className="text-center p-10 text-red-600">Error: {error}</div>;
        
        switch (view) {
            case 'repository':
                return (
                    <IdRepository
                        people={people}
                        associates={associates}
                        settings={settings}
                        onSuccess={handleSuccess}
                        totalPeople={totalPeople}
                        currentPage={currentPage}
                        onPageChange={handlePageChange}
                        onSearchChange={handleSearchChange}
                        isLoading={isLoading}
                    />
                );
            case 'add':
                return <AddPersonForm onSuccess={handleSuccess} people={people} />;
            case 'admin':
                return isAdmin ? <AdminDashboard settings={settings} onSettingsUpdate={handleSuccess} /> : <div className="p-10 text-center">Access Denied.</div>;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Header currentView={view} onViewChange={setView} />
            <main>{renderContent()}</main>
        </div>
    );
};


const App: React.FC = () => (
    <AuthProvider>
        <AppContent />
    </AuthProvider>
);

export default App;