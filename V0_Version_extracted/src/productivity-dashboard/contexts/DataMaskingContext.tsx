// Data Masking Context
// Provides PII masking for recruiter names, candidate names, and HM names

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface DataMaskingContextValue {
    isMasked: boolean;
    toggleMasking: () => void;
    mask: (value: string, type?: 'name' | 'email' | 'id') => string;
}

const DataMaskingContext = createContext<DataMaskingContextValue | undefined>(undefined);

// Generate consistent pseudonym from original value
const generatePseudonym = (value: string, type: 'name' | 'email' | 'id' = 'name'): string => {
    // Simple hash for consistent masking
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }
    const num = Math.abs(hash % 1000);

    switch (type) {
        case 'name':
            return `Person_${num.toString().padStart(3, '0')}`;
        case 'email':
            return `user${num}@masked.example`;
        case 'id':
            return `ID_${num.toString().padStart(5, '0')}`;
        default:
            return `[MASKED]`;
    }
};

interface DataMaskingProviderProps {
    children: ReactNode;
}

export function DataMaskingProvider({ children }: DataMaskingProviderProps) {
    // Initialize from localStorage
    const [isMasked, setIsMasked] = useState(() => {
        const stored = localStorage.getItem('dataMaskingEnabled');
        return stored === 'true';
    });

    const toggleMasking = useCallback(() => {
        setIsMasked(prev => {
            const newValue = !prev;
            localStorage.setItem('dataMaskingEnabled', String(newValue));
            return newValue;
        });
    }, []);

    const mask = useCallback((value: string, type: 'name' | 'email' | 'id' = 'name'): string => {
        if (!isMasked || !value) return value;
        return generatePseudonym(value, type);
    }, [isMasked]);

    return (
        <DataMaskingContext.Provider value={{ isMasked, toggleMasking, mask }}>
            {children}
        </DataMaskingContext.Provider>
    );
}

export function useDataMasking(): DataMaskingContextValue {
    const context = useContext(DataMaskingContext);
    if (!context) {
        throw new Error('useDataMasking must be used within a DataMaskingProvider');
    }
    return context;
}

// Convenience hook that just returns the mask function
export function useMask() {
    const { mask, isMasked } = useDataMasking();
    return { mask, isMasked };
}
