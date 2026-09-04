/**
 * FocusArx Integration Hub - Phase 6
 * Visual marketplace for connecting external productivity tools
 */

import React, { useState } from 'react';
import { useIntegrations } from '../../hooks/useIntegrations';
import type { IntegrationType } from '../../services/integrations/IntegrationEngine';

// ==================== Styles ====================

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '2rem'
  },
  header: {
    maxWidth: '1200px',
    margin: '0 auto 2rem',
    color: 'white',
    textAlign: 'center' as const
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem'
  },
  subtitle: {
    fontSize: '1.1rem',
    opacity: 0.9
  },
  filterBar: {
    maxWidth: '1200px',
    margin: '0 auto 2rem',
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
    justifyContent: 'center'
  },
  filterButton: (active: boolean) => ({
    padding: '0.5rem 1rem',
    borderRadius: '9999px',
    border: 'none',
    background: active ? 'white' : 'rgba(255,255,255,0.2)',
    color: active ? '#667eea' : 'white',
    fontWeight: '600' as const,
    cursor: 'pointer',
    transition: 'all 0.2s'
  }),
  grid: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '1.5rem'
  },
  card: (status: string) => ({
    background: 'rgba(255,255,255,0.95)',
    borderRadius: '1rem',
    padding: '1.5rem',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    backdropFilter: 'blur(10px)',
    border: status === 'connected' ? '2px solid #10b981' : '2px solid transparent',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer'
  }),
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1rem'
  },
  icon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white'
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: '#1f2937'
  },
  badge: (type: string) => ({
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '600' as const,
    background: getTypeColor(type),
    color: 'white',
    textTransform: 'uppercase' as const
  }),
  description: {
    color: '#6b7280',
    marginBottom: '1rem',
    lineHeight: '1.5'
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
    padding: '0.75rem',
    background: '#f3f4f6',
    borderRadius: '0.5rem'
  },
  statusIndicator: (status: string) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontWeight: '600' as const,
    color: getStatusColor(status)
  }),
  dot: (status: string) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: getStatusColor(status)
  }),
  actionButton: (primary: boolean) => ({
    width: '100%',
    padding: '0.75rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: primary ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e5e7eb',
    color: primary ? 'white' : '#374151',
    fontWeight: '600' as const,
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  }),
  settingsSection: {
    marginTop: '1rem',
    padding: '1rem',
    background: '#f9fafb',
    borderRadius: '0.5rem'
  },
  settingRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
    marginBottom: '0.75rem'
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: '500' as const,
    color: '#374151'
  },
  input: {
    padding: '0.5rem',
    borderRadius: '0.375rem',
    border: '1px solid #d1d5db',
    fontSize: '0.875rem'
  },
  healthBar: {
    height: '6px',
    background: '#e5e7eb',
    borderRadius: '3px',
    overflow: 'hidden',
    marginTop: '0.5rem'
  },
  healthFill: (rate: number) => ({
    height: '100%',
    width: `${rate}%`,
    background: getHealthColor(rate),
    transition: 'width 0.3s'
  }),
  syncLog: {
    maxHeight: '200px',
    overflowY: 'auto' as const,
    marginTop: '1rem',
    padding: '0.75rem',
    background: '#f9fafb',
    borderRadius: '0.5rem',
    fontSize: '0.75rem'
  },
  logEntry: (success: boolean) => ({
    padding: '0.25rem 0',
    color: success ? '#10b981' : '#ef4444',
    borderBottom: '1px solid #e5e7eb'
  })
};

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    communication: '#3b82f6',
    calendar: '#f59e0b',
    project_management: '#8b5cf6',
    task_management: '#10b981',
    developer_tools: '#6366f1',
    cloud_storage: '#ec4899',
    automation: '#f43f5e',
    crm: '#14b8a6'
  };
  return colors[type] || '#6b7280';
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    connected: '#10b981',
    connecting: '#f59e0b',
    disconnected: '#6b7280',
    error: '#ef4444',
    expired: '#f97316'
  };
  return colors[status] || '#6b7280';
}

function getHealthColor(rate: number): string {
  if (rate >= 90) return '#10b981';
  if (rate >= 70) return '#f59e0b';
  return '#ef4444';
}

// ==================== Main Component ====================

export function IntegrationHub() {
  const {
    available,
    connected,
    loading,
    error,
    connect,
    disconnect,
    sync,
    testHealth,
    getByType,
    getSyncHistory
  } = useIntegrations();

  const [filter, setFilter] = useState<IntegrationType | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({});

  const filteredIntegrations = filter === 'all' 
    ? available 
    : getByType(filter);

  const getIntegrationStatus = (id: string) => {
    const conn = connected.find(c => c.config.id === id);
    return conn?.status || 'disconnected';
  };

  const handleConnect = async (id: string) => {
    const config = available.find(i => i.id === id);
    if (!config) return;

    if (config.authType === 'oauth2') {
      // Simulate OAuth redirect
      alert(`Redirecting to ${config.name} OAuth...`);
      await connect(id, { accessToken: 'mock_token' }, settings[id]);
    } else if (config.authType === 'api_key') {
      setShowSettings(true);
      setSelectedId(id);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (confirm(`Disconnect from ${available.find(i => i.id === id)?.name}?`)) {
      await disconnect(id);
    }
  };

  const handleSync = async (id: string) => {
    try {
      await sync(id, 'bidirectional');
      alert('Sync completed successfully!');
    } catch (err) {
      alert('Sync failed: ' + (err as Error).message);
    }
  };

  const handleTestHealth = async (id: string) => {
    const health = await testHealth(id);
    alert(`Health: ${health.status}\nLatency: ${health.latency}ms\nSuccess Rate: ${health.successRate}%`);
  };

  const types: { value: IntegrationType | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'communication', label: 'Communication' },
    { value: 'calendar', label: 'Calendar' },
    { value: 'project_management', label: 'Project Mgmt' },
    { value: 'task_management', label: 'Task Mgmt' },
    { value: 'developer_tools', label: 'Dev Tools' },
    { value: 'cloud_storage', label: 'Cloud Storage' },
    { value: 'automation', label: 'Automation' },
    { value: 'crm', label: 'CRM' }
  ];

  if (loading && available.length === 0) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.header, paddingTop: '100px' }}>
          <div style={{ fontSize: '2rem', color: 'white' }}>Loading integrations...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>🔌 Integration Hub</h1>
        <p style={styles.subtitle}>
          Connect your favorite tools and create a unified productivity ecosystem
        </p>
      </header>

      {/* Filter Bar */}
      <div style={styles.filterBar}>
        {types.map(type => (
          <button
            key={type.value}
            style={styles.filterButton(filter === type.value)}
            onClick={() => setFilter(type.value)}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Integration Grid */}
      <div style={styles.grid}>
        {filteredIntegrations.map(integration => {
          const status = getIntegrationStatus(integration.id);
          const isConnected = status === 'connected';
          const connection = connected.find(c => c.config.id === integration.id);

          return (
            <div
              key={integration.id}
              style={styles.card(status)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 10px 40px rgba(0,0,0,0.2)';
              }}
            >
              {/* Card Header */}
              <div style={styles.cardHeader}>
                <div style={styles.icon}>
                  {integration.icon.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={styles.cardTitle}>{integration.name}</h3>
                  <span style={styles.badge(integration.type)}>
                    {integration.type.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p style={styles.description}>{integration.description}</p>

              {/* Status Row */}
              <div style={styles.statusRow}>
                <div style={styles.statusIndicator(status)}>
                  <div style={styles.dot(status)}></div>
                  <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                </div>
                {connection?.lastSyncAt && (
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    Last sync: {new Date(connection.lastSyncAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {/* Health Bar */}
              {isConnected && connection && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    <span>Health</span>
                    <span>{connection.health.successRate.toFixed(0)}%</span>
                  </div>
                  <div style={styles.healthBar}>
                    <div style={styles.healthFill(connection.health.successRate)}></div>
                  </div>
                </div>
              )}

              {/* Settings Section */}
              {showSettings && selectedId === integration.id && integration.settings.length > 0 && (
                <div style={styles.settingsSection}>
                  {integration.settings.map(setting => (
                    <div key={setting.key} style={styles.settingRow}>
                      <label style={styles.label}>{setting.label}</label>
                      {setting.type === 'boolean' ? (
                        <input
                          type="checkbox"
                          checked={settings[integration.id]?.[setting.key] || setting.defaultValue || false}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            [integration.id]: {
                              ...prev[integration.id],
                              [setting.key]: e.target.checked
                            }
                          }))}
                        />
                      ) : setting.type === 'select' ? (
                        <select
                          style={styles.input}
                          value={settings[integration.id]?.[setting.key] || setting.defaultValue || ''}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            [integration.id]: {
                              ...prev[integration.id],
                              [setting.key]: e.target.value
                            }
                          }))}
                        >
                          {setting.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={setting.type}
                          style={styles.input}
                          value={settings[integration.id]?.[setting.key] || setting.defaultValue || ''}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            [integration.id]: {
                              ...prev[integration.id],
                              [setting.key]: e.target.value
                            }
                          }))}
                          placeholder={setting.label}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Sync Log */}
              {isConnected && connection && (
                <div style={styles.syncLog}>
                  {getSyncHistory(integration.id, 3).map(event => (
                    <div key={event.id} style={styles.logEntry(event.status === 'success')}>
                      {new Date(event.timestamp).toLocaleTimeString()} - {event.status}
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                {!isConnected ? (
                  <button
                    style={styles.actionButton(true)}
                    onClick={() => handleConnect(integration.id)}
                  >
                    Connect
                  </button>
                ) : (
                  <>
                    <button
                      style={styles.actionButton(true)}
                      onClick={() => handleSync(integration.id)}
                    >
                      🔄 Sync Now
                    </button>
                    <button
                      style={styles.actionButton(false)}
                      onClick={() => handleTestHealth(integration.id)}
                    >
                      ❤️ Test Health
                    </button>
                    <button
                      style={styles.actionButton(false)}
                      onClick={() => handleDisconnect(integration.id)}
                    >
                      Disconnect
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          padding: '1rem 2rem',
          background: '#ef4444',
          color: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default IntegrationHub;
