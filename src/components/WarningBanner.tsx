import React from 'react';
import { ExclamationIcon } from './icons/ExclamationIcon';

interface WarningBannerProps {
  warnings: string[];
  onDismiss: () => void;
}

export const WarningBanner: React.FC<WarningBannerProps> = ({ warnings, onDismiss }) => {
  if (!warnings || warnings.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-24 right-8 z-50 max-w-md w-full animate-fade-in-down">
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 shadow-lg rounded-r-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <ExclamationIcon className="h-5 w-5 text-amber-400" />
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-bold text-amber-900">
              Profile Created with Warnings
            </p>
            <div className="mt-2 text-sm text-amber-800">
              <ul className="list-disc pl-5 space-y-1">
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="ml-4 flex-shrink-0">
             <button
                onClick={onDismiss}
                className="-mx-1.5 -my-1.5 bg-amber-50 rounded-md p-1.5 text-amber-500 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-amber-50 focus:ring-amber-600"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
          </div>
        </div>
      </div>
       <style>{`
          @keyframes fadeInDown {
              from { opacity: 0; transform: translateY(-20px); }
              to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-down {
              animation: fadeInDown 0.3s ease-out forwards;
          }
      `}</style>
    </div>
  );
};
