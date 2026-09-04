/**
 * FocusArx Integration Hooks - Phase 6
 * React hooks for managing external integrations
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  integrationEngine,
  type IntegrationType,
  type IntegrationConfig,
  type ConnectedIntegration,
  type SyncEvent,
  type IntegrationHealth,
  type WebhookPayload
} from '../services/integrations/IntegrationEngine';

// ==================== useIntegrations Hook ====================

export function useIntegrations() {
  const [available, setAvailable] = useState<IntegrationConfig[]>([]);
  const [connected, setConnected] = useState<ConnectedIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load available integrations
  useEffect(() => {
    try {
      const integrations = integrationEngine.getAvailableIntegrations();
      setAvailable(integrations);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load connected integrations
  const loadConnected = useCallback(() => {
    const connections = integrationEngine.getAllConnections();
    setConnected(connections);
  }, []);

  // Connect to an integration
  const connect = useCallback(async (
    integrationId: string,
    credentials?: any,
    settings?: Record<string, any>
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      await integrationEngine.connect(integrationId, credentials, settings);
      loadConnected();
      
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadConnected]);

  // Disconnect from an integration
  const disconnect = useCallback(async (integrationId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      await integrationEngine.disconnect(integrationId);
      loadConnected();
      
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadConnected]);

  // Trigger sync
  const sync = useCallback(async (integrationId: string, direction?: 'push' | 'pull' | 'bidirectional') => {
    try {
      setError(null);
      const result = await integrationEngine.sync(integrationId, direction);
      loadConnected();
      return result;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [loadConnected]);

  // Test health
  const testHealth = useCallback(async (integrationId: string): Promise<IntegrationHealth> => {
    return await integrationEngine.testHealth(integrationId);
  }, []);

  // Get integration by ID
  const getIntegration = useCallback((id: string): IntegrationConfig | undefined => {
    return integrationEngine.getIntegration(id);
  }, []);

  // Get connection by ID
  const getConnection = useCallback((id: string): ConnectedIntegration | undefined => {
    return integrationEngine.getConnection(id);
  }, []);

  // Filter by type
  const getByType = useCallback((type: IntegrationType): IntegrationConfig[] => {
    return integrationEngine.getAvailableIntegrations(type);
  }, []);

  // Get sync history
  const getSyncHistory = useCallback((integrationId?: string, limit?: number): SyncEvent[] => {
    return integrationEngine.getSyncHistory(integrationId, limit);
  }, []);

  return {
    available,
    connected,
    loading,
    error,
    connect,
    disconnect,
    sync,
    testHealth,
    getIntegration,
    getConnection,
    getByType,
    getSyncHistory,
    refresh: loadConnected
  };
}

// ==================== useIntegrationConnection Hook ====================

export function useIntegrationConnection(integrationId: string) {
  const [connection, setConnection] = useState<ConnectedIntegration | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const conn = integrationEngine.getConnection(integrationId);
    setConnection(conn);
    setLoading(false);
  }, [integrationId]);

  const connect = useCallback(async (credentials?: any, settings?: Record<string, any>) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await integrationEngine.connect(integrationId, credentials, settings);
      setConnection(result);
      
      return result;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [integrationId]);

  const disconnect = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      await integrationEngine.disconnect(integrationId);
      setConnection(undefined);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [integrationId]);

  const sync = useCallback(async (direction?: 'push' | 'pull' | 'bidirectional') => {
    return await integrationEngine.sync(integrationId, direction);
  }, [integrationId]);

  const testHealth = useCallback(async (): Promise<IntegrationHealth> => {
    return await integrationEngine.testHealth(integrationId);
  }, [integrationId]);

  return {
    connection,
    loading,
    error,
    connect,
    disconnect,
    sync,
    testHealth
  };
}

// ==================== useIntegrationSync Hook ====================

interface UseIntegrationSyncOptions {
  autoSync?: boolean;
  syncInterval?: number;
  onSyncComplete?: (event: SyncEvent) => void;
  onSyncError?: (error: Error) => void;
}

export function useIntegrationSync(
  integrationId: string,
  options: UseIntegrationSyncOptions = {}
) {
  const {
    autoSync = false,
    syncInterval = 300000, // 5 minutes
    onSyncComplete,
    onSyncError
  } = options;

  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | undefined>();
  const [history, setHistory] = useState<SyncEvent[]>([]);

  const triggerSync = useCallback(async (direction?: 'push' | 'pull' | 'bidirectional') => {
    if (syncing) return;

    try {
      setSyncing(true);
      
      const event = await integrationEngine.sync(integrationId, direction);
      setHistory(prev => [event, ...prev].slice(0, 50));
      
      if (event.status === 'success') {
        setLastSync(new Date());
        onSyncComplete?.(event);
      } else {
        onSyncError?.(new Error(event.error || 'Sync failed'));
      }
      
      return event;
    } catch (err) {
      onSyncError?.(err as Error);
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [integrationId, syncing, onSyncComplete, onSyncError]);

  // Auto-sync effect
  useEffect(() => {
    if (!autoSync) return;

    const interval = setInterval(() => {
      triggerSync('bidirectional').catch(console.error);
    }, syncInterval);

    return () => clearInterval(interval);
  }, [autoSync, syncInterval, triggerSync]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    syncing,
    lastSync,
    history,
    triggerSync,
    clearHistory
  };
}

// ==================== useWebhook Handler Hook ====================

export function useWebhookHandler(
  integrationId: string,
  handler: (payload: WebhookPayload) => Promise<void>
) {
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    integrationEngine.registerWebhookHandler(integrationId, handler);
    setRegistered(true);

    return () => {
      // Cleanup if needed
      setRegistered(false);
    };
  }, [integrationId, handler]);

  const processWebhook = useCallback(async (payload: WebhookPayload) => {
    return await integrationEngine.processWebhook(integrationId, payload);
  }, [integrationId]);

  return {
    registered,
    processWebhook
  };
}

// ==================== Export All Hooks ====================

export default {
  useIntegrations,
  useIntegrationConnection,
  useIntegrationSync,
  useWebhookHandler
};
