import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { IdRepository } from './components/IdRepository';
import { AddPersonForm } from './components/AddPersonForm';
import { AdminDashboard } from './pages/AdminDashboard';
import { LoginPage } from './pages/LoginPage';
import { Person, Settings } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SpinnerIcon } from './components/icons/SpinnerIcon';

type View = 'repository' | 'add' | 'admin';
const PAGE_LIMIT = 21;

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
    const [settings, setSettings] = useState<Settings>({});
    const [totalPeople, setTotalPeople] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const accessToken = session?.access_token;

    const fetchAllData = useCallback(async (page: number, search: string) => {
        if (!accessToken) return;
        setIsLoading(true);
        setError(null);
        try {
            const fetchOptions = { headers: { 'Authorization': `Bearer ${accessToken}` } };
            const peopleUrl = `/api/people?page=${page}&limit=${PAGE_LIMIT}&search=${encodeURIComponent(search)}`;
            
            const [peopleResponse, settingsResponse] = await Promise.all([
                fetchWithTimeout(peopleUrl, fetchOptions),
                fetchWithTimeout('/api/settings', fetchOptions),
            ]);

            if (!peopleResponse.ok) {
                 const errorText = await peopleResponse.text();
                 console.error('Error fetching people:', { status: peopleResponse.status, body: errorText });
                 throw new Error(`Failed to fetch people. Server responded with ${peopleResponse.status}.`);
            }
            const { people: fetchedPeople, total } = await peopleResponse.json();
            setPeople(fetchedPeople);
            setTotalPeople(total);
            setCurrentPage(page);

            if (!settingsResponse.ok) throw new Error('Failed to fetch settings');
            setSettings(await settingsResponse.json());

        } catch (err) {
            console.error("An error occurred during data fetching:", err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred while loading data.');
        } finally {
            setIsLoading(false);
        }
    }, [accessToken]);

    useEffect(() => {
        if (accessToken) {
            fetchAllData(1, searchTerm);
        } else if (!authLoading) {
            // If there's no session and we're not in an auth loading state, stop the app's loading spinner.
            setIsLoading(false);
        }
    }, [accessToken, authLoading]);

    const handleSuccess = () => {
        fetchAllData(currentPage, searchTerm);
        setView('repository');
    };

    const handleSearchChange = (term: string) => {
        setSearchTerm(term);
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
        // Show loading spinner if auth is done but we're fetching data for the first time
        if (isLoading && people.length === 0 && !error) {
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
                return <AddPersonForm onSuccess={handleSuccess} />;
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