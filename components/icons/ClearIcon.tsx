import React from 'react';

const ClearIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12 12 14.25m-2.58 4.92L9.75 12M9.75 12 7.5 14.25m2.25-2.25 2.25-2.25M12 9.75 9.75 7.5m2.25 2.25L14.25 7.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
  </svg>
);

export default ClearIcon;
