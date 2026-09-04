import { useState, useEffect, useCallback } from 'react';
import { socialService, UserProfile, LeaderboardEntry, Challenge, ChallengeParticipation, AccountabilityPartner, FocusRoom, ActivityFeedItem } from '../services/social/SocialService';

interface UseUserProfileResult {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

interface UseLeaderboardResult {
  leaderboard: LeaderboardEntry[];
  userRank: { rank: number; total: number } | null;
  isLoading: boolean;
  error: string | null;
  refreshLeaderboard: () => Promise<void>;
}

interface UseChallengesResult {
  challenges: Challenge[];
  participations: ChallengeParticipation[];
  isLoading: boolean;
  error: string | null;
  joinChallenge: (challengeId: string) => Promise<void>;
  updateProgress: (challengeId: string, progress: number) => Promise<void>;
}

interface UseAccountabilityPartnersResult {
  partners: AccountabilityPartner[];
  pendingRequests: AccountabilityPartner[];
  isLoading: boolean;
  error: string | null;
  findPartners: (preferences: { goals?: string[]; timezone?: string }) => Promise<void>;
  sendRequest: (targetUserId: string, message?: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  checkIn: (partnerId: string, update: { completedSessions?: number; focusMinutes?: number; notes?: string }) => Promise<void>;
}

interface UseFocusRoomsResult {
  rooms: FocusRoom[];
  currentRoom: FocusRoom | null;
  isLoading: boolean;
  error: string | null;
  createRoom: (roomData: any) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  startSession: (roomId: string, duration: number) => Promise<void>;
}

interface UseActivityFeedResult {
  activities: ActivityFeedItem[];
  isLoading: boolean;
  error: string | null;
  likeActivity: (activityId: string) => Promise<void>;
  refreshFeed: () => Promise<void>;
}

/**
 * Hook for managing user profile
 */
export function useUserProfile(userId: string): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const data = await socialService.getUserProfile(userId);
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!userId) return;
    try {
      const updated = await socialService.updateUserProfile(userId, updates);
      setProfile(updated);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  return {
    profile,
    isLoading,
    error,
    refreshProfile: loadProfile,
    updateProfile,
  };
}

/**
 * Hook for leaderboard functionality
 */
export function useLeaderboard(userId?: string, timeframe: 'weekly' | 'monthly' | 'alltime' = 'weekly'): UseLeaderboardResult {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<{ rank: number; total: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [leaderboardData, rankData] = await Promise.all([
        socialService.getLeaderboard(timeframe),
        userId ? socialService.getUserRank(userId, timeframe) : Promise.resolve(null),
      ]);
      setLeaderboard(leaderboardData);
      setUserRank(rankData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, [userId, timeframe]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    leaderboard,
    userRank,
    isLoading,
    error,
    refreshLeaderboard: loadData,
  };
}

/**
 * Hook for challenges
 */
export function useChallenges(userId: string): UseChallengesResult {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [participations, setParticipations] = useState<ChallengeParticipation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadChallenges = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const [challengesData] = await Promise.all([
        socialService.getChallenges('active'),
      ]);
      setChallenges(challengesData);

      // Load participations for each challenge
      const participationPromises = challengesData.map(async (challenge) => {
        try {
          return await socialService.getChallengeProgress(userId, challenge.id);
        } catch {
          return null;
        }
      });
      const participationsData = await Promise.all(participationPromises);
      setParticipations(participationsData.filter(Boolean) as ChallengeParticipation[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load challenges');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  const joinChallenge = async (challengeId: string) => {
    if (!userId) return;
    try {
      const participation = await socialService.joinChallenge(userId, challengeId);
      setParticipations(prev => [...prev, participation]);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to join challenge');
    }
  };

  const updateProgress = async (challengeId: string, progress: number) => {
    if (!userId) return;
    try {
      await socialService.updateChallengeProgress(userId, challengeId, progress);
      setParticipations(prev => prev.map(p => 
        p.challengeId === challengeId ? { ...p, progress } : p
      ));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update progress');
    }
  };

  return {
    challenges,
    participations,
    isLoading,
    error,
    joinChallenge,
    updateProgress,
  };
}

/**
 * Hook for accountability partners
 */
export function useAccountabilityPartners(userId: string): UseAccountabilityPartnersResult {
  const [partners, setPartners] = useState<AccountabilityPartner[]>([]);
  const [pendingRequests, setPendingRequests] = useState<AccountabilityPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPartners = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);
    // Note: This is a simplified implementation
    // In production, you'd have separate endpoints for partners and requests
    setPartners([]);
    setPendingRequests([]);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  const findPartners = async (preferences: { goals?: string[]; timezone?: string }) => {
    if (!userId) return;
    try {
      const matches = await socialService.findAccountabilityPartner(userId, preferences);
      // You could show these in a UI for the user to select from
      console.log('Partner matches:', matches);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to find partners');
    }
  };

  const sendRequest = async (targetUserId: string, message?: string) => {
    if (!userId) return;
    try {
      await socialService.sendPartnerRequest(userId, targetUserId, message);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to send request');
    }
  };

  const acceptRequest = async (requestId: string) => {
    try {
      const partner = await socialService.acceptPartnerRequest(requestId);
      setPartners(prev => [...prev, partner]);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to accept request');
    }
  };

  const checkIn = async (partnerId: string, update: { completedSessions?: number; focusMinutes?: number; notes?: string }) => {
    if (!userId) return;
    try {
      await socialService.checkInWithPartner(partnerId, userId, update);
      // Update local state
      setPartners(prev => prev.map(p => 
        p.id === partnerId 
          ? { ...p, lastCheckIn: new Date(), streakTogether: p.streakTogether + 1 }
          : p
      ));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to check in');
    }
  };

  return {
    partners,
    pendingRequests,
    isLoading,
    error,
    findPartners,
    sendRequest,
    acceptRequest,
    checkIn,
  };
}

/**
 * Hook for focus rooms
 */
export function useFocusRooms(userId: string): UseFocusRoomsResult {
  const [rooms, setRooms] = useState<FocusRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<FocusRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);
    // Note: Simplified - in production you'd fetch active rooms
    setRooms([]);
    setCurrentRoom(null);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const createRoom = async (roomData: any) => {
    if (!userId) return;
    try {
      const room = await socialService.createFocusRoom(userId, roomData);
      setRooms(prev => [...prev, room]);
      setCurrentRoom(room);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create room');
    }
  };

  const joinRoom = async (roomId: string) => {
    if (!userId) return;
    try {
      const room = await socialService.joinFocusRoom(roomId, userId);
      setCurrentRoom(room);
      setRooms(prev => prev.map(r => r.id === roomId ? room : r));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to join room');
    }
  };

  const leaveRoom = async (roomId: string) => {
    if (!userId) return;
    try {
      await socialService.leaveFocusRoom(roomId, userId);
      if (currentRoom?.id === roomId) {
        setCurrentRoom(null);
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to leave room');
    }
  };

  const startSession = async (roomId: string, duration: number) => {
    try {
      const room = await socialService.startRoomSession(roomId, duration);
      setCurrentRoom(room);
      setRooms(prev => prev.map(r => r.id === roomId ? room : r));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to start session');
    }
  };

  return {
    rooms,
    currentRoom,
    isLoading,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    startSession,
  };
}

/**
 * Hook for activity feed
 */
export function useActivityFeed(): UseActivityFeedResult {
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await socialService.getActivityFeed(20);
      setActivities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const likeActivity = async (activityId: string) => {
    // Note: You'd need userId here in production
    try {
      const newLikes = await socialService.likeActivity(activityId, 'current-user-id');
      setActivities(prev => prev.map(a => 
        a.id === activityId ? { ...a, likes: newLikes } : a
      ));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to like activity');
    }
  };

  return {
    activities,
    isLoading,
    error,
    likeActivity,
    refreshFeed: loadFeed,
  };
}
