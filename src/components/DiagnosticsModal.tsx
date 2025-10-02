import React, { useState } from 'react';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
                {result.error && (
                    <pre className="mt-1 p-2 bg-slate-100 rounded-md text-xs text-slate-700 overflow-x-auto">
                        {JSON.stringify(result.error, null, 2)}
                    </pre>
                )}
            </div>
        </div>
    );
};


export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleRunDiagnostics = async () => {
        setIsLoading(true);
        setError(null);
        setResults(null);
        try {
            const response = await fetch('/api/public/diagnostics');
            if (!response.ok) {
                 let errorBody;
                try {
                    errorBody = await response.json();
                } catch (e) {
                    errorBody = { error: 'Failed to parse error response from server.' };
                }
                throw new Error(errorBody.error || `API responded with status ${response.status}`);
            }
            const data = await response.json();
            setResults(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale">
                <div className="p-6 border-b">
                    <h3 className="text-xl leading-6 font-bold text-slate-900" id="modal-title">Connection Diagnostics</h3>
                     <p className="mt-1 text-sm text-slate-500">
                        Check the status of the connection to the application services.
                    </p>
                </div>
                <div className="p-6">
                    {!results && !isLoading && !error && (
                        <div className="text-center">
                            <p className="text-slate-600">Click the button below to check the system status.</p>
                        </div>
                    )}
                    {isLoading && (
                         <div className="flex justify-center items-center py-8">
                            <SpinnerIcon className="w-8 h-8 text-sky-600" />
                        </div>
                    )}
                    {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                    {results && (
                         <div className="border-t pt-4">
                            <ResultDisplay title="API Server Status" result={results.apiStatus} />
                            <ResultDisplay title="Supabase Connection" result={results.supabaseConnection} />
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
