import React, { useState, useCallback, useMemo } from 'react';
import { Person, PersonCategory } from '../types';
import { UserIcon } from './icons/UserIcon';
import { CameraIcon } from './icons/CameraIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface AddPersonFormProps {
    onSuccess: () => void;
    people: Person[];
}

type NewPersonData = Omit<Person, 'id' | 'bio' | 'googleSheetId'> & { tempId: string, guardianTempIds?: string[] };
type NewGuardianData = Omit<NewPersonData, 'category' | 'role' | 'class' | 'guardianIds'>;


const PlusIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const LinkIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);


export const AddPersonForm: React.FC<AddPersonFormProps> = ({ onSuccess, people }) => {
    const { session } = useAuth();
    const [category, setCategory] = useState<PersonCategory>(PersonCategory.STAFF);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [roleOrClass, setRoleOrClass] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [selectedGuardians, setSelectedGuardians] = useState<number[]>([]);
    const [newGuardians, setNewGuardians] = useState<NewGuardianData[]>([]);
    const [siblingSearch, setSiblingSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, guardianTempId?: string) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                if (guardianTempId) {
                    setNewGuardians(prev => prev.map(g => g.tempId === guardianTempId ? { ...g, image: dataUrl } : g));
                } else {
                    setImage(dataUrl);
                    setImagePreview(dataUrl);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGuardianSelection = (guardianId: number) => {
        setSelectedGuardians(prev =>
            prev.includes(guardianId)
                ? prev.filter(id => id !== guardianId)
                : [...prev, guardianId]
        );
    };

    const resetForm = useCallback(() => {
        setCategory(PersonCategory.STAFF);
        setFirstName('');
        setLastName('');
        setRoleOrClass('');
        setImage(null);
        setImagePreview(null);
        setSelectedGuardians([]);
        setNewGuardians([]);
        setSiblingSearch('');
        setError(null);
    }, []);
    
    const addNewGuardian = () => {
        setNewGuardians(prev => [...prev, { tempId: crypto.randomUUID(), firstName: '', lastName: '', image: '' }]);
    };
    
    const removeNewGuardian = (id: string) => {
        setNewGuardians(prev => prev.filter(g => g.tempId !== id));
    };

    const updateNewGuardian = (id: string, field: 'firstName' | 'lastName', value: string) => {
        setNewGuardians(prev => prev.map(g => g.tempId === id ? { ...g, [field]: value } : g));
    };

    const linkSiblingGuardians = (sibling: Person) => {
        if (sibling.guardianIds) {
            setSelectedGuardians(prev => [...new Set([...prev, ...sibling.guardianIds!])]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!session) {
            setError("You must be logged in to add profiles.");
            return;
        }

        if (!firstName || !lastName || !roleOrClass || !image) {
            setError("All fields for the primary person, including photo, are required.");
            return;
        }
        if (category === PersonCategory.STUDENT && selectedGuardians.length === 0 && newGuardians.length === 0) {
            setError("A student must have at least one existing or new guardian associated.");
            return;
        }
        const invalidNewGuardian = newGuardians.some(g => !g.firstName || !g.lastName || !g.image);
        if (invalidNewGuardian) {
            setError("All fields and a photo are required for each new guardian.");
            return;
        }
        
        setIsSaving(true);

        try {
            const newGuardianPayload: NewPersonData[] = newGuardians.map(g => ({
                ...g,
                category: PersonCategory.PARENT,
                role: 'Parent/Guardian',
            }));

            const mainPersonPayload: NewPersonData = {
                tempId: crypto.randomUUID(),
                category,
                firstName,
                lastName,
                image: imagePreview!,
                ...(category === PersonCategory.STAFF && { role: roleOrClass }),
                ...(category === PersonCategory.STUDENT && { class: roleOrClass }),
                ...(category === PersonCategory.PARENT && { role: roleOrClass }),
                ...(category === PersonCategory.STUDENT && { 
                    guardianIds: selectedGuardians,
                    guardianTempIds: newGuardians.map(g => g.tempId)
                }),
            };
            
            const payload = [mainPersonPayload, ...newGuardianPayload];

            const response = await fetch('/api/people', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to save profiles.');
            }

            onSuccess();
            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };
    
    const potentialGuardians = useMemo(() => people.filter(p => p.category === PersonCategory.PARENT || p.category === PersonCategory.STAFF), [people]);
    const potentialSiblings = useMemo(() => {
        if (!siblingSearch) return [];
        return people.filter(p => p.category === PersonCategory.STUDENT && p.lastName.toLowerCase().includes(siblingSearch.toLowerCase()));
    }, [people, siblingSearch]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-slate-100 min-h-full">
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg">
                <div className="p-8">
                    <h2 className="text-3xl font-bold text-slate-800">Create New Profile</h2>
                    <p className="mt-1 text-slate-500">Fill in the details to add a new person to the repository.</p>
                </div>
                <form onSubmit={handleSubmit} className="p-8 border-t border-slate-200">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                        {/* Photo Upload */}
                        <div className="md:col-span-1 flex flex-col items-center">
                            <label className="text-sm font-medium text-slate-700 mb-2">Profile Photo</label>
                            <div className="w-40 h-40 rounded-full bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300 relative overflow-hidden">
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Profile preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center text-slate-500">
                                        <CameraIcon className="w-10 h-10 mx-auto" />
                                        <span className="text-xs mt-1 block">Upload Image</span>
                                    </div>
                                )}
                                <input type="file" accept="image/*" onChange={(e) => handleFileChange(e)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            </div>
                        </div>

                        {/* Form Fields */}
                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="category" className="block text-sm font-medium text-slate-700">Category</label>
                                <select id="category" value={category} onChange={(e) => { setCategory(e.target.value as PersonCategory); setRoleOrClass(''); }} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md">
                                    <option value={PersonCategory.STAFF}>Staff</option>
                                    <option value={PersonCategory.STUDENT}>Student</option>
                                    <option value={PersonCategory.PARENT}>Parent/Guardian</option>
                                </select>
                            </div>
                            <div className="sm:col-span-2 grid grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="firstName" className="block text-sm font-medium text-slate-700">First Name</label>
                                    <input type="text" id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
                                </div>
                                <div>
                                    <label htmlFor="lastName" className="block text-sm font-medium text-slate-700">Last Name</label>
                                    <input type="text" id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <label htmlFor="roleOrClass" className="block text-sm font-medium text-slate-700">
                                    {category === PersonCategory.STAFF ? 'Job/Position' : (category === PersonCategory.STUDENT ? 'Class/Grade' : 'Association (e.g., Parent)')}
                                </label>
                                <input type="text" id="roleOrClass" placeholder={category === PersonCategory.STAFF ? 'e.g., Head Teacher' : 'e.g., Grade 5'} value={roleOrClass} onChange={(e) => setRoleOrClass(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
                            </div>
                        </div>

                        {/* Guardian & Sibling Selection */}
                        {category === PersonCategory.STUDENT && (
                            <div className="md:col-span-3 mt-6 pt-6 border-t">
                                <h3 className="text-xl font-semibold text-slate-800 mb-4">Guardians & Siblings</h3>
                                
                                <div className="space-y-6">
                                    {/* Sibling Link */}
                                    <div>
                                        <label htmlFor="siblingSearch" className="block text-sm font-medium text-slate-700">Find Sibling by Last Name</label>
                                        <input type="text" id="siblingSearch" value={siblingSearch} onChange={e => setSiblingSearch(e.target.value)} placeholder="Enter last name to find siblings..." className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
                                        {potentialSiblings.length > 0 && (
                                            <ul className="mt-2 space-y-1">
                                                {potentialSiblings.map(sib => (
                                                    <li key={sib.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-md">
                                                        <span className="text-sm">{sib.firstName} {sib.lastName} ({sib.class})</span>
                                                        <button type="button" onClick={() => linkSiblingGuardians(sib)} className="flex items-center space-x-1 text-sm text-sky-600 hover:text-sky-800 font-medium">
                                                            <LinkIcon className="w-4 h-4" />
                                                            <span>Link Guardians</span>
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    
                                    {/* Existing Guardians */}
                                    <div>
                                        <h4 className="text-sm font-medium text-slate-700 mb-2">Select Existing Guardians (Parents or Staff)</h4>
                                        {potentialGuardians.length > 0 ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-lg border">
                                                {potentialGuardians.map(person => (
                                                    <label key={person.id} className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-sky-50 transition has-[:checked]:bg-sky-50 has-[:checked]:border-sky-400">
                                                        <input type="checkbox" checked={selectedGuardians.includes(person.id)} onChange={() => handleGuardianSelection(person.id)} className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500" />
                                                        <span className="text-sm font-medium text-slate-700">{person.firstName} {person.lastName}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        ) : ( <p className="text-sm text-slate-500 italic">No existing guardians or staff found.</p> )}
                                    </div>
                                    
                                    {/* Add New Guardians */}
                                    <div>
                                        <h4 className="text-sm font-medium text-slate-700 mb-2">Add New Guardians</h4>
                                        <div className="space-y-4">
                                            {newGuardians.map((guardian, index) => (
                                                <div key={guardian.tempId} className="p-4 bg-slate-50 rounded-lg border grid grid-cols-1 sm:grid-cols-3 gap-4 relative">
                                                    <div className="sm:col-span-1 flex items-center space-x-3">
                                                        <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center border-2 border-dashed border-slate-300 relative overflow-hidden">
                                                            {guardian.image ? <img src={guardian.image} className="w-full h-full object-cover" /> : <CameraIcon className="w-6 h-6 text-slate-500" />}
                                                            <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, guardian.tempId)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                                        </div>
                                                    </div>
                                                    <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                                                        <input type="text" placeholder="First Name" value={guardian.firstName} onChange={e => updateNewGuardian(guardian.tempId, 'firstName', e.target.value)} className="w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
                                                        <input type="text" placeholder="Last Name" value={guardian.lastName} onChange={e => updateNewGuardian(guardian.tempId, 'lastName', e.target.value)} className="w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
                                                    </div>
                                                    <button type="button" onClick={() => removeNewGuardian(guardian.tempId)} className="absolute top-2 right-2 text-slate-400 hover:text-red-600">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={addNewGuardian} className="w-full flex items-center justify-center space-x-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-400 transition">
                                                <PlusIcon />
                                                <span>Add Guardian</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {error && <p className="text-red-600 text-sm mt-6 text-center">{error}</p>}
                    
                    <div className="mt-8 flex justify-end space-x-4">
                        <button type="button" onClick={resetForm} disabled={isSaving} className="px-6 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition">
                            Reset
                        </button>
                        <button type="submit" disabled={isSaving} className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-sky-300 flex items-center justify-center w-32">
                            {isSaving ? <SpinnerIcon /> : 'Save Profile'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};