"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

const BetaModeContext = createContext(false);

export function BetaModeProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  return (
    <BetaModeContext.Provider value={value}>
      {children}
    </BetaModeContext.Provider>
  );
}

export function useBetaMode() {
  return useContext(BetaModeContext);
}
