import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CogIcon } from './icons/CogIcon';
import { ClipboardListIcon } from './icons/ClipboardListIcon';
import { LocationMarkerIcon } from './icons/LocationMarkerIcon';

type View = 'repository' | 'add' | 'admin' | 'access_control';

interface HeaderProps {
    currentView: View;
    onViewChange: (view: View) => void;
    isAdmin: boolean;
    isSecurity: boolean;
    userLocation: string | null;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onViewChange, isAdmin, isSecurity, userLocation }) => {
    const { user, logout } = useAuth();
    const activeClass = "bg-sky-600 text-white";
    const inactiveClass = "bg-white text-slate-600 hover:bg-slate-100";

    return (
        <header className="bg-white shadow-md">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <div className="bg-sky-500 p-2 rounded-lg">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 012-2h2a2 2 0 012 2v1m-4 0h4" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Synergy ID Repository</h1>
                </div>
                <div className="flex items-center space-x-4">
                    {userLocation && (
                         <div className="flex items-center space-x-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                            <LocationMarkerIcon className="w-4 h-4 text-slate-500" />
                            <span>Location: <strong>{userLocation}</strong></span>
                        </div>
                    )}
                    <nav className="flex space-x-1 bg-slate-200 p-1 rounded-lg">
                        <button
                            onClick={() => onViewChange('repository')}
                            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${currentView === 'repository' ? activeClass : inactiveClass}`}
                        >
                            Repository
                        </button>
                        <button
                            onClick={() => onViewChange('add')}
                            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${currentView === 'add' ? activeClass : inactiveClass}`}
                        >
                            Add New
                        </button>
                        {(isAdmin || isSecurity) && (
                            <button
                                onClick={() => onViewChange('access_control')}
                                className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 flex items-center space-x-2 ${currentView === 'access_control' ? activeClass : inactiveClass}`}
                            >
                                <ClipboardListIcon className="w-4 h-4" />
                                <span>Access Control</span>
                            </button>
                        )}
                        {isAdmin && (
                            <button
                                onClick={() => onViewChange('admin')}
                                className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 flex items-center space-x-2 ${currentView === 'admin' ? activeClass : inactiveClass}`}
                            >
                                <CogIcon className="w-4 h-4" />
                                <span>Admin</span>
                            </button>
                        )}
                    </nav>
                    <div className="flex items-center space-x-3 pl-3 border-l border-slate-300">
                        <span className="text-sm text-slate-600">{user?.email}</span>
                        <button onClick={logout} className="text-sm font-medium text-sky-600 hover:text-sky-800">Logout</button>
                    </div>
                </div>
            </div>
        </header>
    );
};
