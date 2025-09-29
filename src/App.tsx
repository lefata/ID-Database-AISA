import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { IdRepository } from './components/IdRepository';
import { AddPersonForm } from './components/AddPersonForm';
import { Person } from './types';

const App: React.FC = () => {
    const [view, setView] = useState<'repository' | 'add'>('repository');
    const [people, setPeople] = useState<Person[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPeople = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/people');
        if (!response.ok) {
          throw new Error('Failed to fetch people from the repository.');
        }
        const data: Person[] = await response.json();
        setPeople(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    }, []);

    useEffect(() => {
        fetchPeople();
    }, [fetchPeople]);

    const handleSuccess = () => {
        fetchPeople(); // Refetch data after a successful addition
        setView('repository'); // Switch back to repository view
    };
    
    const renderContent = () => {
        if (isLoading) {
            return <div className="text-center p-10">Loading repository...</div>;
        }
        if (error) {
            return <div className="text-center p-10 text-red-600">Error: {error}</div>;
        }
        if (view === 'repository') {
            return <IdRepository people={people} />;
        }
        if (view === 'add') {
            return <AddPersonForm onSuccess={handleSuccess} people={people} />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Header currentView={view} onViewChange={setView} />
            <main>
                {renderContent()}
            </main>
        </div>
    );
};

export default App;
