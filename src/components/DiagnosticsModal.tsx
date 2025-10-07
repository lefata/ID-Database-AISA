import React, { useState } from 'react';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { ExclamationIcon } from './icons/ExclamationIcon';
import { runPublicDiagnostics } from '../services/apiService';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LogEntry {
  step: string;
  command: string;
  status: 'success' | 'failure' | 'warning';
  details: string;
}

const StatusIcon: React.FC<{ status: LogEntry['status'] }> = ({ status }) => {
    switch (status) {
        case 'success':
            return <CheckCircleIcon className="w-5 h-5 text-emerald-500 flex-shrink-0" />;
        case 'failure':
            return <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />;
        case 'warning':
            return <ExclamationIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />;
        default:
            return null;
    }
};

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleRunDiagnostics = async () => {
        setIsLoading(true);
        setError(null);
        setLogs([]);
        try {
            const data = await runPublicDiagnostics();
            if (data.logs && Array.isArray(data.logs)) {
                setLogs(data.logs);
            } else {
                throw new Error("Invalid response format from diagnostics API. Expected a 'logs' array.");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale">
                <div className="p-6 border-b">
                    <h3 className="text-xl leading-6 font-bold text-slate-900" id="modal-title">Connection Diagnostics</h3>
                     <p className="mt-1 text-sm text-slate-500">
                        Check the status of the connection to the application services and verify database schema.
                    </p>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {!logs.length && !isLoading && !error && (
                        <div className="text-center py-8">
                            <p className="text-slate-600">Click "Run Diagnostics" to check the system status.</p>
                        </div>
                    )}
                    {isLoading && (
                         <div className="flex flex-col justify-center items-center py-8 space-y-3">
                            <SpinnerIcon className="w-8 h-8 text-sky-600" />
                            <p className="text-slate-600">Running diagnostics...</p>
                        </div>
                    )}
                    {error && <p className="text-sm text-red-600 text-center py-8">{error}</p>}
                    {logs.length > 0 && (
                         <div className="space-y-4">
                            {logs.map((log, index) => (
                                <div key={index} className="flex items-start space-x-3">
                                    <StatusIcon status={log.status} />
                                    <div className="flex-1">
                                        <p className="font-semibold text-slate-800 text-sm">{log.step}</p>
                                        <code className="mt-1 text-xs bg-slate-100 p-2 rounded-md block font-mono text-slate-700 break-all">
                                            {log.command}
                                        </code>
                                        <p className="mt-2 text-sm text-slate-600">
                                            {log.details}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="bg-slate-50 px-4 py-3 sm:px-6 flex justify-between items-center rounded-b-lg">
                    <button
                        type="button"
                        className="w-36 inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-sky-600 text-base font-medium text-white hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 sm:text-sm disabled:bg-sky-400"
                        onClick={handleRunDiagnostics}
                        disabled={isLoading}
                    >
                        {isLoading ? <SpinnerIcon /> : 'Run Diagnostics'}
                    </button>
                    <button
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 sm:mt-0 sm:w-auto sm:text-sm"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
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