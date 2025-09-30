import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { IdRepository } from './components/IdRepository';
import { AddPersonForm } from './components/AddPersonForm';
import { AdminDashboard } from './pages/AdminDashboard';
import { LoginPage } from './pages/LoginPage';
import { Person, Settings } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabaseClient';

type View = 'repository' | 'add' | 'admin';

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
            const [peopleResponse, settingsResponse] = await Promise.all([
                supabase.from('people').select('*').order('lastName').order('firstName'),
                supabase.from('settings').select('key, value')
            ]);

            if (peopleResponse.error) throw new Error(`Failed to fetch people: ${peopleResponse.error.message}`);
            if (settingsResponse.error) throw new Error(`Failed to fetch settings: ${settingsResponse.error.message}`);
            
            setPeople(peopleResponse.data || []);
            
            const settingsData = settingsResponse.data.reduce((acc, { key, value }) => {
              acc[key] = value;
              return acc;
            }, {} as Settings);
            setSettings(settingsData);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
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
        return <div className="flex items-center justify-center h-screen">Loading...</div>;
    }

    if (!session) {
        return <LoginPage />;
    }

    const renderContent = () => {
        if (isLoading) return <div className="text-center p-10">Loading Data...</div>;
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