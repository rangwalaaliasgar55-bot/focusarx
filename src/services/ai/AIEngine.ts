/**
 * FocusArx AI Engine Service
 * Provides intelligent focus recommendations, distraction analysis, and productivity insights
 */

interface FocusSession {
  id: string;
  duration: number;
  distractions: number;
  completedTasks: string[];
  mood: 'low' | 'medium' | 'high';
  timestamp: Date;
}

interface UserPattern {
  peakHours: number[];
  averageFocusDuration: number;
  commonDistractions: string[];
  optimalBreakInterval: number;
  productivityScore: number;
}

class AIEngine {
  private sessionHistory: FocusSession[] = [];
  private userPatterns: UserPattern | null = null;

  /**
   * Analyze user behavior patterns from session history
   */
  analyzePatterns(): UserPattern {
    if (this.sessionHistory.length === 0) {
      return this.getDefaultPattern();
    }

    const peakHours = this.calculatePeakHours();
    const avgDuration = this.calculateAverageDuration();
    const distractions = this.identifyCommonDistractions();
    const breakInterval = this.optimizeBreakInterval();
    const score = this.calculateProductivityScore();

    this.userPatterns = {
      peakHours,
      averageFocusDuration: avgDuration,
      commonDistractions: distractions,
      optimalBreakInterval: breakInterval,
      productivityScore: score
    };

    return this.userPatterns;
  }

  /**
   * Get personalized focus recommendations
   */
  getRecommendations(): string[] {
    const patterns = this.userPatterns || this.analyzePatterns();
    const recommendations: string[] = [];

    // Peak hours recommendation
    if (patterns.peakHours.length > 0) {
      const peakStart = patterns.peakHours[0];
      const peakEnd = patterns.peakHours[patterns.peakHours.length - 1];
      recommendations.push(
        `Schedule your most challenging tasks between ${this.formatHour(peakStart)} and ${this.formatHour(peakEnd)} when your focus is naturally higher.`
      );
    }

    // Distraction management
    if (patterns.commonDistractions.length > 0) {
      const topDistraction = patterns.commonDistractions[0];
      recommendations.push(
        `You're frequently distracted by "${topDistraction}". Consider using website blockers or notification controls during focus sessions.`
      );
    }

    // Break optimization
    if (patterns.averageFocusDuration < 25) {
      recommendations.push(
        'Your focus sessions are shorter than average. Try the Pomodoro technique: 25 minutes of focused work followed by a 5-minute break.'
      );
    } else if (patterns.averageFocusDuration > 90) {
      recommendations.push(
        'Long focus sessions can lead to burnout. Consider taking a 15-minute break every 90 minutes to maintain peak performance.'
      );
    }

    // Productivity improvement
    if (patterns.productivityScore < 60) {
      recommendations.push(
        'Your productivity score suggests room for improvement. Start with smaller, achievable goals to build momentum.'
      );
    } else if (patterns.productivityScore > 85) {
      recommendations.push(
        'Excellent productivity! Consider tackling more complex projects or mentoring others to leverage your high-performance state.'
      );
    }

    return recommendations;
  }

  /**
   * Predict optimal session duration based on historical data
   */
  predictOptimalDuration(timeOfDay: number, dayOfWeek: number): number {
    const patterns = this.userPatterns || this.analyzePatterns();
    
    // Base duration on average
    let duration = patterns.averageFocusDuration;

    // Adjust for time of day
    if (patterns.peakHours.includes(timeOfDay)) {
      duration *= 1.2; // 20% longer during peak hours
    } else {
      duration *= 0.8; // 20% shorter during off-peak hours
    }

    // Adjust for day of week (Monday/Friday typically lower focus)
    if (dayOfWeek === 1 || dayOfWeek === 5) {
      duration *= 0.9;
    }

    // Cap between 15 and 120 minutes
    return Math.max(15, Math.min(120, Math.round(duration)));
  }

  /**
   * Analyze distraction triggers
   */
  analyzeDistractionTriggers(currentSession: Partial<FocusSession>): string[] {
    const triggers: string[] = [];
    
    if (!this.sessionHistory.length) {
      return ['Insufficient data for distraction analysis'];
    }

    const recentSessions = this.sessionHistory.slice(-10);
    const avgDistractions = recentSessions.reduce((sum, s) => sum + s.distractions, 0) / recentSessions.length;

    if ((currentSession.distractions || 0) > avgDistractions * 1.5) {
      triggers.push('Higher than usual distraction rate detected');
      
      // Time-based analysis
      const hour = new Date().getHours();
      if (hour === 14 || hour === 15) {
        triggers.push('Afternoon slump period - consider a quick walk or hydration break');
      }
      
      if (recentSessions.some(s => s.mood === 'low')) {
        triggers.push('Recent low mood sessions correlate with increased distractions');
      }
    }

    return triggers;
  }

  /**
   * Generate smart break suggestions
   */
  suggestBreakActivity(sessionDuration: number, mood: string): string {
    const activities = {
      physical: ['Stretching exercises', 'Quick walk', 'Jumping jacks', 'Deep breathing'],
      mental: ['Meditation', 'Mindfulness exercise', 'Gratitude journaling', 'Visualization'],
      social: ['Chat with a colleague', 'Share progress update', 'Team check-in'],
      rest: ['Power nap (10-20 min)', 'Eye relaxation', 'Listen to calming music']
    };

    if (sessionDuration > 90) {
      return activities.physical[Math.floor(Math.random() * activities.physical.length)];
    }

    if (mood === 'low') {
      return activities.mental[Math.floor(Math.random() * activities.mental.length)];
    }

    return activities.rest[Math.floor(Math.random() * activities.rest.length)];
  }

  /**
   * Add session to history for pattern analysis
   */
  addSession(session: FocusSession): void {
    this.sessionHistory.push(session);
    
    // Keep only last 100 sessions for performance
    if (this.sessionHistory.length > 100) {
      this.sessionHistory = this.sessionHistory.slice(-100);
    }
    
    // Re-analyze patterns periodically
    if (this.sessionHistory.length % 5 === 0) {
      this.analyzePatterns();
    }
  }

  /**
   * Calculate productivity score (0-100)
   */
  private calculateProductivityScore(): number {
    if (this.sessionHistory.length === 0) return 50;

    const recentSessions = this.sessionHistory.slice(-20);
    
    // Factors: completion rate, distraction ratio, consistency
    const completionRate = recentSessions.filter(s => s.completedTasks.length > 0).length / recentSessions.length;
    const avgDistractions = recentSessions.reduce((sum, s) => sum + s.distractions, 0) / recentSessions.length;
    const distractionFactor = Math.max(0, 1 - (avgDistractions / 10));
    
    // Weighted score
    const score = (completionRate * 40) + (distractionFactor * 40) + 20;
    
    return Math.round(Math.min(100, Math.max(0, score)));
  }

  private calculatePeakHours(): number[] {
    const hourScores: Record<number, number> = {};
    
    this.sessionHistory.forEach(session => {
      const hour = session.timestamp.getHours();
      if (!hourScores[hour]) hourScores[hour] = 0;
      
      // Score based on task completion and low distractions
      const score = session.completedTasks.length - (session.distractions * 0.5);
      hourScores[hour] += score;
    });

    // Get top 3 hours
    return Object.entries(hourScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
  }

  private calculateAverageDuration(): number {
    if (this.sessionHistory.length === 0) return 25;
    
    const total = this.sessionHistory.reduce((sum, s) => sum + s.duration, 0);
    return Math.round(total / this.sessionHistory.length);
  }

  private identifyCommonDistractions(): string[] {
    const defaultDistractions = ['Social media', 'Email notifications', 'Chat messages', 'News websites'];
    
    // In a real implementation, this would analyze actual distraction sources
    // For now, return weighted random selection
    const weights = defaultDistractions.map(() => Math.random());
    const maxWeight = Math.max(...weights);
    const index = weights.indexOf(maxWeight);
    
    return [defaultDistractions[index]];
  }

  private optimizeBreakInterval(): number {
    // Based on research: optimal break interval is 52 minutes work, 17 minutes break
    // Adjust based on user patterns
    const baseInterval = 52;
    
    if (this.userPatterns && this.userPatterns.averageFocusDuration < 30) {
      return 25; // Pomodoro style
    }
    
    return baseInterval;
  }

  private getDefaultPattern(): UserPattern {
    return {
      peakHours: [9, 10, 11],
      averageFocusDuration: 25,
      commonDistractions: ['Social media'],
      optimalBreakInterval: 52,
      productivityScore: 50
    };
  }

  private formatHour(hour: number): string {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:00 ${ampm}`;
  }
}

// Singleton instance
export const aiEngine = new AIEngine();
export default aiEngine;
