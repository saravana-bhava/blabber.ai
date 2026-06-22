'use client';

import { createContext, useContext, useState } from 'react';

interface CreditsModalContextType {
  isBuyCreditsModalOpen: boolean;
  setIsBuyCreditsModalOpen: (isOpen: boolean) => void;
}

const CreditsModalContext = createContext<CreditsModalContextType>({
  isBuyCreditsModalOpen: false,
  setIsBuyCreditsModalOpen: () => {},
});

export function CreditsModalProvider({ children }: { children: React.ReactNode }) {
  const [isBuyCreditsModalOpen, setIsBuyCreditsModalOpen] = useState(false);

  return (
    <CreditsModalContext.Provider
      value={{
        isBuyCreditsModalOpen,
        setIsBuyCreditsModalOpen,
      }}
    >
      {children}
    </CreditsModalContext.Provider>
  );
}

export const useCreditsModal = () => {
  const context = useContext(CreditsModalContext);
  if (context === undefined) {
    throw new Error('useCreditsModal must be used within a CreditsModalProvider');
  }
  return context;
}; 