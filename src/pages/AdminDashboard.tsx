import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, PendingUser } from '../types';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import { useAuth } from '../contexts/AuthContext';
import { UserManagement } from '../components/UserManagement';
import { CheckCircleIcon } from '../components/icons/CheckCircleIcon';
import { XCircleIcon } from '../components/icons/XCircleIcon';
import { updateSetting, runAdminDiagnostics, getPendingUsers, confirmUser } from '../services/apiService';

interface AdminDashboardProps {
    settings: Settings;
    onSettingsUpdate: () => void;
}

const DiagnosticsTool: React.FC = () => {
    const { session } = useAuth();
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const [results, setResults] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleRunDiagnostics = async () => {
        setIsDiagnosing(true);
        setError(null);
        setResults(null);
        if (!session?.access_token) {
            setError("Authentication session has expired. Please log in again.");
            setIsDiagnosing(false);
            return;
        }

        try {
            const data = await runAdminDiagnostics(session.access_token);
            setResults(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsDiagnosing(false);
        }
    };

    const ResultDisplay: React.FC<{ title: string; result: any; }> = ({ title, result }) => {
        if (!result) return null;
        const isSuccess = result.status === 'Success';
        return (
            <div className="mt-4">
                <div className="flex items-center">
                    {isSuccess ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <XCircleIcon className="w-5 h-5 text-red-500" />}
                    <span className="ml-2 font-medium text-slate-800">{title}: <span className={isSuccess ? 'text-emerald-600' : 'text-red-600'}>{result.status}</span></span>
                </div>
                <div className="mt-2 pl-7 text-sm">
                    {result.message && <p className="text-slate-600">{result.message}</p>}
                    {(result.data || result.error) && (
                        <pre className="mt-1 p-2 bg-slate-100 rounded-md text-xs text-slate-700 overflow-x-auto">
                            {JSON.stringify(result.data || result.error, null, 2)}
                        </pre>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 mt-8 bg-white rounded-lg shadow-md">
            <h3 className="text-lg font-medium leading-6 text-slate-900">Diagnostics</h3>
            <p className="mt-1 text-sm text-slate-500">
                Run system checks to verify API, database, and data integrity.
            </p>
            <div className="mt-4">
                <button
                    onClick={handleRunDiagnostics}
                    disabled={isDiagnosing}
                    className="px-4 py-2 text-sm font-medium text-white bg-sky-600 border border-transparent rounded-md shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-sky-300 flex items-center justify-center w-40"
                >
                    {isDiagnosing ? <SpinnerIcon /> : 'Run Diagnostics'}
                </button>
            </div>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            {results && (
                <div className="mt-6 border-t pt-4">
                    <ResultDisplay title="API Health Check" result={{ status: 'Success', message: 'API endpoint is responsive.'}} />
                    <ResultDisplay title="Supabase Connection" result={results.supabaseConnection} />
                    <ResultDisplay title="Settings Fetch" result={results.settingsFetch} />
                    <ResultDisplay title="Sample Profile Fetch" result={results.sampleProfileFetch} />
                </div>
            )}
        </div>
    );
};


const PendingUsers: React.FC = () => {
    const { session } = useAuth();
    const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    
    const sessionRef = useRef(session);
    sessionRef.current = session;

    const fetchPendingUsers = useCallback(async () => {
        const accessToken = sessionRef.current?.access_token;
        if (!accessToken) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await getPendingUsers(accessToken);
            setPendingUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPendingUsers();
    }, [fetchPendingUsers]);

    const handleConfirmUser = async (userId: string) => {
        const accessToken = sessionRef.current?.access_token;
        if (!accessToken) return;
        setConfirmingId(userId);
        try {
            await confirmUser(accessToken, userId);
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
                {isLoading && (
                    <div className="flex justify-center items-center py-8">
                        <SpinnerIcon className="w-8 h-8 text-sky-600" />
                    </div>
                )}
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

        if (!session?.access_token) {
            setError("Authentication session has expired. Please log in again.");
            setIsLoading(false);
            return;
        }

        try {
            await updateSetting(session.access_token, 'googleSheetUrl', sheetUrl);
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
                
                <DiagnosticsTool />

                <PendingUsers />

                <UserManagement />
            </div>
        </div>
    );
};