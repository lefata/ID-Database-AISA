import React, { useState, useEffect, useCallback } from 'react';
import { Settings } from '../types';
import { supabase } from '../lib/supabaseClient';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import { useAuth } from '../contexts/AuthContext';
import { UserManagement } from '../components/UserManagement';

interface AdminDashboardProps {
    settings: Settings;
    onSettingsUpdate: () => void;
}

interface PendingUser {
    id: string;
    email: string;
    created_at: string;
}

const PendingUsers: React.FC = () => {
    const { session } = useAuth();
    const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    const fetchPendingUsers = useCallback(async () => {
        if (!session) return;
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/pending-users', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to fetch pending users.');
            }
            const data = await response.json();
            setPendingUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [session]);

    useEffect(() => {
        fetchPendingUsers();
    }, [fetchPendingUsers]);

    const handleConfirmUser = async (userId: string) => {
        if (!session) return;
        setConfirmingId(userId);
        try {
            const response = await fetch(`/api/admin/users/${userId}/confirm`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) {
                 const errData = await response.json();
                throw new Error(errData.error || 'Failed to confirm user.');
            }
            // Refresh list on success
            await fetchPendingUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setConfirmingId(null);
        }
    }

    return (
        <div className="p-6 mt-8 bg-white rounded-lg shadow-md">
            <h3 className="text-lg font-medium leading-6 text-slate-900">Pending User Approvals</h3>
            <div className="mt-4">
                {isLoading && <p>Loading users...</p>}
                {error && <p className="text-sm text-red-600">{error}</p>}
                {!isLoading && !error && pendingUsers.length === 0 && <p className="text-sm text-slate-500">No users are currently awaiting approval.</p>}
                {pendingUsers.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Signed Up</th>
                                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Approve</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {pendingUsers.map((user) => (
                                    <tr key={user.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{user.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{new Date(user.created_at).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button 
                                                onClick={() => handleConfirmUser(user.id)}
                                                disabled={confirmingId === user.id}
                                                className="inline-flex items-center justify-center w-24 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 border border-transparent rounded-md shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-emerald-300"
                                            >
                                                {confirmingId === user.id ? <SpinnerIcon className="w-4 h-4" /> : 'Approve'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}


export const AdminDashboard: React.FC<AdminDashboardProps> = ({ settings, onSettingsUpdate }) => {
    const { session } = useAuth();
    const [sheetUrl, setSheetUrl] = useState(settings.googleSheetUrl || '');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        if (!session) {
            setError("Authentication session has expired. Please log in again.");
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ key: 'googleSheetUrl', value: sheetUrl }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to save settings.');
            }

            setSuccessMessage('Settings saved successfully!');
            onSettingsUpdate(); // Refresh settings in parent
        } catch (err: any) {
            setError(err.message);
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
                    <p className="mt-1 text-slate-500">Manage application settings and user approvals.</p>
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
                
                <PendingUsers />

                <UserManagement />
            </div>
        </div>
    );
};