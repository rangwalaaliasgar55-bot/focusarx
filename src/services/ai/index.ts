/**
 * AI Services Module
 * Central export for all AI-related functionality
 */

export { default as aiEngine, AIEngine } from './AIEngine';
export { 
  useAIRecommendations, 
  useFocusSessionTracker, 
  useSmartBreakReminder 
} from '../../hooks/useAI';

// Re-export types
export type { FocusSession, UserPattern } from './AIEngine';
