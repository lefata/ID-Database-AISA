
import React, { useState } from 'react';
import { Header } from './components/Header';
import { IdRepository } from './components/IdRepository';
import { AddPersonForm } from './components/AddPersonForm';
import { Person, PersonCategory } from './types';

// Some initial data to make the app feel alive
const initialPeople: Person[] = [
    {
        id: 'staff-1',
        category: PersonCategory.STAFF,
        firstName: 'Eleanor',
        lastName: 'Vance',
        role: 'Principal',
        image: 'https://picsum.photos/seed/eleanor/200/200',
        bio: 'A visionary leader dedicated to fostering an inspiring learning environment.',
        googleSheetId: 'GS-83610',
    },
    {
        id: 'parent-1',
        category: PersonCategory.PARENT,
        firstName: 'Marcus',
        lastName: 'Cole',
        role: 'Parent',
        image: 'https://picsum.photos/seed/marcus/200/200',
        bio: 'An engaged parent committed to supporting the school community.',
        googleSheetId: 'GS-19283',
    },
    {
        id: 'parent-2',
        category: PersonCategory.PARENT,
        firstName: 'Olivia',
        lastName: 'Chen',
        role: 'Parent',
        image: 'https://picsum.photos/seed/olivia/200/200',
        bio: 'A creative and supportive presence in our community.',
        googleSheetId: 'GS-55431',
    },
    {
        id: 'student-1',
        category: PersonCategory.STUDENT,
        firstName: 'Leo',
        lastName: 'Cole',
        class: 'Grade 5',
        image: 'https://picsum.photos/seed/leo/200/200',
        bio: 'A curious and bright student with a passion for science.',
        googleSheetId: 'GS-48265',
        guardianIds: ['parent-1', 'parent-2'],
    },
];

const App: React.FC = () => {
    const [view, setView] = useState<'repository' | 'add'>('repository');
    const [people, setPeople] = useState<Person[]>(initialPeople);

    const handleAddPerson = (newPerson: Person) => {
        setPeople(prevPeople => [newPerson, ...prevPeople]);
        setView('repository'); // Switch back to repository view after adding
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Header currentView={view} onViewChange={setView} />
            <main>
                {view === 'repository' && <IdRepository people={people} />}
                {view === 'add' && <AddPersonForm onAddPerson={handleAddPerson} people={people}/>}
            </main>
        </div>
    );
};

export default App;
