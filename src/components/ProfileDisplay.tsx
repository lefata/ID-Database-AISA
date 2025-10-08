import React from 'react';
import { Person, PersonCategory } from '../types';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';

interface ProfileDisplayProps {
    person: Person;
    userLocation: string | null;
    isLogging: boolean;
    successLog: { personId: number; direction: 'entry' | 'exit' } | null;
    onLog: (personId: number, direction: 'entry' | 'exit') => void;
}

const categoryStyles = {
    [PersonCategory.STAFF]: { bg: 'bg-sky-100', text: 'text-sky-800' },
    [PersonCategory.STUDENT]: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
    [PersonCategory.PARENT]: { bg: 'bg-amber-100', text: 'text-amber-800' },
};

export const ProfileDisplay: React.FC<ProfileDisplayProps> = ({ person, userLocation, isLogging, successLog, onLog }) => {
    const styles = categoryStyles[person.category];

    const renderLogButtonContent = (direction: 'entry' | 'exit') => {
        if (isLogging) {
            return <SpinnerIcon className="w-6 h-6" />;
        }
        if (successLog?.personId === person.id && successLog.direction === direction) {
            return <CheckCircleIcon className="w-8 h-8" />;
        }
        return direction === 'entry' ? (
            <>
                <ArrowRightIcon className="w-6 h-6" />
                <span>Log Entry</span>
            </>
        ) : (
            <>
                <ArrowLeftIcon className="w-6 h-6" />
                <span>Log Exit</span>
            </>
        );
    };

    return (
        <div className="w-full flex flex-col items-center text-center p-6 bg-white rounded-lg border animate-fade-in-scale">
            <img src={person.image} alt="profile" className="w-40 h-40 rounded-full object-cover ring-4 ring-offset-2 ring-slate-200 shadow-lg" />
            <div className="mt-4">
                <span className={`px-3 py-1 text-sm font-bold rounded-full ${styles.bg} ${styles.text}`}>
                    {person.category}
                </span>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">{person.firstName} {person.lastName}</h2>
                <p className="text-lg text-slate-500">{person.role || person.class}</p>
                 <p className="mt-2 text-xs font-medium rounded-full bg-slate-100 text-slate-600 px-3 py-1 inline-block">
                    ID: {person.googleSheetId}
                 </p>
            </div>
            <div className="mt-6 w-full flex space-x-4">
                <button
                    onClick={() => onLog(person.id, 'entry')}
                    disabled={isLogging || !!successLog}
                    className="flex-1 flex items-center justify-center space-x-2 py-4 bg-emerald-500 text-white text-lg font-semibold rounded-lg shadow-md hover:bg-emerald-600 transition disabled:bg-emerald-300 disabled:cursor-not-allowed"
                >
                   {renderLogButtonContent('entry')}
                </button>
                <button
                    onClick={() => onLog(person.id, 'exit')}
                    disabled={isLogging || !!successLog}
                    className="flex-1 flex items-center justify-center space-x-2 py-4 bg-amber-500 text-white text-lg font-semibold rounded-lg shadow-md hover:bg-amber-600 transition disabled:bg-amber-300 disabled:cursor-not-allowed"
                >
                    {renderLogButtonContent('exit')}
                </button>
            </div>
             <style>{`
                @keyframes fadeInScale {
                    from { opacity: 0; transform: scale(0.98); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in-scale {
                    animation: fadeInScale 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    );
};