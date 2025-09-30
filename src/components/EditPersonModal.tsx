import React, { useState, useEffect, useMemo } from 'react';
import { Person, PersonCategory } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { CameraIcon } from './icons/CameraIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface EditPersonModalProps {
  person: Person;
  allPeople: Person[];
  onClose: () => void;
  onSuccess: () => void;
}

export const EditPersonModal: React.FC<EditPersonModalProps> = ({ person, allPeople, onClose, onSuccess }) => {
  const { session } = useAuth();
  const [formData, setFormData] = useState({ ...person });
  const [imagePreview, setImagePreview] = useState<string | null>(person.image);
  const [newImageFile, setNewImageFile] = useState<string | null>(null);
  const [selectedGuardians, setSelectedGuardians] = useState<number[]>(person.guardianIds || []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset form data if the person prop changes
    setFormData({ ...person });
    setImagePreview(person.image);
    setSelectedGuardians(person.guardianIds || []);
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
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setImagePreview(dataUrl);
        setNewImageFile(dataUrl);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    
    if (!session) {
        setError("Authentication session expired. Please log in again.");
        setIsSaving(false);
        return;
    }

    const updatePayload: Partial<Person> = {
      ...formData,
      image: newImageFile || formData.image, // Send new base64 image if uploaded
      ...(formData.category === PersonCategory.STUDENT && { guardianIds: selectedGuardians }),
    };
    
    // Remove fields that shouldn't be updated
    delete (updatePayload as any).id;
    delete (updatePayload as any).bio; // Assuming bio is not editable here
    delete (updatePayload as any).googleSheetId;
    delete (updatePayload as any).createdAt;
    
    try {
        const response = await fetch(`/api/people/${person.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(updatePayload),
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to update profile.');
        }

        onSuccess();
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsSaving(false);
    }
  };

  const potentialGuardians = useMemo(() => 
    allPeople.filter(p => (p.category === PersonCategory.PARENT || p.category === PersonCategory.STAFF) && p.id !== person.id), 
    [allPeople, person.id]
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-slate-800">Edit Profile</h2>
          <p className="text-sm text-slate-500">Update the details for {person.firstName} {person.lastName}.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <img src={imagePreview || ''} alt="Profile" className="w-24 h-24 rounded-full object-cover" />
                <label className="absolute -bottom-1 -right-1 p-2 bg-sky-600 rounded-full text-white cursor-pointer hover:bg-sky-700 transition">
                  <CameraIcon className="w-4 h-4" />
                  <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
                </label>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-slate-700">First Name</label>
                  <input type="text" name="firstName" id="firstName" value={formData.firstName} onChange={handleInputChange} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-slate-700">Last Name</label>
                  <input type="text" name="lastName" id="lastName" value={formData.lastName} onChange={handleInputChange} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="roleOrClass" className="block text-sm font-medium text-slate-700">
                {person.category === PersonCategory.STUDENT ? 'Class/Grade' : 'Job/Position'}
              </label>
              <input 
                type="text" 
                name={person.category === PersonCategory.STUDENT ? 'class' : 'role'} 
                id="roleOrClass"
                value={person.category === PersonCategory.STUDENT ? formData.class : formData.role} 
                onChange={handleInputChange} 
                className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" 
              />
            </div>

            {person.category === PersonCategory.STUDENT && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Associated Guardians</h4>
                {potentialGuardians.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-lg border">
                        {potentialGuardians.map(p => (
                            <label key={p.id} className="flex items-center space-x-3 p-2 bg-white rounded-md border border-slate-200 cursor-pointer hover:bg-sky-50 transition has-[:checked]:bg-sky-100 has-[:checked]:border-sky-400">
                                <input type="checkbox" checked={selectedGuardians.includes(p.id)} onChange={() => handleGuardianSelection(p.id)} className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500" />
                                <span className="text-sm font-medium text-slate-700">{p.firstName} {p.lastName}</span>
                            </label>
                        ))}
                    </div>
                ) : ( <p className="text-sm text-slate-500 italic">No other parents or staff available to select as guardians.</p> )}
              </div>
            )}

            {error && <p className="text-sm text-center text-red-600">{error}</p>}
          </div>
          <div className="p-6 bg-slate-50 flex justify-end space-x-3 rounded-b-xl">
            <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-sky-300 flex items-center justify-center w-28">
              {isSaving ? <SpinnerIcon /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
