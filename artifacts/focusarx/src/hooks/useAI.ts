import { useState, useEffect, useCallback } from 'react';
import aiEngine from '../services/ai/AIEngine';

interface UseAIRecommendationsResult {
  recommendations: string[];
  productivityScore: number;
  peakHours: number[];
  optimalDuration: number;
  distractionTriggers: string[];
  breakSuggestion: string;
  isLoading: boolean;
  refreshRecommendations: () => void;
}

interface SessionData {
  id: string;
  duration: number;
  distractions: number;
  completedTasks: string[];
  mood: 'low' | 'medium' | 'high';
  timestamp: Date;
}

/**
 * React hook for AI-powered focus recommendations
 */
export function useAIRecommendations(): UseAIRecommendationsResult {
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [productivityScore, setProductivityScore] = useState<number>(50);
  const [peakHours, setPeakHours] = useState<number[]>([]);
  const [optimalDuration, setOptimalDuration] = useState<number>(25);
  const [distractionTriggers, setDistractionTriggers] = useState<string[]>([]);
  const [breakSuggestion, setBreakSuggestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshRecommendations = useCallback(() => {
    setIsLoading(true);
    
    try {
      // Analyze patterns
      const patterns = aiEngine.analyzePatterns();
      setProductivityScore(patterns.productivityScore);
      setPeakHours(patterns.peakHours);
      
      // Get recommendations
      const recs = aiEngine.getRecommendations();
      setRecommendations(recs);
      
      // Predict optimal duration for current time
      const now = new Date();
      const duration = aiEngine.predictOptimalDuration(
        now.getHours(),
        now.getDay()
      );
      setOptimalDuration(duration);
      
      // Analyze distraction triggers (mock current session)
      const mockSession: Partial<SessionData> = {
        distractions: Math.floor(Math.random() * 5),
        mood: 'medium'
      };
      const triggers = aiEngine.analyzeDistractionTriggers(mockSession);
      setDistractionTriggers(triggers);
      
      // Get break suggestion
      const activity = aiEngine.suggestBreakActivity(45, 'medium');
      setBreakSuggestion(activity);
      
    } catch (error) {
      console.error('Error fetching AI recommendations:', error);
      setRecommendations(['Unable to load recommendations. Please try again.']);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRecommendations();
  }, [refreshRecommendations]);

  return {
    recommendations,
    productivityScore,
    peakHours,
    optimalDuration,
    distractionTriggers,
    breakSuggestion,
    isLoading,
    refreshRecommendations
  };
}

/**
 * Hook for tracking focus sessions with AI analysis
 */
export function useFocusSessionTracker() {
  const [currentSession, setCurrentSession] = useState<Partial<SessionData> | null>(null);
  const [sessionCount, setSessionCount] = useState<number>(0);

  const startSession = useCallback((sessionId: string) => {
    setCurrentSession({
      id: sessionId,
      duration: 0,
      distractions: 0,
      completedTasks: [],
      mood: 'medium',
      timestamp: new Date()
    });
  }, []);

  const updateSession = useCallback((updates: Partial<SessionData>) => {
    setCurrentSession(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  const endSession = useCallback(() => {
    if (currentSession && currentSession.id) {
      // Add completed session to AI engine
      aiEngine.addSession({
        id: currentSession.id,
        duration: currentSession.duration || 0,
        distractions: currentSession.distractions || 0,
        completedTasks: currentSession.completedTasks || [],
        mood: currentSession.mood || 'medium',
        timestamp: currentSession.timestamp || new Date()
      });
      
      setSessionCount(prev => prev + 1);
      setCurrentSession(null);
      
      return true;
    }
    return false;
  }, [currentSession]);

  const recordDistraction = useCallback(() => {
    setCurrentSession(prev => 
      prev ? { ...prev, distractions: (prev.distractions || 0) + 1 } : null
    );
  }, []);

  const completeTask = useCallback((taskName: string) => {
    setCurrentSession(prev => 
      prev ? { 
        ...prev, 
        completedTasks: [...(prev.completedTasks || []), taskName] 
      } : null
    );
  }, []);

  return {
    currentSession,
    sessionCount,
    startSession,
    updateSession,
    endSession,
    recordDistraction,
    completeTask
  };
}

/**
 * Hook for smart break reminders
 */
export function useSmartBreakReminder(optimalWorkDuration: number = 52) {
  const [timeRemaining, setTimeRemaining] = useState<number>(optimalWorkDuration * 60);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [breakTime, setBreakTime] = useState<number>(17 * 60); // 17 minutes

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isActive) {
      setIsActive(false);
      // Trigger break notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Time for a Break!', {
          body: 'Step away from your desk. Your brain will thank you!',
          icon: '/favicon.ico'
        });
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeRemaining]);

  const startTimer = useCallback(() => {
    setTimeRemaining(optimalWorkDuration * 60);
    setIsActive(true);
  }, [optimalWorkDuration]);

  const pauseTimer = useCallback(() => {
    setIsActive(false);
  }, []);

  const resetTimer = useCallback(() => {
    setTimeRemaining(optimalWorkDuration * 60);
    setIsActive(false);
  }, [optimalWorkDuration]);

  const skipBreak = useCallback(() => {
    setBreakTime(0);
    setIsActive(true);
    setTimeRemaining(optimalWorkDuration * 60);
  }, [optimalWorkDuration]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    timeRemaining: isActive ? timeRemaining : breakTime,
    formattedTime: formatTime(isActive ? timeRemaining : breakTime),
    isActive,
    isBreakTime: timeRemaining === 0,
    startTimer,
    pauseTimer,
    resetTimer,
    skipBreak
  };
}

export default { 
  useAIRecommendations, 
  useFocusSessionTracker, 
  useSmartBreakReminder 
};
