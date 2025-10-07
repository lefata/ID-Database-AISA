import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { IdRepository } from './components/IdRepository';
import { AddPersonForm } from './components/AddPersonForm';
import { AdminDashboard } from './pages/AdminDashboard';
import { AccessControl } from './pages/AccessControl';
import { LoginPage } from './pages/LoginPage';
import { Person, Settings } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import { getPeople, getSettings } from './services/apiService';
import { WarningBanner } from './components/WarningBanner';

type View = 'repository' | 'add' | 'admin' | 'access_control';
const PAGE_LIMIT = 21;

const AppContent: React.FC = () => {
    const { session, isAdmin, isSecurity, loading: authLoading } = useAuth();
    const [view, setView] = useState<View>('repository');
    const [people, setPeople] = useState<Person[]>([]);
    const [settings, setSettings] = useState<Settings>({});
    const [totalPeople, setTotalPeople] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);

    const sessionRef = useRef(session);
    sessionRef.current = session;
    const userId = session?.user?.id;

    const fetchAllData = useCallback(async (page: number, search: string) => {
        const currentSession = sessionRef.current;
        if (!currentSession?.access_token) return;
        
        setIsLoading(true);
        setError(null);
        try {
            const token = currentSession.access_token;
            const [peopleData, settingsData] = await Promise.all([
                getPeople(token, page, PAGE_LIMIT, search),
                getSettings(token),
            ]);

            setPeople(peopleData.people);
            setTotalPeople(peopleData.total);
            setCurrentPage(page);
            setSettings(settingsData);

        } catch (err) {
            console.error("An error occurred during data fetching:", err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred while loading data.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (userId) {
            fetchAllData(1, searchTerm);
        } else if (!authLoading) {
            setIsLoading(false);
            setPeople([]);
            setTotalPeople(0);
        }
    }, [userId, authLoading, searchTerm, fetchAllData]);

    const handleSuccess = useCallback((response?: { warnings?: string[] }) => {
        fetchAllData(currentPage, searchTerm);
        setView('repository');
        if (response?.warnings && response.warnings.length > 0) {
            setWarnings(response.warnings);
        }
    }, [currentPage, searchTerm, fetchAllData]);

    const handleSearchChange = useCallback((term: string) => {
        setSearchTerm(term);
        fetchAllData(1, term);
    }, [fetchAllData]);

    const handlePageChange = useCallback((newPage: number) => {
        fetchAllData(newPage, searchTerm);
    }, [searchTerm, fetchAllData]);


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
            case 'access_control':
                 return isAdmin || isSecurity ? <AccessControl /> : <div className="p-10 text-center">Access Denied.</div>;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Header currentView={view} onViewChange={setView} isAdmin={isAdmin} isSecurity={isSecurity} />
            <WarningBanner warnings={warnings} onDismiss={() => setWarnings([])} />
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