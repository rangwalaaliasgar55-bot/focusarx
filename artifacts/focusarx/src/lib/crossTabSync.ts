/**
 * BroadcastChannel Cross-Tab Synchronization
 * Keeps timer state, focus sessions, and user actions in sync across browser tabs
 * 
 * Channels:
 * - timer: Timer start/pause/stop/complete events
 * - focus: Focus session state changes
 * - gamification: XP, coins, streak updates
 * - notifications: Cross-tab notification coordination
 */

type ChannelName = 'timer' | 'focus' | 'gamification' | 'notifications';

interface BroadcastMessage {
  type: string;
  payload: any;
  timestamp: number;
  tabId: string;
}

type MessageHandler = (payload: any, tabId: string) => void;

class CrossTabSync {
  private channels: Map<ChannelName, BroadcastChannel> = new Map();
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private tabId: string;

  constructor() {
    // Generate unique tab ID
    this.tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.initChannels();
  }

  private initChannels() {
    const channelNames: ChannelName[] = ['timer', 'focus', 'gamification', 'notifications'];
    
    channelNames.forEach(name => {
      try {
        const channel = new BroadcastChannel(`focusarx-${name}`);
        channel.addEventListener('message', (event) => {
          this.handleMessage(name, event.data);
        });
        this.channels.set(name, channel);
      } catch (e) {
        // BroadcastChannel not available — silently skip
      }
    });
  }

  private handleMessage(channel: ChannelName, message: BroadcastMessage) {
    // Ignore messages from own tab
    if (message.tabId === this.tabId) return;

    const key = `${channel}:${message.type}`;
    const handlers = this.handlers.get(key);
    
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message.payload, message.tabId);
        } catch (e) {
          // Handler error — silently skip
        }
      });
    }
  }

  /**
   * Broadcast a message to all other tabs
   */
  broadcast(channel: ChannelName, type: string, payload: any) {
    const ch = this.channels.get(channel);
    if (!ch) return;

    const message: BroadcastMessage = {
      type,
      payload,
      timestamp: Date.now(),
      tabId: this.tabId,
    };

    try {
      ch.postMessage(message);
    } catch (e) {
      // Broadcast failed — silently skip
    }
  }

  /**
   * Subscribe to messages from other tabs
   */
  on(channel: ChannelName, type: string, handler: MessageHandler) {
    const key = `${channel}:${type}`;
    
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    
    this.handlers.get(key)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(key)?.delete(handler);
    };
  }

  /**
   * Timer events
   */
  broadcastTimerEvent(event: 'start' | 'pause' | 'resume' | 'stop' | 'complete', data: any) {
    this.broadcast('timer', event, data);
  }

  onTimerEvent(event: 'start' | 'pause' | 'resume' | 'stop' | 'complete', handler: MessageHandler) {
    return this.on('timer', event, handler);
  }

  /**
   * Focus session events
   */
  broadcastFocusEvent(event: 'session-start' | 'session-complete' | 'streak-update', data: any) {
    this.broadcast('focus', event, data);
  }

  onFocusEvent(event: 'session-start' | 'session-complete' | 'streak-update', handler: MessageHandler) {
    return this.on('focus', event, handler);
  }

  /**
   * Gamification events (XP, coins, etc.)
   */
  broadcastGamification(event: 'xp-update' | 'coins-update' | 'level-up' | 'achievement', data: any) {
    this.broadcast('gamification', event, data);
  }

  onGamification(event: 'xp-update' | 'coins-update' | 'level-up' | 'achievement', handler: MessageHandler) {
    return this.on('gamification', event, handler);
  }

  /**
   * Notification coordination (prevent duplicate notifications across tabs)
   */
  broadcastNotification(type: string, data: any) {
    this.broadcast('notifications', type, data);
  }

  onNotification(type: string, handler: MessageHandler) {
    return this.on('notifications', type, handler);
  }

  getTabId() {
    return this.tabId;
  }

  destroy() {
    this.channels.forEach(channel => {
      try {
        channel.close();
      } catch (e) {
        // Ignore
      }
    });
    this.channels.clear();
    this.handlers.clear();
  }
}

// Singleton instance
export const crossTabSync = new CrossTabSync();
