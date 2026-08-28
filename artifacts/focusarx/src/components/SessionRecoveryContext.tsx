
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SessionRecoveryContextValue = {
  recoverMonitor: boolean;
  requestMonitorRecovery: () => void;
  clearMonitorRecovery: () => void;
  monitorEnabled: boolean;
  setMonitorEnabled: (enabled: boolean) => void;
};

const SessionRecoveryContext = createContext<SessionRecoveryContextValue | null>(
  null
);

export function SessionRecoveryProvider({ children }: { children: ReactNode }) {
  const [recoverMonitor, setRecoverMonitor] = useState(false);
  const [monitorEnabled, setMonitorEnabled] = useState(false);

  const requestMonitorRecovery = useCallback(() => setRecoverMonitor(true), []);
  const clearMonitorRecovery = useCallback(() => setRecoverMonitor(false), []);

  const value = useMemo(
    () => ({
      recoverMonitor,
      requestMonitorRecovery,
      clearMonitorRecovery,
      monitorEnabled,
      setMonitorEnabled,
    }),
    [
      recoverMonitor,
      requestMonitorRecovery,
      clearMonitorRecovery,
      monitorEnabled,
    ]
  );

  return (
    <SessionRecoveryContext.Provider value={value}>
      {children}
    </SessionRecoveryContext.Provider>
  );
}

export function useSessionRecovery() {
  const ctx = useContext(SessionRecoveryContext);
  if (!ctx) {
    throw new Error("useSessionRecovery must be used within SessionRecoveryProvider");
  }
  return ctx;
}
