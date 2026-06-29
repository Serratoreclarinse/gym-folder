import { createContext, useContext } from 'react';
import { useActiveSession } from '@/hooks/useActiveSession';

type Value = ReturnType<typeof useActiveSession>;

const Ctx = createContext<Value | null>(null);

export function ActiveSessionProvider({ children }: { children: React.ReactNode }) {
  const value = useActiveSession();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveSessionContext(): Value {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useActiveSessionContext must be inside ActiveSessionProvider');
  return ctx;
}
