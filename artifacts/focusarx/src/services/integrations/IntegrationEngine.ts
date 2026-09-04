/**
 * FocusArx Integration Engine - Phase 6
 * Universal adapter pattern for connecting external productivity tools
 * 
 * Features:
 * - OAuth2 & API Key authentication
 * - Bi-directional sync for tasks, events, messages
 * - Smart conflict resolution
 * - Real-time webhooks
 * - Health monitoring
 */

// ==================== Types & Interfaces ====================

export type IntegrationType = 
  | 'communication'
  | 'calendar'
  | 'project_management'
  | 'task_management'
  | 'developer_tools'
  | 'cloud_storage'
  | 'automation'
  | 'crm';

export type SyncDirection = 'push' | 'pull' | 'bidirectional';

export type ConnectionStatus = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'expired';

export interface IntegrationConfig {
  id: string;
  name: string;
  type: IntegrationType;
  icon: string;
  description: string;
  authType: 'oauth2' | 'api_key' | 'webhook';
  authUrl?: string;
  scopes?: string[];
  endpoints: {
    connect: string;
    disconnect: string;
    sync?: string;
    webhook?: string;
  };
  settings: IntegrationSetting[];
  capabilities: IntegrationCapability[];
}

export interface IntegrationSetting {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'boolean' | 'number';
  required: boolean;
  defaultValue?: any;
  options?: { value: string; label: string }[];
  validation?: RegExp;
}

export interface IntegrationCapability {
  action: 'create' | 'read' | 'update' | 'delete';
  resource: 'task' | 'event' | 'message' | 'file' | 'contact';
  mapping: Record<string, string>;
}

export interface ConnectedIntegration {
  config: IntegrationConfig;
  status: ConnectionStatus;
  connectedAt?: Date;
  expiresAt?: Date;
  lastSyncAt?: Date;
  syncDirection: SyncDirection;
  credentials?: {
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    webhookSecret?: string;
  };
  settings: Record<string, any>;
  health: IntegrationHealth;
}

export interface IntegrationHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  latency: number;
  successRate: number;
  errorCount: number;
  message?: string;
}

export interface SyncEvent {
  id: string;
  integrationId: string;
  direction: SyncDirection;
  resource: string;
  action: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: Date;
  data?: any;
  error?: string;
}

export interface WebhookPayload {
  event: string;
  resource: string;
  data: any;
  timestamp: Date;
  signature: string;
}

// ==================== Integration Registry ====================

const INTEGRATION_REGISTRY: IntegrationConfig[] = [
  // Communication
  {
    id: 'slack',
    name: 'Slack',
    type: 'communication',
    icon: 'slack',
    description: 'Connect Slack channels for focus notifications and team updates',
    authType: 'oauth2',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    scopes: ['chat:write', 'channels:read', 'users:read'],
    endpoints: {
      connect: '/api/integrations/slack/connect',
      disconnect: '/api/integrations/slack/disconnect',
      sync: '/api/integrations/slack/sync',
      webhook: '/api/webhooks/slack'
    },
    settings: [
      { key: 'channel', label: 'Default Channel', type: 'text', required: false },
      { key: 'notifyOnBreak', label: 'Notify on Break', type: 'boolean', required: false, defaultValue: true },
      { key: 'dailyReport', label: 'Send Daily Report', type: 'boolean', required: false, defaultValue: false }
    ],
    capabilities: [
      { action: 'create', resource: 'message', mapping: { text: 'content', channel: 'target' } }
    ]
  },
  {
    id: 'microsoft-teams',
    name: 'Microsoft Teams',
    type: 'communication',
    icon: 'teams',
    description: 'Integrate with Teams for meetings and collaboration',
    authType: 'oauth2',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    scopes: ['Chat.ReadWrite', 'ChannelMessage.Send'],
    endpoints: {
      connect: '/api/integrations/teams/connect',
      disconnect: '/api/integrations/teams/disconnect'
    },
    settings: [],
    capabilities: []
  },
  {
    id: 'discord',
    name: 'Discord',
    type: 'communication',
    icon: 'discord',
    description: 'Connect Discord servers for community focus sessions',
    authType: 'oauth2',
    authUrl: 'https://discord.com/api/oauth2/authorize',
    scopes: ['identify', 'guilds', 'bot'],
    endpoints: {
      connect: '/api/integrations/discord/connect',
      disconnect: '/api/integrations/discord/disconnect'
    },
    settings: [],
    capabilities: []
  },

  // Calendar
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    type: 'calendar',
    icon: 'google-calendar',
    description: 'Sync focus sessions with Google Calendar events',
    authType: 'oauth2',
    authUrl: 'https://accounts.google.com/o/oauth2/auth',
    scopes: ['calendar.events', 'calendar.readonly'],
    endpoints: {
      connect: '/api/integrations/google-calendar/connect',
      disconnect: '/api/integrations/google-calendar/disconnect',
      sync: '/api/integrations/google-calendar/sync',
      webhook: '/api/webhooks/google-calendar'
    },
    settings: [
      { key: 'calendarId', label: 'Calendar ID', type: 'text', required: false },
      { key: 'autoBlock', label: 'Auto-block Focus Time', type: 'boolean', required: false, defaultValue: true },
      { key: 'bufferTime', label: 'Buffer Time (min)', type: 'number', required: false, defaultValue: 5 }
    ],
    capabilities: [
      { action: 'create', resource: 'event', mapping: { summary: 'title', start: 'startTime', end: 'endTime' } },
      { action: 'read', resource: 'event', mapping: {} }
    ]
  },
  {
    id: 'outlook-calendar',
    name: 'Outlook Calendar',
    type: 'calendar',
    icon: 'outlook',
    description: 'Sync with Microsoft Outlook Calendar',
    authType: 'oauth2',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    scopes: ['Calendars.ReadWrite', 'Calendars.Read'],
    endpoints: {
      connect: '/api/integrations/outlook/connect',
      disconnect: '/api/integrations/outlook/disconnect'
    },
    settings: [],
    capabilities: []
  },

  // Project Management
  {
    id: 'jira',
    name: 'Jira',
    type: 'project_management',
    icon: 'jira',
    description: 'Track Jira issues during focus sessions',
    authType: 'api_key',
    endpoints: {
      connect: '/api/integrations/jira/connect',
      disconnect: '/api/integrations/jira/disconnect',
      sync: '/api/integrations/jira/sync'
    },
    settings: [
      { key: 'domain', label: 'Jira Domain', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'apiKey', label: 'API Token', type: 'password', required: true },
      { key: 'projectKey', label: 'Project Key', type: 'text', required: false }
    ],
    capabilities: [
      { action: 'read', resource: 'task', mapping: { key: 'id', summary: 'title', status: 'state' } },
      { action: 'update', resource: 'task', mapping: {} }
    ]
  },
  {
    id: 'trello',
    name: 'Trello',
    type: 'project_management',
    icon: 'trello',
    description: 'Move Trello cards through focus sessions',
    authType: 'oauth2',
    authUrl: 'https://trello.com/1/authorize',
    scopes: ['read', 'write'],
    endpoints: {
      connect: '/api/integrations/trello/connect',
      disconnect: '/api/integrations/trello/disconnect'
    },
    settings: [],
    capabilities: []
  },
  {
    id: 'asana',
    name: 'Asana',
    type: 'project_management',
    icon: 'asana',
    description: 'Sync Asana tasks with focus goals',
    authType: 'oauth2',
    authUrl: 'https://app.asana.com/-/oauth_authorize',
    scopes: ['default'],
    endpoints: {
      connect: '/api/integrations/asana/connect',
      disconnect: '/api/integrations/asana/disconnect'
    },
    settings: [],
    capabilities: []
  },

  // Task Management
  {
    id: 'todoist',
    name: 'Todoist',
    type: 'task_management',
    icon: 'todoist',
    description: 'Import Todoist tasks as focus goals',
    authType: 'api_key',
    endpoints: {
      connect: '/api/integrations/todoist/connect',
      disconnect: '/api/integrations/todoist/disconnect',
      sync: '/api/integrations/todoist/sync'
    },
    settings: [
      { key: 'apiKey', label: 'API Token', type: 'password', required: true },
      { key: 'projectId', label: 'Project Filter', type: 'text', required: false },
      { key: 'labelFilter', label: 'Label Filter', type: 'text', required: false }
    ],
    capabilities: [
      { action: 'read', resource: 'task', mapping: { content: 'title', due: 'deadline' } },
      { action: 'create', resource: 'task', mapping: {} }
    ]
  },
  {
    id: 'things3',
    name: 'Things 3',
    type: 'task_management',
    icon: 'things',
    description: 'Sync with Things 3 for Apple ecosystem',
    authType: 'api_key',
    endpoints: {
      connect: '/api/integrations/things3/connect',
      disconnect: '/api/integrations/things3/disconnect'
    },
    settings: [],
    capabilities: []
  },

  // Developer Tools
  {
    id: 'github',
    name: 'GitHub',
    type: 'developer_tools',
    icon: 'github',
    description: 'Link GitHub issues and PRs to focus sessions',
    authType: 'oauth2',
    authUrl: 'https://github.com/login/oauth/authorize',
    scopes: ['repo', 'user'],
    endpoints: {
      connect: '/api/integrations/github/connect',
      disconnect: '/api/integrations/github/disconnect'
    },
    settings: [
      { key: 'repositories', label: 'Repositories', type: 'text', required: false }
    ],
    capabilities: [
      { action: 'read', resource: 'task', mapping: { title: 'title', number: 'id', state: 'status' } }
    ]
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    type: 'developer_tools',
    icon: 'gitlab',
    description: 'Connect GitLab issues and merge requests',
    authType: 'oauth2',
    authUrl: 'https://gitlab.com/oauth/authorize',
    scopes: ['api', 'read_user'],
    endpoints: {
      connect: '/api/integrations/gitlab/connect',
      disconnect: '/api/integrations/gitlab/disconnect'
    },
    settings: [],
    capabilities: []
  },

  // Cloud Storage
  {
    id: 'google-drive',
    name: 'Google Drive',
    type: 'cloud_storage',
    icon: 'google-drive',
    description: 'Attach Drive files to focus sessions',
    authType: 'oauth2',
    authUrl: 'https://accounts.google.com/o/oauth2/auth',
    scopes: ['drive.readonly'],
    endpoints: {
      connect: '/api/integrations/google-drive/connect',
      disconnect: '/api/integrations/google-drive/disconnect'
    },
    settings: [],
    capabilities: [
      { action: 'read', resource: 'file', mapping: { name: 'title', webViewLink: 'url' } }
    ]
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    type: 'cloud_storage',
    icon: 'dropbox',
    description: 'Sync Dropbox files with focus materials',
    authType: 'oauth2',
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    scopes: ['files.metadata.read'],
    endpoints: {
      connect: '/api/integrations/dropbox/connect',
      disconnect: '/api/integrations/dropbox/disconnect'
    },
    settings: [],
    capabilities: []
  },

  // Automation
  {
    id: 'zapier',
    name: 'Zapier',
    type: 'automation',
    icon: 'zapier',
    description: 'Create automated workflows with Zapier',
    authType: 'api_key',
    endpoints: {
      connect: '/api/integrations/zapier/connect',
      disconnect: '/api/integrations/zapier/disconnect',
      webhook: '/api/webhooks/zapier'
    },
    settings: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'text', required: true }
    ],
    capabilities: []
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    type: 'automation',
    icon: 'make',
    description: 'Build complex automation scenarios',
    authType: 'api_key',
    endpoints: {
      connect: '/api/integrations/make/connect',
      disconnect: '/api/integrations/make/disconnect'
    },
    settings: [],
    capabilities: []
  },

  // CRM
  {
    id: 'salesforce',
    name: 'Salesforce',
    type: 'crm',
    icon: 'salesforce',
    description: 'Link Salesforce opportunities to focus goals',
    authType: 'oauth2',
    authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    scopes: ['api', 'refresh_token'],
    endpoints: {
      connect: '/api/integrations/salesforce/connect',
      disconnect: '/api/integrations/salesforce/disconnect'
    },
    settings: [],
    capabilities: [
      { action: 'read', resource: 'contact', mapping: { Name: 'name', Email: 'email' } }
    ]
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    type: 'crm',
    icon: 'hubspot',
    description: 'Sync HubSpot contacts and deals',
    authType: 'oauth2',
    authUrl: 'https://app.hubspot.com/oauth/authorize',
    scopes: ['crm.objects.contacts.read'],
    endpoints: {
      connect: '/api/integrations/hubspot/connect',
      disconnect: '/api/integrations/hubspot/disconnect'
    },
    settings: [],
    capabilities: []
  }
];

// ==================== Integration Engine Class ====================

class IntegrationEngine {
  private connections: Map<string, ConnectedIntegration> = new Map();
  private syncQueue: SyncEvent[] = [];
  private webhookHandlers: Map<string, (payload: WebhookPayload) => Promise<void>> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHealthMonitoring();
  }

  /**
   * Get all available integrations
   */
  getAvailableIntegrations(type?: IntegrationType): IntegrationConfig[] {
    if (type) {
      return INTEGRATION_REGISTRY.filter(i => i.type === type);
    }
    return INTEGRATION_REGISTRY;
  }

  /**
   * Get integration by ID
   */
  getIntegration(id: string): IntegrationConfig | undefined {
    return INTEGRATION_REGISTRY.find(i => i.id === id);
  }

  /**
   * Connect to an integration
   */
  async connect(integrationId: string, credentials?: any, settings?: Record<string, any>): Promise<ConnectedIntegration> {
    const config = this.getIntegration(integrationId);
    if (!config) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    const connection: ConnectedIntegration = {
      config,
      status: 'connecting',
      syncDirection: 'bidirectional',
      settings: settings || {},
      health: {
        status: 'healthy',
        lastCheck: new Date(),
        latency: 0,
        successRate: 100,
        errorCount: 0
      }
    };

    try {
      // Simulate OAuth flow or API key validation
      if (config.authType === 'oauth2') {
        // In production, redirect to authUrl
        connection.credentials = {
          accessToken: credentials?.accessToken || 'mock_token_' + Date.now(),
          refreshToken: credentials?.refreshToken
        };
        connection.expiresAt = new Date(Date.now() + 3600000); // 1 hour
      } else if (config.authType === 'api_key') {
        connection.credentials = {
          apiKey: credentials?.apiKey
        };
      }

      connection.status = 'connected';
      connection.connectedAt = new Date();
      
      this.connections.set(integrationId, connection);
      
      // Trigger initial sync if available
      if (config.endpoints.sync) {
        await this.sync(integrationId, 'pull');
      }

      return connection;
    } catch (error) {
      connection.status = 'error';
      connection.health.status = 'unhealthy';
      connection.health.message = (error as Error).message;
      throw error;
    }
  }

  /**
   * Disconnect from an integration
   */
  async disconnect(integrationId: string): Promise<void> {
    const connection = this.connections.get(integrationId);
    if (!connection) return;

    try {
      // Call disconnect endpoint
      await this.callEndpoint(connection.config.endpoints.disconnect, connection.credentials);
      
      this.connections.delete(integrationId);
    } catch (error) {
      console.error(`Failed to disconnect ${integrationId}:`, error);
      // Still remove from local state
      this.connections.delete(integrationId);
    }
  }

  /**
   * Sync data with an integration
   */
  async sync(integrationId: string, direction: SyncDirection = 'bidirectional'): Promise<SyncEvent> {
    const connection = this.connections.get(integrationId);
    if (!connection || connection.status !== 'connected') {
      throw new Error(`Integration ${integrationId} is not connected`);
    }

    const syncEvent: SyncEvent = {
      id: `sync_${Date.now()}_${integrationId}`,
      integrationId,
      direction,
      resource: 'all',
      action: 'sync',
      status: 'pending',
      timestamp: new Date()
    };

    this.syncQueue.push(syncEvent);

    try {
      if (!connection.config.endpoints.sync) {
        throw new Error('Sync endpoint not available');
      }

      // Simulate API call
      await this.callEndpoint(connection.config.endpoints.sync, connection.credentials, { direction });
      
      syncEvent.status = 'success';
      connection.lastSyncAt = new Date();
      connection.health.successRate = Math.min(100, connection.health.successRate + 1);
      connection.health.errorCount = 0;
    } catch (error) {
      syncEvent.status = 'failed';
      syncEvent.error = (error as Error).message;
      connection.health.status = 'degraded';
      connection.health.errorCount++;
      connection.health.successRate = Math.max(0, connection.health.successRate - 5);
    }

    return syncEvent;
  }

  /**
   * Register webhook handler
   */
  registerWebhookHandler(integrationId: string, handler: (payload: WebhookPayload) => Promise<void>): void {
    this.webhookHandlers.set(integrationId, handler);
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(integrationId: string, payload: WebhookPayload): Promise<void> {
    const handler = this.webhookHandlers.get(integrationId);
    if (!handler) {
      console.warn(`No webhook handler for ${integrationId}`);
      return;
    }

    try {
      // Verify signature
      const connection = this.connections.get(integrationId);
      if (connection?.credentials?.webhookSecret) {
        const isValid = await this.verifyWebhookSignature(payload, connection.credentials.webhookSecret);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      await handler(payload);
    } catch (error) {
      console.error(`Webhook processing failed for ${integrationId}:`, error);
    }
  }

  /**
   * Get connection status
   */
  getConnection(integrationId: string): ConnectedIntegration | undefined {
    return this.connections.get(integrationId);
  }

  /**
   * Get all connections
   */
  getAllConnections(): ConnectedIntegration[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get sync history
   */
  getSyncHistory(integrationId?: string, limit: number = 50): SyncEvent[] {
    let history = this.syncQueue.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (integrationId) {
      history = history.filter(e => e.integrationId === integrationId);
    }
    
    return history.slice(0, limit);
  }

  /**
   * Test connection health
   */
  async testHealth(integrationId: string): Promise<IntegrationHealth> {
    const connection = this.connections.get(integrationId);
    if (!connection) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        latency: 0,
        successRate: 0,
        errorCount: 0,
        message: 'Not connected'
      };
    }

    const startTime = Date.now();
    
    try {
      // Simulate health check ping
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      
      const latency = Date.now() - startTime;
      const isHealthy = latency < 1000;
      
      connection.health = {
        status: isHealthy ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        latency,
        successRate: isHealthy ? 100 : 50,
        errorCount: isHealthy ? 0 : 1
      };

      return connection.health;
    } catch (error) {
      connection.health = {
        status: 'unhealthy',
        lastCheck: new Date(),
        latency: 0,
        successRate: 0,
        errorCount: connection.health.errorCount + 1,
        message: (error as Error).message
      };
      
      return connection.health;
    }
  }

  /**
   * Start automatic health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      const connections = this.getAllConnections();
      
      for (const connection of connections) {
        if (connection.status === 'connected') {
          await this.testHealth(connection.config.id);
          
          // Check token expiration
          if (connection.expiresAt && connection.expiresAt.getTime() < Date.now() + 300000) {
            // Token expiring soon, attempt refresh
            await this.refreshToken(connection.config.id);
          }
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Refresh OAuth token
   */
  private async refreshToken(integrationId: string): Promise<void> {
    const connection = this.connections.get(integrationId);
    if (!connection || !connection.credentials?.refreshToken) return;

    try {
      // Simulate token refresh
      const newToken = 'refreshed_token_' + Date.now();
      connection.credentials.accessToken = newToken;
      connection.expiresAt = new Date(Date.now() + 3600000);
      
      console.log(`Refreshed token for ${integrationId}`);
    } catch (error) {
      console.error(`Failed to refresh token for ${integrationId}:`, error);
      connection.status = 'expired';
    }
  }

  /**
   * Call integration endpoint
   */
  private async callEndpoint(url: string, credentials?: any, data?: any): Promise<any> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
    
    // In production, make actual fetch request
    return { success: true, data };
  }

  /**
   * Verify webhook signature
   */
  private async verifyWebhookSignature(payload: WebhookPayload, secret: string): Promise<boolean> {
    // Simulate signature verification
    // In production, use HMAC-SHA256
    return payload.signature.startsWith('valid_');
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.connections.clear();
    this.syncQueue = [];
    this.webhookHandlers.clear();
  }
}

// ==================== Singleton Instance ====================

export const integrationEngine = new IntegrationEngine();

export default integrationEngine;
