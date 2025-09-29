
import React, { useState, useCallback } from 'react';
import { Person, PersonCategory } from '../types';
import { generateBio } from '../services/geminiService';
import { UserIcon } from './icons/UserIcon';
import { CameraIcon } from './icons/CameraIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface AddPersonFormProps {
    onAddPerson: (person: Person) => void;
    people: Person[];
}

export const AddPersonForm: React.FC<AddPersonFormProps> = ({ onAddPerson, people }) => {
    const [category, setCategory] = useState<PersonCategory>(PersonCategory.STAFF);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [roleOrClass, setRoleOrClass] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [selectedGuardians, setSelectedGuardians] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                setImage(base64String);
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGuardianSelection = (guardianId: string) => {
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
        setError(null);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firstName || !lastName || !roleOrClass || !image) {
            setError("All fields including photo are required.");
            return;
        }
        if (category === PersonCategory.STUDENT && selectedGuardians.length === 0) {
            setError("At least one guardian must be selected for a student.");
            return;
        }
        
        setIsSaving(true);
        setError(null);

        try {
            const bio = await generateBio(firstName, lastName, category, roleOrClass);
            
            const newPerson: Person = {
                id: crypto.randomUUID(),
                category,
                firstName,
                lastName,
                image: imagePreview!, // We know it's not null from the check above
                bio,
                googleSheetId: `GS-${Math.floor(10000 + Math.random() * 90000)}`,
                ...(category === PersonCategory.STAFF && { role: roleOrClass }),
                ...(category === PersonCategory.STUDENT && { class: roleOrClass, guardianIds: selectedGuardians }),
            };

            onAddPerson(newPerson);
            resetForm();
        } catch (err) {
            setError("Failed to generate bio or save person. Please try again.");
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };
    
    const parents = people.filter(p => p.category === PersonCategory.PARENT);

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-slate-100 min-h-full">
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg">
                <div className="p-8">
                    <h2 className="text-3xl font-bold text-slate-800">Create New Profile</h2>
                    <p className="mt-1 text-slate-500">Fill in the details to add a new person to the repository.</p>
                </div>
                <form onSubmit={handleSubmit} className="p-8 border-t border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                                <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
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

                        {/* Guardian Selection */}
                        {category === PersonCategory.STUDENT && (
                            <div className="md:col-span-3">
                                <h3 className="text-lg font-medium text-slate-800 border-b pb-2 mb-4">Associate Guardians</h3>
                                {parents.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-lg">
                                        {parents.map(parent => (
                                            <label key={parent.id} className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-sky-50 transition">
                                                <input type="checkbox" checked={selectedGuardians.includes(parent.id)} onChange={() => handleGuardianSelection(parent.id)} className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500" />
                                                <span className="text-sm font-medium text-slate-700">{parent.firstName} {parent.lastName}</span>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center p-4 border-2 border-dashed rounded-lg">
                                        <p className="text-sm text-slate-500">No parents/guardians found. Please add one first.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
                    
                    <div className="mt-8 flex justify-end space-x-4">
                        <button type="button" onClick={resetForm} disabled={isSaving} className="px-6 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition">
                            Reset
                        </button>
                        <button type="submit" disabled={isSaving} className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-sky-300 flex items-center justify-center">
                            {isSaving ? <SpinnerIcon /> : 'Save Profile'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
