import React from 'react';
import { Person, PersonCategory } from '../types';
import { UserIcon } from './icons/UserIcon';

interface IdCardProps {
    person: Person;
    googleSheetId: string;
    onClick: () => void;
}

const categoryStyles = {
    [PersonCategory.STAFF]: {
        bg: 'bg-sky-500',
        text: 'text-sky-800',
        tag: 'bg-sky-100 text-sky-700',
    },
    [PersonCategory.STUDENT]: {
        bg: 'bg-emerald-500',
        text: 'text-emerald-800',
        tag: 'bg-emerald-100 text-emerald-700',
    },
    [PersonCategory.PARENT]: {
        bg: 'bg-amber-500',
        text: 'text-amber-800',
        tag: 'bg-amber-100 text-amber-700',
    },
};

export const IdCard: React.FC<IdCardProps> = ({ person, googleSheetId, onClick }) => {
    const styles = categoryStyles[person.category];
    
    const IdTag = () => {
        const content = `ID: ${person.googleSheetId}`;
        const className = `px-3 py-1 text-xs font-medium rounded-full ${styles.tag}`;
        const sheetUrl = googleSheetId ? `https://docs.google.com/spreadsheets/d/${googleSheetId}/` : '';
        
        if (sheetUrl && !sheetUrl.includes('your-sheet-id-here')) {
            return (
                <a 
                  href={sheetUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`${className} hover:ring-2 hover:ring-offset-1 hover:ring-sky-500 transition-all`}
                  title="View in Google Sheet"
                  onClick={(e) => e.stopPropagation()} // Prevent card click when clicking link
                >
                    {content}
                </a>
            );
        }
        return <span className={className}>{content}</span>;
    }

    return (
        <div 
          className="bg-white rounded-xl shadow-lg overflow-hidden transform hover:scale-105 hover:shadow-xl transition-all duration-300 ease-in-out cursor-pointer"
          onClick={onClick}
        >
            <div className={`h-2 ${styles.bg}`}></div>
            <div className="p-6">
                <div className="flex items-center space-x-4">
                    <img className="h-20 w-20 rounded-full object-cover ring-4 ring-offset-2 ring-slate-200" src={person.image} alt={`${person.firstName} ${person.lastName}`} />
                    <div className="flex-1">
                        <p className={`text-xs font-semibold uppercase tracking-wider ${styles.text}`}>{person.category}</p>
                        <h3 className="text-xl font-bold text-slate-800">{person.firstName} {person.lastName}</h3>
                        <p className="text-sm text-slate-500">{person.role || person.class}</p>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-sm text-slate-600 italic">"{person.bio}"</p>
                    <div className="mt-3 flex justify-between items-center">
                         <IdTag />
                    </div>
                </div>
                {person.category === PersonCategory.STUDENT && person.guardianDetails && person.guardianDetails.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Associated Guardians</h4>
                        <ul className="space-y-2">
                            {person.guardianDetails.map(guardian => (
                                <li key={guardian.id} className="flex items-center space-x-2 text-sm text-slate-600">
                                    <UserIcon className="w-4 h-4 text-slate-400" />
                                    <span>{`${guardian.firstName} ${guardian.lastName}`}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};