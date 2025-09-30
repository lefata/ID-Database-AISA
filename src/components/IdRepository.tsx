import React, { useState } from 'react';
import { Person, Settings } from '../types';
import { IdCard } from './IdCard';
import { SearchIcon } from './icons/SearchIcon';
import { UserIcon } from './icons/UserIcon';
import { EditPersonModal } from './EditPersonModal';

interface IdRepositoryProps {
    people: Person[];
    settings: Settings;
    onSuccess: () => void;
}

export const IdRepository: React.FC<IdRepositoryProps> = ({ people, settings, onSuccess }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingPerson, setEditingPerson] = useState<Person | null>(null);

    const filteredPeople = people.filter(person =>
        `${person.firstName} ${person.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const googleSheetUrl = settings.googleSheetUrl || '';
    
    const handleEditSuccess = () => {
        setEditingPerson(null);
        onSuccess();
    };

    return (
        <>
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-6">
                        <h2 className="text-3xl font-bold text-slate-800">Member Repository</h2>
                        <p className="mt-1 text-slate-500">Search and browse profiles.</p>
                    </div>
                    <div className="relative mb-6">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                        />
                    </div>

                    {filteredPeople.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredPeople.map(person => (
                                <IdCard
                                  key={person.id}
                                  person={person}
                                  allPeople={people}
                                  googleSheetUrl={googleSheetUrl}
                                  onEdit={setEditingPerson}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-white rounded-lg shadow-sm">
                            <UserIcon className="mx-auto h-12 w-12 text-slate-400" />
                            <h3 className="mt-2 text-lg font-medium text-slate-900">No Profiles Found</h3>
                            <p className="mt-1 text-sm text-slate-500">
                                {people.length > 0 ? "No profiles match your search criteria." : "The repository is empty. Add a new person to get started."}
                            </p>
                        </div>
                    )}
                </div>
            </div>
            {editingPerson && (
                <EditPersonModal
                    person={editingPerson}
                    allPeople={people}
                    onClose={() => setEditingPerson(null)}
                    onSuccess={handleEditSuccess}
                />
            )}
        </>
    );
};