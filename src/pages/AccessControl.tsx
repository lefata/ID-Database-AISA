import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPeople, logAccess, getRecentLogs, getAnalytics } from '../services/apiService';
import { Person, AccessLog, AnalyticsData } from '../types';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import { SearchIcon } from '../components/icons/SearchIcon';
import { ArrowRightIcon } from '../components/icons/ArrowRightIcon';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { XCircleIcon } from '../components/icons/XCircleIcon';
import { BuildingOfficeIcon } from '../components/icons/BuildingOfficeIcon';
import { LocationMarkerIcon } from '../components/icons/LocationMarkerIcon';

const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: Parameters<F>): void => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), waitFor);
    };
};

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
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Person[]>([]);
    const [recentLogs, setRecentLogs] = useState<AccessLog[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isLogging, setIsLogging] = useState<number | null>(null);
    const [successLog, setSuccessLog] = useState<{ personId: number; direction: 'entry' | 'exit' } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [newLogIds, setNewLogIds] = useState<Set<number>>(new Set());
    
    const sessionRef = useRef(session);
    sessionRef.current = session;
    
    const fetchData = useCallback(async () => {
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
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Poll every 10 seconds
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleSearch = useCallback(async (term: string) => {
        const accessToken = sessionRef.current?.access_token;
        if (!accessToken || term.length < 2) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        try {
            const { people } = await getPeople(accessToken, 1, 10, term);
            setSearchResults(people);
        } catch (err) {
            setError('Failed to search for people.');
        } finally {
            setIsSearching(false);
        }
    }, []);
    
    const debouncedSearch = useCallback(debounce(handleSearch, 300), [handleSearch]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (term.length > 1) {
            setIsSearching(true);
            debouncedSearch(term);
        } else {
            setIsSearching(false);
            setSearchResults([]);
        }
    };
    
    const handleLog = async (personId: number, direction: 'entry' | 'exit') => {
        const accessToken = sessionRef.current?.access_token;
        if (!accessToken) return;

        if (!userLocation) {
            setError("Your location is not set. Please log out and log back in to set your location.");
            return;
        }

        setIsLogging(personId);
        setError(null);
        try {
            await logAccess(accessToken, personId, direction, userLocation);
            setSuccessLog({ personId, direction });
            setTimeout(() => setSuccessLog(null), 2000);
            fetchData(); // Immediately refresh data after logging
        } catch (err: any) {
            if (err.message && (err.message.includes("Could not find the table") || err.message.includes("does not exist")) && err.message.toLowerCase().includes("access_logs")) {
                setError(`Database Error: The access log table is missing. An administrator must go to the Admin Dashboard and run the "Verify & Repair Database" tool.`);
            } else {
                setError(`Failed to log ${direction}: ${err.message}`);
            }
        } finally {
            setIsLogging(null);
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

                {error && (
                    <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <XCircleIcon className="h-5 w-5 text-red-400" />
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <AnalyticsCard title="Parents On Campus" value={analytics ? analytics.on_campus : null} icon={<BuildingOfficeIcon className="w-6 h-6 text-sky-600" />} />
                    <AnalyticsCard title="Parent Entries Today" value={analytics ? analytics.entries_today : null} icon={<ArrowRightIcon className="w-6 h-6 text-emerald-600" />} />
                    <AnalyticsCard title="Parent Exits Today" value={analytics ? analytics.exits_today : null} icon={<ArrowLeftIcon className="w-6 h-6 text-amber-600" />} />
                </div>


                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <div className="p-6 bg-white rounded-lg shadow-md">
                            <h3 className="text-lg font-medium leading-6 text-slate-900 mb-4">Log Person</h3>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon className="text-slate-400" /></div>
                                <input type="text" placeholder="Search by name..." value={searchTerm} onChange={handleSearchChange} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                                {isSearching && <SpinnerIcon className="absolute right-3 top-3 w-5 h-5 text-slate-400" />}
                            </div>

                            <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
                                {searchResults.map(person => (
                                    <div key={person.id} className="p-4 bg-slate-50 rounded-lg border flex items-center justify-between space-x-4">
                                        <div className="flex items-center space-x-4 flex-1">
                                            <img src={person.image} alt="profile" className="w-16 h-16 rounded-full object-cover" />
                                            <div>
                                                <p className="font-bold text-slate-800">{person.firstName} {person.lastName}</p>
                                                <p className="text-sm text-slate-500">{person.category} - {person.role || person.class}</p>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            {isLogging === person.id ? <SpinnerIcon className="w-6 h-6 text-sky-600" /> : successLog?.personId === person.id ? (
                                                <p className={`font-bold text-lg ${successLog.direction === 'entry' ? 'text-emerald-500' : 'text-amber-500'}`}>{successLog.direction === 'entry' ? 'Entered!' : 'Exited!'}</p>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleLog(person.id, 'entry')} className="flex items-center justify-center space-x-2 w-32 px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-600 transition">
                                                        <ArrowRightIcon /><span>Log Entry</span>
                                                    </button>
                                                    <button onClick={() => handleLog(person.id, 'exit')} className="flex items-center justify-center space-x-2 w-32 px-4 py-2 bg-amber-500 text-white font-semibold rounded-lg shadow-md hover:bg-amber-600 transition">
                                                        <ArrowLeftIcon /><span>Log Exit</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {!isSearching && searchTerm.length > 1 && searchResults.length === 0 && (
                                    <p className="text-center text-slate-500 py-4">No results found.</p>
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
