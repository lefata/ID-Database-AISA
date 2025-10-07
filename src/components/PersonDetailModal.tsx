import React, { useState, useEffect, useCallback } from 'react';
import { Person, PersonAccessLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { getPersonLogs } from '../services/apiService';
import { UserIcon } from './icons/UserIcon';
import { EditIcon } from './icons/EditIcon';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';

interface PersonDetailModalProps {
  person: Person;
  onClose: () => void;
  onEdit: (person: Person) => void;
}

const AccessHistory: React.FC<{ personId: number }> = ({ personId }) => {
    const { session } = useAuth();
    const [logs, setLogs] = useState<PersonAccessLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        if (!session?.access_token) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await getPersonLogs(session.access_token, personId);
            setLogs(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [personId, session]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    if (isLoading) {
        return <div className="flex justify-center items-center py-8"><SpinnerIcon className="w-8 h-8 text-sky-600" /></div>;
    }
    if (error) {
        return <div className="text-center text-red-600 py-8">Error loading logs: {error}</div>;
    }
    if (logs.length === 0) {
        return <div className="text-center text-slate-500 py-8">No access history found for this person.</div>;
    }

    return (
        <div className="space-y-3">
            {logs.map(log => (
                <div key={log.id} className="flex items-center space-x-4 p-3 bg-slate-50 rounded-md">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${log.direction === 'entry' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                        {log.direction === 'entry' ? <ArrowRightIcon className="w-5 h-5" /> : <ArrowLeftIcon className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-slate-800 capitalize">{log.direction} at <span className="font-normal">{log.location}</span></p>
                        <p className="text-sm text-slate-500">Recorded by {log.recorder?.email || 'Unknown'}</p>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                        <p>{new Date(log.created_at).toLocaleDateString()}</p>
                        <p>{new Date(log.created_at).toLocaleTimeString()}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({ person, onClose, onEdit }) => {
    const { isAdmin, isSecurity } = useAuth();
    const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{person.firstName} {person.lastName}</h2>
                        <p className="text-sm text-slate-500">{person.category} - {person.role || person.class}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        {isAdmin && (
                            <button onClick={() => onEdit(person)} className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors" aria-label="Edit profile">
                                <EditIcon className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Close modal">
                            <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
                
                {(isAdmin || isSecurity) && (
                    <div className="border-b">
                        <nav className="flex space-x-4 px-6">
                            <button onClick={() => setActiveTab('details')} className={`py-3 px-1 text-sm font-medium border-b-2 ${activeTab === 'details' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Details</button>
                            <button onClick={() => setActiveTab('history')} className={`py-3 px-1 text-sm font-medium border-b-2 ${activeTab === 'history' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Access History</button>
                        </nav>
                    </div>
                )}

                <div className="p-6 overflow-y-auto">
                   {(activeTab === 'details' || (!isAdmin && !isSecurity)) && (
                        <div className="space-y-4">
                            <div className="flex items-center space-x-6">
                                <img src={person.image} alt="Profile" className="w-24 h-24 rounded-full object-cover" />
                                <div className="flex-1">
                                    <p className="text-sm text-slate-600 italic">"{person.bio}"</p>
                                    <p className="text-xs font-medium rounded-full bg-slate-100 text-slate-600 px-3 py-1 mt-3 inline-block">ID: {person.googleSheetId}</p>
                                </div>
                            </div>
                            {person.category === 'Student' && person.guardianDetails && person.guardianDetails.length > 0 && (
                                <div>
                                    <h4 className="text-md font-semibold text-slate-700 mb-2">Associated Guardians</h4>
                                    <ul className="space-y-2">
                                        {person.guardianDetails.map(g => (
                                            <li key={g.id} className="flex items-center space-x-2 text-sm text-slate-600">
                                                <UserIcon className="w-4 h-4 text-slate-400" />
                                                <span>{g.firstName} {g.lastName}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                   )}
                   {activeTab === 'history' && (isAdmin || isSecurity) && (
                       <AccessHistory personId={person.id} />
                   )}
                </div>
            </div>
            <style>{`.animate-fade-in { animation: fadeIn 0.2s ease-out forwards; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        </div>
    );
};