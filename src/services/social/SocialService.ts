/**
 * FocusArx Social & Community Features Module
 * Enables collaboration, leaderboards, challenges, and social accountability
 */

export interface UserProfile {
  id: string;
  username: string;
  avatar?: string;
  bio?: string;
  totalFocusMinutes: number;
  streakDays: number;
  level: number;
  badges: Badge[];
  joinDate: Date;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: Date;
  category: 'milestone' | 'achievement' | 'special';
}

export interface LeaderboardEntry {
  rank: number;
  user: UserProfile;
  focusMinutes: number;
  sessionsCompleted: number;
  weeklyStreak: number;
  change: number; // rank change from previous week
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'individual' | 'team' | 'global';
  goal: number;
  unit: 'minutes' | 'sessions' | 'tasks';
  startDate: Date;
  endDate: Date;
  participants: number;
  prize?: string;
  status: 'active' | 'upcoming' | 'completed';
}

export interface ChallengeParticipation {
  challengeId: string;
  userId: string;
  progress: number;
  rank: number;
  completed: boolean;
  rewardClaimed: boolean;
}

export interface AccountabilityPartner {
  id: string;
  user: UserProfile;
  status: 'pending' | 'active' | 'paused';
  sharedGoals: string[];
  lastCheckIn?: Date;
  streakTogether: number;
}

export interface FocusRoom {
  id: string;
  name: string;
  description?: string;
  host: string;
  members: string[];
  maxMembers: number;
  isActive: boolean;
  sessionStartTime?: Date;
  sessionDuration?: number;
  rules: string[];
}

export interface ActivityFeedItem {
  id: string;
  userId: string;
  user: UserProfile;
  action: 'session_completed' | 'badge_earned' | 'challenge_joined' | 'milestone_reached' | 'streak_achieved';
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  likes: number;
  comments: number;
}

/**
 * Social Service for community features
 */
class SocialService {
  private apiBaseUrl: string;
  
  constructor(apiBaseUrl: string = '/api') {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Get user profile with stats
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    const response = await fetch(`${this.apiBaseUrl}/social/profile/${userId}`);
    if (!response.ok) throw new Error('Failed to fetch profile');
    return response.json();
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const response = await fetch(`${this.apiBaseUrl}/social/profile/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update profile');
    return response.json();
  }

  /**
   * Get global leaderboard
   */
  async getLeaderboard(timeframe: 'daily' | 'weekly' | 'monthly' | 'alltime', limit: number = 50): Promise<LeaderboardEntry[]> {
    const response = await fetch(`${this.apiBaseUrl}/social/leaderboard?timeframe=${timeframe}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch leaderboard');
    return response.json();
  }

  /**
   * Get user's rank
   */
  async getUserRank(userId: string, timeframe: 'weekly' | 'monthly'): Promise<{ rank: number; total: number }> {
    const response = await fetch(`${this.apiBaseUrl}/social/rank/${userId}?timeframe=${timeframe}`);
    if (!response.ok) throw new Error('Failed to fetch rank');
    return response.json();
  }

  /**
   * Get active challenges
   */
  async getChallenges(status?: 'active' | 'upcoming' | 'completed'): Promise<Challenge[]> {
    const url = status 
      ? `${this.apiBaseUrl}/social/challenges?status=${status}`
      : `${this.apiBaseUrl}/social/challenges`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch challenges');
    return response.json();
  }

  /**
   * Join a challenge
   */
  async joinChallenge(userId: string, challengeId: string): Promise<ChallengeParticipation> {
    const response = await fetch(`${this.apiBaseUrl}/social/challenges/${challengeId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) throw new Error('Failed to join challenge');
    return response.json();
  }

  /**
   * Get challenge participation
   */
  async getChallengeProgress(userId: string, challengeId: string): Promise<ChallengeParticipation> {
    const response = await fetch(`${this.apiBaseUrl}/social/challenges/${challengeId}/progress/${userId}`);
    if (!response.ok) throw new Error('Failed to fetch progress');
    return response.json();
  }

  /**
   * Update challenge progress
   */
  async updateChallengeProgress(userId: string, challengeId: string, progress: number): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/social/challenges/${challengeId}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, progress }),
    });
    if (!response.ok) throw new Error('Failed to update progress');
  }

  /**
   * Find accountability partner
   */
  async findAccountabilityPartner(userId: string, preferences: { goals?: string[]; timezone?: string }): Promise<AccountabilityPartner[]> {
    const response = await fetch(`${this.apiBaseUrl}/social/partners/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...preferences }),
    });
    if (!response.ok) throw new Error('Failed to find partners');
    return response.json();
  }

  /**
   * Send partner request
   */
  async sendPartnerRequest(userId: string, targetUserId: string, message?: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/social/partners/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, targetUserId, message }),
    });
    if (!response.ok) throw new Error('Failed to send request');
  }

  /**
   * Accept partner request
   */
  async acceptPartnerRequest(requestId: string): Promise<AccountabilityPartner> {
    const response = await fetch(`${this.apiBaseUrl}/social/partners/${requestId}/accept`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to accept request');
    return response.json();
  }

  /**
   * Check in with accountability partner
   */
  async checkInWithPartner(partnerId: string, userId: string, update: { completedSessions?: number; focusMinutes?: number; notes?: string }): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/social/partners/${partnerId}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...update }),
    });
    if (!response.ok) throw new Error('Failed to check in');
  }

  /**
   * Create focus room
   */
  async createFocusRoom(hostId: string, roomData: Omit<FocusRoom, 'id' | 'members' | 'isActive'>): Promise<FocusRoom> {
    const response = await fetch(`${this.apiBaseUrl}/social/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: hostId, ...roomData, members: [], isActive: false }),
    });
    if (!response.ok) throw new Error('Failed to create room');
    return response.json();
  }

  /**
   * Join focus room
   */
  async joinFocusRoom(roomId: string, userId: string): Promise<FocusRoom> {
    const response = await fetch(`${this.apiBaseUrl}/social/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) throw new Error('Failed to join room');
    return response.json();
  }

  /**
   * Leave focus room
   */
  async leaveFocusRoom(roomId: string, userId: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/social/rooms/${roomId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) throw new Error('Failed to leave room');
  }

  /**
   * Start room session
   */
  async startRoomSession(roomId: string, duration: number): Promise<FocusRoom> {
    const response = await fetch(`${this.apiBaseUrl}/social/rooms/${roomId}/start-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration }),
    });
    if (!response.ok) throw new Error('Failed to start session');
    return response.json();
  }

  /**
   * Get activity feed
   */
  async getActivityFeed(limit: number = 20, offset: number = 0): Promise<ActivityFeedItem[]> {
    const response = await fetch(`${this.apiBaseUrl}/social/feed?limit=${limit}&offset=${offset}`);
    if (!response.ok) throw new Error('Failed to fetch feed');
    return response.json();
  }

  /**
   * Like activity
   */
  async likeActivity(activityId: string, userId: string): Promise<number> {
    const response = await fetch(`${this.apiBaseUrl}/social/feed/${activityId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) throw new Error('Failed to like activity');
    const data = await response.json();
    return data.likes;
  }

  /**
   * Award badge to user
   */
  async awardBadge(userId: string, badge: Omit<Badge, 'earnedAt'>): Promise<Badge> {
    const response = await fetch(`${this.apiBaseUrl}/social/badges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...badge, earnedAt: new Date() }),
    });
    if (!response.ok) throw new Error('Failed to award badge');
    return response.json();
  }

  /**
   * Get user badges
   */
  async getUserBadges(userId: string): Promise<Badge[]> {
    const response = await fetch(`${this.apiBaseUrl}/social/badges/${userId}`);
    if (!response.ok) throw new Error('Failed to fetch badges');
    return response.json();
  }
}

// Export singleton instance
export const socialService = new SocialService();

export default SocialService;
