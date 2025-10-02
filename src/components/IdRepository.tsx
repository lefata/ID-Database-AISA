import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Person, Settings, Associate } from '../types';
import { IdCard } from './IdCard';
import { SearchIcon } from './icons/SearchIcon';
import { UserIcon } from './icons/UserIcon';
import { EditPersonModal } from './EditPersonModal';
import { SpinnerIcon } from './icons/SpinnerIcon';

const PAGE_LIMIT = 21;

interface IdRepositoryProps {
    people: Person[];
    associates: Associate[];
    settings: Settings;
    onSuccess: () => void;
    totalPeople: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    onSearchChange: (term: string) => void;
    isLoading: boolean;
}

export const IdRepository: React.FC<IdRepositoryProps> = ({ 
    people,
    associates,
    settings,
    onSuccess,
    totalPeople,
    currentPage,
    onPageChange,
    onSearchChange,
    isLoading
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingPerson, setEditingPerson] = useState<Person | null>(null);
    const searchTimeout = useRef<number | null>(null);

    const googleSheetUrl = settings.googleSheetUrl || '';
    
    const handleEditSuccess = () => {
        setEditingPerson(null);
        onSuccess();
    };

    const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }
        searchTimeout.current = window.setTimeout(() => {
            onSearchChange(term);
        }, 500); // 500ms debounce
    };
    
    useEffect(() => {
        // Clear timeout on unmount
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

    const totalPages = Math.ceil(totalPeople / PAGE_LIMIT);
    const fromItem = Math.min((currentPage - 1) * PAGE_LIMIT + 1, totalPeople);
    const toItem = Math.min(currentPage * PAGE_LIMIT, totalPeople);

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
                            onChange={handleSearchInputChange}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                        />
                    </div>
                    <div className="relative">
                        {isLoading && (
                            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                                <SpinnerIcon className="w-8 h-8 text-sky-600" />
                            </div>
                        )}
                        {people.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {people.map(person => (
                                    <IdCard
                                      key={person.id}
                                      person={person}
                                      associates={associates}
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
                                    {totalPeople > 0 ? "No profiles match your search criteria." : "The repository is empty. Add a new person to get started."}
                                </p>
                            </div>
                        )}
                    </div>
                    {totalPages > 1 && (
                         <div className="mt-8 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-700">
                                    Showing <span className="font-medium">{fromItem}</span> to <span className="font-medium">{toItem}</span> of{' '}
                                    <span className="font-medium">{totalPeople}</span> results
                                </p>
                            </div>
                            <div className="flex-1 flex justify-end">
                                <button
                                    onClick={() => onPageChange(currentPage - 1)}
                                    disabled={currentPage <= 1 || isLoading}
                                    className="relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => onPageChange(currentPage + 1)}
                                    disabled={currentPage >= totalPages || isLoading}
                                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {editingPerson && (
                <EditPersonModal
                    person={editingPerson}
                    allPeople={people} // Note: This is now just one page of people
                    onClose={() => setEditingPerson(null)}
                    onSuccess={handleEditSuccess}
                />
            )}
        </>
    );
};