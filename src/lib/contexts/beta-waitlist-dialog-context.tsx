"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type BetaWaitlistDialogContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (next: boolean) => void;
};

const BetaWaitlistDialogContext =
  createContext<BetaWaitlistDialogContextValue | null>(null);

export function BetaWaitlistDialogProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, open, close, setOpen: setIsOpen }),
    [isOpen, open, close]
  );

  return (
    <BetaWaitlistDialogContext.Provider value={value}>
      {children}
    </BetaWaitlistDialogContext.Provider>
  );
}

/**
 * Returns the context, or `null` when a CTA is rendered outside the provider
 * (e.g. when the beta dialog isn't mounted on a particular page). Components
 * should fall back to a regular link in that case.
 */
export function useBetaWaitlistDialog(): BetaWaitlistDialogContextValue | null {
  return useContext(BetaWaitlistDialogContext);
}
