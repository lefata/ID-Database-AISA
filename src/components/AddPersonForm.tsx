import React, { useState, useCallback, useRef } from 'react';
import { Person, PersonCategory, Associate } from '../types';
import { UserIcon } from './icons/UserIcon';
import { CameraIcon } from './icons/CameraIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { useAuth } from '../contexts/AuthContext';
import { TrashIcon } from './icons/TrashIcon';
import { ImageCropModal } from './ImageCropModal';
import { SearchIcon } from './icons/SearchIcon';

interface AddPersonFormProps {
    onSuccess: () => void;
}

type NewPersonData = Omit<Person, 'id' | 'bio' | 'googleSheetId' | 'guardianDetails'> & { tempId: string, guardianTempIds?: string[] };
type NewGuardianData = Omit<NewPersonData, 'category' | 'role' | 'class' | 'guardianIds' | 'guardianDetails'>;

const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
    // FIX: Use ReturnType<typeof setTimeout> to avoid type mismatch between browser (number) and Node (Timeout object).
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: Parameters<F>): Promise<ReturnType<F>> =>
        new Promise(resolve => {
            clearTimeout(timeout);
            timeout = setTimeout(() => resolve(func(...args)), waitFor);
        });
};

const PlusIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => ( <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg> );
const LinkIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => ( <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg> );
const XIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => ( <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> );

export const AddPersonForm: React.FC<AddPersonFormProps> = ({ onSuccess }) => {
    const { session } = useAuth();
    const [category, setCategory] = useState<PersonCategory>(PersonCategory.STAFF);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [roleOrClass, setRoleOrClass] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [selectedGuardians, setSelectedGuardians] = useState<Associate[]>([]);
    const [newGuardians, setNewGuardians] = useState<NewGuardianData[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [croppingImage, setCroppingImage] = useState<{ src: string; context: 'main' | string } | null>(null);
    
    // State for async searching
    const [guardianSearch, setGuardianSearch] = useState('');
    const [guardianResults, setGuardianResults] = useState<Associate[]>([]);
    const [isGuardianSearching, setIsGuardianSearching] = useState(false);
    const [siblingSearch, setSiblingSearch] = useState('');
    const [siblingResults, setSiblingResults] = useState<Person[]>([]);
    const [isSiblingSearching, setIsSiblingSearching] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, context: 'main' | string) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setCroppingImage({ src: reader.result as string, context });
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };
    
    const handleCropComplete = (croppedImageUrl: string) => {
        if (!croppingImage) return;
        if (croppingImage.context === 'main') {
            setImage(croppedImageUrl);
            setImagePreview(croppedImageUrl);
        } else {
            setNewGuardians(prev => prev.map(g => g.tempId === croppingImage.context ? { ...g, image: croppedImageUrl } : g));
        }
        setCroppingImage(null);
    };

    const debouncedGuardianSearch = useCallback(debounce(async (term: string) => {
        if (term.length < 2 || !session) {
            setGuardianResults([]);
            setIsGuardianSearching(false);
            return;
        }
        try {
            const response = await fetch(`/api/associates?search=${encodeURIComponent(term)}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Search failed');
            const data = await response.json();
            setGuardianResults(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsGuardianSearching(false);
        }
    }, 500), [session]);

    const handleGuardianSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setGuardianSearch(term);
        setIsGuardianSearching(true);
        debouncedGuardianSearch(term);
    };

    const handleSelectGuardian = (guardian: Associate) => {
        if (!selectedGuardians.some(g => g.id === guardian.id)) {
            setSelectedGuardians(prev => [...prev, guardian]);
        }
        setGuardianSearch('');
        setGuardianResults([]);
    };
    
    const debouncedSiblingSearch = useCallback(debounce(async (term: string) => {
        if (term.length < 2 || !session) {
            setSiblingResults([]);
            setIsSiblingSearching(false);
            return;
        }
        try {
            // Use the main /people endpoint to find students
            const response = await fetch(`/api/people?search=${encodeURIComponent(term)}&limit=5`, {
                 headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Search failed');
            const { people } = await response.json();
            setSiblingResults(people.filter((p: Person) => p.category === PersonCategory.STUDENT));
        } catch (err) {
            console.error(err);
        } finally {
            setIsSiblingSearching(false);
        }
    }, 500), [session]);
    
    const handleSiblingSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setSiblingSearch(term);
        setIsSiblingSearching(true);
        debouncedSiblingSearch(term);
    };

    const linkSiblingGuardians = (sibling: Person) => {
        if (sibling.guardianDetails) {
            const newGuardiansToAdd = sibling.guardianDetails.filter(
                (guardian) => !selectedGuardians.some(sg => sg.id === guardian.id)
            );
            setSelectedGuardians(prev => [...prev, ...newGuardiansToAdd]);
        }
        setSiblingSearch('');
        setSiblingResults([]);
    };


    const resetForm = useCallback(() => {
        setCategory(PersonCategory.STAFF); setFirstName(''); setLastName(''); setRoleOrClass(''); setImage(null); setImagePreview(null); setSelectedGuardians([]); setNewGuardians([]); setSiblingSearch(''); setGuardianSearch(''); setError(null);
    }, []);
    
    const addNewGuardian = () => setNewGuardians(prev => [...prev, { tempId: crypto.randomUUID(), firstName: '', lastName: '', image: '' }]);
    const removeNewGuardian = (id: string) => setNewGuardians(prev => prev.filter(g => g.tempId !== id));
    const updateNewGuardian = (id: string, field: 'firstName' | 'lastName', value: string) => setNewGuardians(prev => prev.map(g => g.tempId === id ? { ...g, [field]: value } : g));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!session) { setError("You must be logged in to add profiles."); return; }
        if (!firstName || !lastName || !roleOrClass || !image) { setError("All fields for the primary person, including photo, are required."); return; }
        if (category === PersonCategory.STUDENT && selectedGuardians.length === 0 && newGuardians.length === 0) { setError("A student must have at least one existing or new guardian associated."); return; }
        if (newGuardians.some(g => !g.firstName || !g.lastName || !g.image)) { setError("All fields and a photo are required for each new guardian."); return; }
        
        setIsSaving(true);
        try {
            const newGuardianPayload = newGuardians.map(g => ({ ...g, category: PersonCategory.PARENT, role: 'Parent/Guardian' }));
            const mainPersonPayload: NewPersonData = {
                tempId: crypto.randomUUID(), category, firstName, lastName, image,
                ...(category === PersonCategory.STAFF && { role: roleOrClass }),
                ...(category === PersonCategory.STUDENT && { class: roleOrClass }),
                ...(category === PersonCategory.PARENT && { role: roleOrClass }),
                ...(category === PersonCategory.STUDENT && { guardianIds: selectedGuardians.map(g => g.id), guardianTempIds: newGuardians.map(g => g.tempId) }),
            };
            
            const response = await fetch('/api/people', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify([mainPersonPayload, ...newGuardianPayload]),
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

    return (
        <>
            <div className="p-4 sm:p-6 lg:p-8 bg-slate-100 min-h-full">
                <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg">
                    <div className="p-8"><h2 className="text-3xl font-bold text-slate-800">Create New Profile</h2><p className="mt-1 text-slate-500">Fill in the details to add a new person to the repository.</p></div>
                    <form onSubmit={handleSubmit} className="p-8 border-t border-slate-200">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                            <div className="md:col-span-1 flex flex-col items-center">
                                <label className="text-sm font-medium text-slate-700 mb-2">Profile Photo</label>
                                <div className="w-40 h-40 rounded-full bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300 relative overflow-hidden">
                                    {imagePreview ? <img src={imagePreview} alt="Profile preview" className="w-full h-full object-cover" /> : <div className="text-center text-slate-500"><CameraIcon className="w-10 h-10 mx-auto" /><span className="text-xs mt-1 block">Upload Image</span></div>}
                                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'main')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                </div>
                            </div>
                            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="category" className="block text-sm font-medium text-slate-700">Category</label>
                                    <select id="category" value={category} onChange={(e) => { setCategory(e.target.value as PersonCategory); setRoleOrClass(''); }} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md"><option value={PersonCategory.STAFF}>Staff</option><option value={PersonCategory.STUDENT}>Student</option><option value={PersonCategory.PARENT}>Parent/Guardian</option></select>
                                </div>
                                <div className="sm:col-span-2 grid grid-cols-2 gap-6">
                                    <div><label htmlFor="firstName" className="block text-sm font-medium text-slate-700">First Name</label><input type="text" id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" /></div>
                                    <div><label htmlFor="lastName" className="block text-sm font-medium text-slate-700">Last Name</label><input type="text" id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" /></div>
                                </div>
                                <div className="sm:col-span-2"><label htmlFor="roleOrClass" className="block text-sm font-medium text-slate-700">{category === PersonCategory.STAFF ? 'Job/Position' : (category === PersonCategory.STUDENT ? 'Class/Grade' : 'Association (e.g., Parent)')}</label><input type="text" id="roleOrClass" placeholder={category === PersonCategory.STAFF ? 'e.g., Head Teacher' : 'e.g., Grade 5'} value={roleOrClass} onChange={(e) => setRoleOrClass(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" /></div>
                            </div>

                            {category === PersonCategory.STUDENT && (
                                <div className="md:col-span-3 mt-6 pt-6 border-t"><h3 className="text-xl font-semibold text-slate-800 mb-4">Guardians & Siblings</h3>
                                    <div className="space-y-6">
                                        <div>
                                            <label htmlFor="siblingSearch" className="block text-sm font-medium text-slate-700">Find Sibling by Name</label>
                                            <div className="relative"><input type="text" id="siblingSearch" value={siblingSearch} onChange={handleSiblingSearchChange} placeholder="Enter name to find siblings..." className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
                                            {isSiblingSearching && <SpinnerIcon className="absolute right-3 top-3.5 w-5 h-5 text-slate-400" />}</div>
                                            {siblingResults.length > 0 && <ul className="mt-2 space-y-1 border rounded-md shadow-sm bg-white">{siblingResults.map(sib => <li key={sib.id} className="flex justify-between items-center p-2 hover:bg-slate-50"><span className="text-sm">{sib.firstName} {sib.lastName} ({sib.class})</span><button type="button" onClick={() => linkSiblingGuardians(sib)} className="flex items-center space-x-1 text-sm text-sky-600 hover:text-sky-800 font-medium"><LinkIcon className="w-4 h-4" /><span>Link Guardians</span></button></li>)}</ul>}
                                        </div>
                                        <div>
                                            <label htmlFor="guardianSearch" className="block text-sm font-medium text-slate-700">Select Existing Guardians (Parents or Staff)</label>
                                            <div className="relative"><input id="guardianSearch" type="text" value={guardianSearch} onChange={handleGuardianSearchChange} placeholder="Start typing a name..." className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
                                            {isGuardianSearching && <SpinnerIcon className="absolute right-3 top-3.5 w-5 h-5 text-slate-400" />}</div>
                                            {guardianResults.length > 0 && <ul className="mt-1 border rounded-md shadow-sm bg-white max-h-48 overflow-y-auto">{guardianResults.map(p => <li key={p.id} onClick={() => handleSelectGuardian(p)} className="p-2 text-sm cursor-pointer hover:bg-sky-50">{p.firstName} {p.lastName}</li>)}</ul>}
                                            {selectedGuardians.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{selectedGuardians.map(g => <span key={g.id} className="flex items-center space-x-2 bg-sky-100 text-sky-800 text-sm font-medium px-3 py-1 rounded-full"><UserIcon className="w-4 h-4" /><span>{g.firstName} {g.lastName}</span><button type="button" onClick={() => setSelectedGuardians(prev => prev.filter(sg => sg.id !== g.id))} className="text-sky-600 hover:text-sky-800"><XIcon /></button></span>)}</div>}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-slate-700 mb-2">Add New Guardians</h4>
                                            <div className="space-y-4">{newGuardians.map(g => <div key={g.tempId} className="p-4 bg-slate-50 rounded-lg border grid grid-cols-1 sm:grid-cols-3 gap-4 relative"><div className="sm:col-span-1 flex items-center space-x-3"><div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center border-2 border-dashed border-slate-300 relative overflow-hidden">{g.image ? <img src={g.image} className="w-full h-full object-cover" /> : <CameraIcon className="w-6 h-6 text-slate-500" />}<input type="file" accept="image/*" onChange={(e) => handleFileChange(e, g.tempId)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /></div></div><div className="sm:col-span-2 grid grid-cols-2 gap-4"><input type="text" placeholder="First Name" value={g.firstName} onChange={e => updateNewGuardian(g.tempId, 'firstName', e.target.value)} className="w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" /><input type="text" placeholder="Last Name" value={g.lastName} onChange={e => updateNewGuardian(g.tempId, 'lastName', e.target.value)} className="w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" /></div><button type="button" onClick={() => removeNewGuardian(g.tempId)} className="absolute top-2 right-2 text-slate-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button></div>)}<button type="button" onClick={addNewGuardian} className="w-full flex items-center justify-center space-x-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-400 transition"><PlusIcon /><span>Add Guardian</span></button></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        {error && <p className="text-red-600 text-sm mt-6 text-center">{error}</p>}
                        <div className="mt-8 flex justify-end space-x-4"><button type="button" onClick={resetForm} disabled={isSaving} className="px-6 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition">Reset</button><button type="submit" disabled={isSaving} className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-sky-300 flex items-center justify-center w-32">{isSaving ? <SpinnerIcon /> : 'Save Profile'}</button></div>
                    </form>
                </div>
            </div>
            {croppingImage && <ImageCropModal imageSrc={croppingImage.src} onClose={() => setCroppingImage(null)} onCropComplete={handleCropComplete} />}
        </>
    );
};