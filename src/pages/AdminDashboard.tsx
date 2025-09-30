import React, { useState } from 'react';
import { Settings } from '../types';
import { supabase } from '../lib/supabaseClient';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';

interface AdminDashboardProps {
    settings: Settings;
    onSettingsUpdate: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ settings, onSettingsUpdate }) => {
    const [sheetUrl, setSheetUrl] = useState(settings.googleSheetUrl || '');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const { error: rpcError } = await supabase.from('settings').upsert({ key: 'googleSheetUrl', value: sheetUrl });

            if (rpcError) {
                throw new Error(rpcError.message);
            }

            setSuccessMessage('Settings saved successfully!');
            onSettingsUpdate(); // Refresh settings in parent
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
            setTimeout(() => setSuccessMessage(null), 3000);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-800">Admin Dashboard</h2>
                    <p className="mt-1 text-slate-500">Manage application settings.</p>
                </div>

                <div className="p-6 bg-white rounded-lg shadow-md">
                    <form onSubmit={handleSave}>
                        <h3 className="text-lg font-medium leading-6 text-slate-900">Configuration</h3>
                        <div className="mt-4 space-y-4">
                            <div>
                                <label htmlFor="googleSheetUrl" className="block text-sm font-medium text-slate-700">
                                    Google Sheet URL
                                </label>
                                <div className="mt-1">
                                    <input
                                        type="url"
                                        name="googleSheetUrl"
                                        id="googleSheetUrl"
                                        className="block w-full border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                                        placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/"
                                        value={sheetUrl}
                                        onChange={(e) => setSheetUrl(e.target.value)}
                                    />
                                </div>
                                <p className="mt-2 text-sm text-slate-500">
                                    This is the base URL for the spreadsheet where ID records are kept. The Profile ID will be linked to this address.
                                </p>
                            </div>
                        </div>

                        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                        {successMessage && <p className="mt-4 text-sm text-emerald-600">{successMessage}</p>}

                        <div className="pt-5 mt-5 border-t border-slate-200">
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-4 py-2 text-sm font-medium text-white bg-sky-600 border border-transparent rounded-md shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-sky-300 flex items-center justify-center w-24"
                                >
                                    {isLoading ? <SpinnerIcon /> : 'Save'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
