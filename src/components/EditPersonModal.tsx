import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Person, PersonCategory, Associate } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { CameraIcon } from './icons/CameraIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { ImageCropModal } from './ImageCropModal';
import { UserIcon } from './icons/UserIcon';
import { searchAssociates, updatePerson } from '../services/apiService';

interface EditPersonModalProps {
  person: Person;
  onClose: () => void;
  onSuccess: () => void;
}

const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: Parameters<F>): Promise<ReturnType<F>> =>
        new Promise(resolve => {
            clearTimeout(timeout);
            timeout = setTimeout(() => resolve(func(...args)), waitFor);
        });
};

const XIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => ( <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> );

export const EditPersonModal: React.FC<EditPersonModalProps> = ({ person, onClose, onSuccess }) => {
  const { session } = useAuth();
  const [formData, setFormData] = useState({ ...person });
  const [imagePreview, setImagePreview] = useState<string | null>(person.image);
  const [newImageFile, setNewImageFile] = useState<string | null>(null);
  const [selectedGuardians, setSelectedGuardians] = useState<Associate[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [croppingImageSrc, setCroppingImageSrc] = useState<string | null>(null);
  
  // State for async searching
  const [guardianSearch, setGuardianSearch] = useState('');
  const [guardianResults, setGuardianResults] = useState<Associate[]>([]);
  const [isGuardianSearching, setIsGuardianSearching] = useState(false);
  
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    setFormData({ ...person });
    setImagePreview(person.image);
    setSelectedGuardians(person.guardianDetails || []);
    setNewImageFile(null);
    setError(null);
  }, [person]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCroppingImageSrc(reader.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleCropComplete = (croppedImageUrl: string) => {
    setImagePreview(croppedImageUrl);
    setNewImageFile(croppedImageUrl);
    setCroppingImageSrc(null);
  };
  
  const debouncedGuardianSearch = useCallback(debounce(async (term: string) => {
      const accessToken = sessionRef.current?.access_token;
      if (term.length < 2 || !accessToken) {
          setGuardianResults([]);
          setIsGuardianSearching(false);
          return;
      }
      try {
          const data = await searchAssociates(accessToken, term);
          setGuardianResults(data);
      } catch (err) {
          console.error(err);
      } finally {
          setIsGuardianSearching(false);
      }
  }, 500), []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    
    const accessToken = sessionRef.current?.access_token;
    if (!accessToken) { setError("Authentication session expired. Please log in again."); setIsSaving(false); return; }

    const updatePayload: Partial<Person> = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      role: formData.role,
      class: formData.class,
      image: newImageFile || formData.image,
      ...(formData.category === PersonCategory.STUDENT && { guardianIds: selectedGuardians.map(g => g.id) }),
    };
    
    try {
        await updatePerson(accessToken, person.id, updatePayload);
        onSuccess();
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-slate-800">Edit Profile</h2>
            <p className="text-sm text-slate-500">Update the details for {person.firstName} {person.lastName}.</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-6">
              <div className="flex items-center space-x-6">
                <div className="relative"><img src={imagePreview || ''} alt="Profile" className="w-24 h-24 rounded-full object-cover" /><label className="absolute -bottom-1 -right-1 p-2 bg-sky-600 rounded-full text-white cursor-pointer hover:bg-sky-700 transition"><CameraIcon className="w-4 h-4" /><input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" /></label></div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div><label htmlFor="firstName" className="block text-sm font-medium text-slate-700">First Name</label><input type="text" name="firstName" id="firstName" value={formData.firstName} onChange={handleInputChange} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" /></div>
                  <div><label htmlFor="lastName" className="block text-sm font-medium text-slate-700">Last Name</label><input type="text" name="lastName" id="lastName" value={formData.lastName} onChange={handleInputChange} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" /></div>
                </div>
              </div>
              <div>
                <label htmlFor="roleOrClass" className="block text-sm font-medium text-slate-700">{person.category === PersonCategory.STUDENT ? 'Class/Grade' : 'Job/Position'}</label>
                <input type="text" name={person.category === PersonCategory.STUDENT ? 'class' : 'role'} id="roleOrClass" value={person.category === PersonCategory.STUDENT ? formData.class : formData.role} onChange={handleInputChange} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
              </div>

              {person.category === PersonCategory.STUDENT && (
                <div>
                  <label htmlFor="guardianSearch" className="block text-sm font-medium text-slate-700">Associated Guardians</label>
                  <div className="relative"><input id="guardianSearch" type="text" value={guardianSearch} onChange={handleGuardianSearchChange} placeholder="Search to add a guardian..." className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
                  {isGuardianSearching && <SpinnerIcon className="absolute right-3 top-3.5 w-5 h-5 text-slate-400" />}</div>
                  {guardianResults.length > 0 && <ul className="mt-1 border rounded-md shadow-sm bg-white max-h-40 overflow-y-auto">{guardianResults.map(p => <li key={p.id} onClick={() => handleSelectGuardian(p)} className="p-2 text-sm cursor-pointer hover:bg-sky-50">{p.firstName} {p.lastName}</li>)}</ul>}
                  {selectedGuardians.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{selectedGuardians.map(g => <span key={g.id} className="flex items-center space-x-2 bg-sky-100 text-sky-800 text-sm font-medium px-3 py-1 rounded-full"><UserIcon className="w-4 h-4" /><span>{g.firstName} {g.lastName}</span><button type="button" onClick={() => setSelectedGuardians(prev => prev.filter(sg => sg.id !== g.id))} className="text-sky-600 hover:text-sky-800"><XIcon /></button></span>)}</div>}
                </div>
              )}
              {error && <p className="text-sm text-center text-red-600">{error}</p>}
            </div>
            <div className="p-6 bg-slate-50 flex justify-end space-x-3 rounded-b-xl">
              <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition">Cancel</button>
              <button type="submit" disabled={isSaving} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-sky-300 flex items-center justify-center w-28">{isSaving ? <SpinnerIcon /> : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      </div>
      {croppingImageSrc && <ImageCropModal imageSrc={croppingImageSrc} onClose={() => setCroppingImageSrc(null)} onCropComplete={handleCropComplete} />}
    </>
  );
};