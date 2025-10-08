import React, { useState } from 'react';
import { LocationMarkerIcon } from './icons/LocationMarkerIcon';

const locations = ['Gate 1', 'Gate 2', 'Route 66 Gate', 'Apartment Gate'];

interface LocationSelectionModalProps {
    onLocationSet: (location: string) => void;
}

export const LocationSelectionModal: React.FC<LocationSelectionModalProps> = ({ onLocationSet }) => {
    const [selectedLocation, setSelectedLocation] = useState(locations[0]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLocationSet(selectedLocation);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100">
            <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-lg animate-fade-in-scale">
                <div>
                    <h2 className="text-2xl font-bold text-center text-slate-900">
                        Set Your Location
                    </h2>
                    <p className="mt-2 text-sm text-center text-slate-500">
                        Please select your current gate or post for this session. This will be used for all access logs you record.
                    </p>
                </div>
                <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="location" className="block text-sm font-medium text-slate-700">Location</label>
                        <div className="relative mt-1">
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <LocationMarkerIcon className="h-5 w-5 text-slate-400" />
                            </div>
                            <select
                                id="location"
                                name="location"
                                value={selectedLocation}
                                onChange={(e) => setSelectedLocation(e.target.value)}
                                className="block w-full py-2 pl-10 pr-3 text-base border-slate-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                            >
                                {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <button
                            type="submit"
                            className="relative flex justify-center w-full px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md group bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                        >
                            Set Location and Continue
                        </button>
                    </div>
                </form>
            </div>
            <style>{`
                @keyframes fadeInScale {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in-scale {
                    animation: fadeInScale 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    );
};
