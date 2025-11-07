
import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="flex flex-col justify-center items-center p-10 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-gray-600">جاري التحميل...</p>
    </div>
  );
};

export default Spinner;
