import React from 'react';

export const QrCodeIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6.5 6.5v.01M4 12H2m15.5 6.5v.01M4 19.5v.01M4 4h1.5v1.5H4V4zm4 0h1.5v1.5H8V4zm4 0h1.5v1.5H12V4zm4 0h1.5v1.5H16V4zm4 0h1.5v1.5H20V4zm-8 4h1.5v1.5H12V8zm-4 4H6.5V10.5H8V12zm0 4H6.5V14.5H8V16zm0-8H6.5V6.5H8V8zm4 0h1.5v1.5H12V8zm4-4h1.5v1.5H16V4zm0 4h1.5v1.5H16V8zm0 4h1.5v1.5H16V12zm-4 4h1.5v1.5H12V16zm-4 0h1.5v1.5H8V16zm8 0h1.5v1.5H16V16zm4 0h1.5v1.5H20V16zm0-4h1.5v1.5H20V12zm0-4h1.5v1.5H20V8z" />
    </svg>
);