
import React from 'react';

interface MergeTagProps {
  label: string;
  type: 'person' | 'company';
}

const MergeTag: React.FC<MergeTagProps> = ({ label, type }) => {
  const isPerson = type === 'person';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium text-xs mx-0.5 ${
      isPerson 
      ? 'bg-blue-50 text-blue-600 border border-blue-100' 
      : 'bg-yellow-50 text-yellow-700 border border-yellow-100'
    }`}>
      {label}
    </span>
  );
};

export default MergeTag;
