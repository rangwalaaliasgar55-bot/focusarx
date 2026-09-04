import React, { useState } from 'react';
import { 
  useUserProfile, 
  useLeaderboard, 
  useChallenges, 
  useAccountabilityPartners,
  useFocusRooms,
  useActivityFeed 
} from '../hooks/useSocial';

interface SocialHubProps {
  userId: string;
  onChallengeJoin?: (challengeId: string) => void;
  onSessionStart?: () => void;
}

const SocialHub: React.FC<SocialHubProps> = ({ userId, onChallengeJoin, onSessionStart }) => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'challenges' | 'partners' | 'rooms' | 'feed'>('leaderboard');
  
  const { profile, isLoading: profileLoading, refreshProfile } = useUserProfile(userId);
  const { leaderboard, userRank, isLoading: leaderboardLoading } = useLeaderboard(userId, 'weekly');
  const { challenges, participations, joinChallenge, isLoading: challengesLoading } = useChallenges(userId);
  const { partners, sendRequest, checkIn } = useAccountabilityPartners(userId);
  const { currentRoom, createRoom, joinRoom, leaveRoom, startSession } = useFocusRooms(userId);
  const { activities, likeActivity } = useActivityFeed();

  const renderLeaderboard = () => (
    <div className="space-y-6">
      {/* User Rank Card */}
      {userRank && (
        <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-2xl p-6 border border-purple-500/30">
          <h3 className="text-lg font-semibold text-white mb-2">Your Ranking</h3>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-purple-400">#{userRank.rank}</div>
            <div className="text-gray-300">out of {userRank.total} users this week</div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="bg-gray-900/50 rounded-2xl border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-xl font-bold text-white">Weekly Leaderboard</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Focus Minutes</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Sessions</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {leaderboard.map((entry, idx) => (
                <tr 
                  key={entry.user.id}
                  className={`${entry.user.id === userId ? 'bg-purple-900/20' : 'hover:bg-gray-800/30'} transition-colors`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-lg font-bold ${idx < 3 ? 'text-yellow-400' : 'text-gray-400'}`}>
                      {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {entry.user.avatar && (
                        <img src={entry.user.avatar} alt={entry.user.username} className="w-10 h-10 rounded-full" />
                      )}
                      <span className="text-white font-medium">{entry.user.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-purple-400 font-semibold">
                    {entry.focusMinutes.toLocaleString()} min
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-300">
                    {entry.sessionsCompleted}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-orange-400">
                    🔥 {entry.weeklyStreak} days
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderChallenges = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {challenges.map((challenge) => {
        const participation = participations.find(p => p.challengeId === challenge.id);
        const progress = participation?.progress || 0;
        const percentage = Math.min(100, Math.round((progress / challenge.goal) * 100));

        return (
          <div 
            key={challenge.id}
            className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-2xl p-6 border border-indigo-500/30 hover:border-indigo-400/50 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">{challenge.title}</h3>
                <p className="text-sm text-gray-300">{challenge.description}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                challenge.type === 'global' ? 'bg-yellow-500/20 text-yellow-400' :
                challenge.type === 'team' ? 'bg-blue-500/20 text-blue-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                {challenge.type}
              </span>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Progress</span>
                <span className="text-white font-semibold">{percentage}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs mt-2 text-gray-400">
                <span>{progress} {challenge.unit}</span>
                <span>Goal: {challenge.goal} {challenge.unit}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                📅 Ends {new Date(challenge.endDate).toLocaleDateString()}
              </div>
              {!participation ? (
                <button
                  onClick={() => {
                    joinChallenge(challenge.id);
                    onChallengeJoin?.(challenge.id);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                >
                  Join Challenge
                </button>
              ) : (
                <button className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg font-medium cursor-not-allowed">
                  Joined
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderPartners = () => (
    <div className="space-y-6">
      <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Accountability Partners</h3>
        {partners.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🤝</div>
            <h4 className="text-lg font-semibold text-white mb-2">No partners yet</h4>
            <p className="text-gray-400 mb-4">Find someone with similar goals to keep you accountable</p>
            <button 
              onClick={() => sendRequest('user-id', 'Let\'s be accountability partners!')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              Find a Partner
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {partners.map((partner) => (
              <div key={partner.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
                <div className="flex items-center gap-4">
                  {partner.user.avatar && (
                    <img src={partner.user.avatar} alt={partner.user.username} className="w-12 h-12 rounded-full" />
                  )}
                  <div>
                    <h4 className="font-semibold text-white">{partner.user.username}</h4>
                    <p className="text-sm text-gray-400">Streak together: 🔥 {partner.streakTogether} days</p>
                  </div>
                </div>
                <button
                  onClick={() => checkIn(partner.id, { focusMinutes: 50, completedSessions: 2 })}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  Check In
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderRooms = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Focus Rooms</h3>
        <button
          onClick={() => createRoom({ name: 'Deep Work Session', description: 'Quiet focus time', maxMembers: 8, rules: ['No chatting', 'Cameras optional'] })}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Create Room
        </button>
      </div>

      {currentRoom ? (
        <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 rounded-2xl p-6 border border-blue-500/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-lg font-bold text-white">{currentRoom.name}</h4>
              <p className="text-sm text-gray-300">{currentRoom.members.length}/{currentRoom.maxMembers} members</p>
            </div>
            <button
              onClick={() => leaveRoom(currentRoom.id)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Leave Room
            </button>
          </div>
          <button
            onClick={() => startSession(currentRoom.id, 25)}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
          >
            Start Focus Session
          </button>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-900/50 rounded-2xl border border-gray-700">
          <div className="text-6xl mb-4">🎯</div>
          <h4 className="text-lg font-semibold text-white mb-2">No active room</h4>
          <p className="text-gray-400">Create or join a focus room to start collaborating</p>
        </div>
      )}
    </div>
  );

  const renderFeed = () => (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-start gap-3">
            {activity.user.avatar && (
              <img src={activity.user.avatar} alt={activity.user.username} className="w-10 h-10 rounded-full" />
            )}
            <div className="flex-1">
              <p className="text-white">
                <span className="font-semibold">{activity.user.username}</span>{' '}
                <span className="text-gray-300">{activity.message}</span>
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                <span>{new Date(activity.timestamp).toLocaleTimeString()}</span>
                <button 
                  onClick={() => likeActivity(activity.id)}
                  className="flex items-center gap-1 hover:text-red-400 transition-colors"
                >
                  ❤️ {activity.likes}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Profile Header */}
      {!profileLoading && profile && (
        <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-2xl p-6 mb-8 border border-purple-500/30">
          <div className="flex items-center gap-6">
            {profile.avatar && (
              <img src={profile.avatar} alt={profile.username} className="w-20 h-20 rounded-full border-4 border-purple-500" />
            )}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-2">{profile.username}</h2>
              <div className="flex items-center gap-6 text-gray-300">
                <span>Level {profile.level}</span>
                <span>🔥 {profile.streakDays} day streak</span>
                <span>⏱️ {profile.totalFocusMinutes.toLocaleString()} min focused</span>
                <span>🏆 {profile.badges.length} badges</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {[
          { id: 'leaderboard', label: '🏆 Leaderboard' },
          { id: 'challenges', label: '⚔️ Challenges' },
          { id: 'partners', label: '🤝 Partners' },
          { id: 'rooms', label: '🎯 Focus Rooms' },
          { id: 'feed', label: '📢 Activity Feed' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 rounded-xl font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'leaderboard' && renderLeaderboard()}
        {activeTab === 'challenges' && renderChallenges()}
        {activeTab === 'partners' && renderPartners()}
        {activeTab === 'rooms' && renderRooms()}
        {activeTab === 'feed' && renderFeed()}
      </div>
    </div>
  );
};

export default SocialHub;
