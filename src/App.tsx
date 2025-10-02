import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { IdRepository } from './components/IdRepository';
import { AddPersonForm } from './components/AddPersonForm';
import { AdminDashboard } from './pages/AdminDashboard';
import { LoginPage } from './pages/LoginPage';
import { Person, Settings } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabaseClient';
import { SpinnerIcon } from './components/icons/SpinnerIcon';

type View = 'repository' | 'add' | 'admin';

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
    const { session, isAdmin, loading } = useAuth();
    const [view, setView] = useState<View>('repository');
    const [people, setPeople] = useState<Person[]>([]);
    const [settings, setSettings] = useState<Settings>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!session) return;
        setIsLoading(true);
        setError(null);
        try {
            const fetchOptions = { headers: { 'Authorization': `Bearer ${session.access_token}` } };
            
            const [peopleResponse, settingsResponse] = await Promise.all([
                fetchWithTimeout('/api/people', fetchOptions),
                fetchWithTimeout('/api/settings', fetchOptions)
            ]);

            if (!peopleResponse.ok) {
                const errorText = await peopleResponse.text();
                console.error('Error fetching people:', { 
                    status: peopleResponse.status, 
                    statusText: peopleResponse.statusText, 
                    body: errorText 
                });
                throw new Error(`Failed to fetch people. Server responded with ${peopleResponse.status} ${peopleResponse.statusText}.`);
            }
            if (!settingsResponse.ok) {
                 const errorText = await settingsResponse.text();
                console.error('Error fetching settings:', {
                    status: settingsResponse.status,
                    statusText: settingsResponse.statusText,
                    body: errorText
                });
                throw new Error(`Failed to fetch settings. Server responded with ${settingsResponse.status} ${settingsResponse.statusText}.`);
            }
            
            setPeople(await peopleResponse.json());
            setSettings(await settingsResponse.json());

        } catch (err) {
            console.error("An error occurred during data fetching:", err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred while loading data.');
        } finally {
            setIsLoading(false);
        }
    }, [session]);


    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSuccess = () => {
        fetchData();
        setView('repository');
    };

    if (loading) {
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
        if (isLoading) return (
            <div className="flex items-center justify-center h-96">
                <SpinnerIcon className="w-10 h-10 text-sky-600" />
            </div>
        );
        if (error) return <div className="text-center p-10 text-red-600">Error: {error}</div>;
        
        switch (view) {
            case 'repository':
                return <IdRepository people={people} settings={settings} onSuccess={handleSuccess} />;
            case 'add':
                return <AddPersonForm onSuccess={handleSuccess} people={people} />;
            case 'admin':
                return isAdmin ? <AdminDashboard settings={settings} onSettingsUpdate={fetchData} /> : <div className="p-10 text-center">Access Denied.</div>;
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