import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPersonBySheetId, logAccess, getRecentLogs, getAnalytics } from '../services/apiService';
import { Person, AccessLog, AnalyticsData } from '../types';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import { ArrowRightIcon } from '../components/icons/ArrowRightIcon';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { XCircleIcon } from '../components/icons/XCircleIcon';
import { BuildingOfficeIcon } from '../components/icons/BuildingOfficeIcon';
import { ProfileDisplay } from '../components/ProfileDisplay';
import { QrCodeIcon } from '../components/icons/QrCodeIcon';

interface AccessControlProps {
    userLocation: string | null;
}

const AnalyticsCard: React.FC<{ title: string; value: number | null; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-white rounded-lg shadow p-4 flex items-center space-x-4">
        <div className="bg-sky-100 p-3 rounded-lg">
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            {value === null ? (
                <SpinnerIcon className="w-6 h-6 text-slate-400 mt-1" />
            ) : (
                <p className="text-3xl font-bold text-slate-800">{value}</p>
            )}
        </div>
    </div>
);


export const AccessControl: React.FC<AccessControlProps> = ({ userLocation }) => {
    const { session } = useAuth();
    const [sheetId, setSheetId] = useState('');
    const [foundPerson, setFoundPerson] = useState<Person | null>(null);
    const [recentLogs, setRecentLogs] = useState<AccessLog[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [isLogging, setIsLogging] = useState(false);
    const [successLog, setSuccessLog] = useState<{ personId: number; direction: 'entry' | 'exit' } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lookupError, setLookupError] = useState<string | null>(null);
    const [newLogIds, setNewLogIds] = useState<Set<number>>(new Set());
    
    const sessionRef = useRef(session);
    sessionRef.current = session;
    const inputRef = useRef<HTMLInputElement>(null);
    
    const fetchLiveData = useCallback(async () => {
        const accessToken = sessionRef.current?.access_token;
        if (!accessToken) return;
        try {
            const [logs, analyticsData] = await Promise.all([
                getRecentLogs(accessToken),
                getAnalytics(accessToken)
            ]);

            setRecentLogs(prevLogs => {
                const prevLogIds = new Set(prevLogs.map(l => l.id));
                const newlyAddedLogs = logs.filter(l => !prevLogIds.has(l.id));
                if (newlyAddedLogs.length > 0) {
                    const newIds = new Set(newlyAddedLogs.map(l => l.id));
                    setNewLogIds(newIds);
                    setTimeout(() => setNewLogIds(new Set()), 3000); // Highlight for 3 seconds
                }
                return logs;
            });
            setAnalytics(analyticsData);
        } catch (err) {
            console.error("Failed to fetch live data", err);
            setError('Could not refresh live activity feed.');
        }
    }, []);

    useEffect(() => {
        fetchLiveData();
        const interval = setInterval(fetchLiveData, 10000); // Poll every 10 seconds
        return () => clearInterval(interval);
    }, [fetchLiveData]);

    useEffect(() => {
        // Auto-focus the input field on page load for quick scanning
        inputRef.current?.focus();
    }, []);

    const resetLookup = () => {
        setFoundPerson(null);
        setSheetId('');
        setLookupError(null);
        inputRef.current?.focus();
    };

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        const accessToken = sessionRef.current?.access_token;
        if (!accessToken || !sheetId.trim()) return;

        setIsLookingUp(true);
        setLookupError(null);
        setFoundPerson(null);

        try {
            const person = await getPersonBySheetId(accessToken, sheetId.trim());
            if (person) {
                setFoundPerson(person);
            } else {
                setLookupError(`No profile found for ID: ${sheetId.trim()}`);
                setTimeout(() => resetLookup(), 3000);
            }
        } catch (err: any) {
            setLookupError(`Error finding profile: ${err.message}`);
            setTimeout(() => resetLookup(), 4000);
        } finally {
            setIsLookingUp(false);
        }
    };
    
    const handleLog = async (personId: number, direction: 'entry' | 'exit') => {
        const accessToken = sessionRef.current?.access_token;
        if (!accessToken) return;

        if (!userLocation) {
            setError("Your location is not set. Please log out and log back in to set your location.");
            return;
        }

        setIsLogging(true);
        setError(null);
        try {
            await logAccess(accessToken, personId, direction, userLocation);
            setSuccessLog({ personId, direction });
            setTimeout(() => {
                setSuccessLog(null);
                resetLookup();
            }, 1500);
            fetchLiveData(); // Immediately refresh data after logging
        } catch (err: any) {
            setError(`Failed to log ${direction}: ${err.message}`);
        } finally {
            setIsLogging(false);
        }
    };
    
    const LogEntry: React.FC<{ log: AccessLog }> = ({ log }) => {
        const isEntry = log.direction === 'entry';
        const isNew = newLogIds.has(log.id);
        
        return (
            <li className={`flex items-center space-x-4 p-3 bg-white rounded-lg shadow-sm transition-colors duration-1000 ${isNew ? 'bg-sky-50' : ''}`}>
                <img src={log.person.image} alt="person" className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{log.person.firstName} {log.person.lastName}</p>
                    <p className="text-xs text-slate-500">
                        Logged <span className={`font-bold ${isEntry ? 'text-emerald-600' : 'text-amber-600'}`}>{log.direction}</span> at <strong className="text-slate-600">{log.location}</strong> by {log.recorder.email}
                    </p>
                </div>
                <div className="text-right">
                    <p className={`text-sm font-medium ${isEntry ? 'text-emerald-600' : 'text-amber-600'}`}>{isEntry ? 'Entered' : 'Exited'}</p>
                    <p className="text-xs text-slate-400">{new Date(log.created_at).toLocaleTimeString()}</p>
                </div>
            </li>
        );
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 min-h-full">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-800">Access Control Dashboard</h2>
                    <p className="mt-1 text-slate-500">Log campus entries and exits and monitor live activity.</p>
                </div>
                
                <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <AnalyticsCard title="Parents On Campus" value={analytics ? analytics.on_campus : null} icon={<BuildingOfficeIcon className="w-6 h-6 text-sky-600" />} />
                    <AnalyticsCard title="Parent Entries Today" value={analytics ? analytics.entries_today : null} icon={<ArrowRightIcon className="w-6 h-6 text-emerald-600" />} />
                    <AnalyticsCard title="Parent Exits Today" value={analytics ? analytics.exits_today : null} icon={<ArrowLeftIcon className="w-6 h-6 text-amber-600" />} />
                </div>


                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <div className="p-6 bg-white rounded-lg shadow-md">
                            <h3 className="text-lg font-medium leading-6 text-slate-900 mb-4">Scan or Enter ID</h3>
                             <form onSubmit={handleLookup}>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><QrCodeIcon className="text-slate-400" /></div>
                                    <input 
                                        ref={inputRef}
                                        type="text" 
                                        placeholder="Scan barcode or enter ID (e.g., GS-12345)" 
                                        value={sheetId} 
                                        onChange={(e) => setSheetId(e.target.value)} 
                                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg shadow-sm text-lg focus:outline-none focus:ring-2 focus:ring-sky-500" 
                                    />
                                </div>
                             </form>

                            <div className="mt-6 flex items-center justify-center min-h-[350px] bg-slate-50 rounded-lg p-4">
                                {isLookingUp ? (
                                    <SpinnerIcon className="w-12 h-12 text-sky-600" />
                                ) : lookupError ? (
                                    <div className="text-center">
                                        <XCircleIcon className="w-12 h-12 text-red-500 mx-auto" />
                                        <p className="mt-2 font-semibold text-red-600">{lookupError}</p>
                                    </div>
                                ) : foundPerson ? (
                                    <ProfileDisplay 
                                        person={foundPerson} 
                                        userLocation={userLocation}
                                        isLogging={isLogging}
                                        successLog={successLog}
                                        onLog={handleLog}
                                    />
                                ) : (
                                    <p className="text-slate-500">Awaiting ID scan...</p>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-1">
                         <div className="p-6 bg-white rounded-lg shadow-md">
                             <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium leading-6 text-slate-900">Recent Activity</h3>
                                <span className="flex items-center text-xs font-medium text-emerald-600">
                                    <span className="relative flex h-2 w-2 mr-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    Live
                                </span>
                            </div>
                             {recentLogs.length > 0 ? (
                                <ul className="space-y-3 max-h-[30rem] overflow-y-auto">
                                    {recentLogs.map(log => <LogEntry key={log.id} log={log} />)}
                                </ul>
                             ) : (
                                <p className="text-center text-slate-500 py-4">No recent activity.</p>
                             )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};