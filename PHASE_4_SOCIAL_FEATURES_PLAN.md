# Phase 4: Social & Community Features - Implementation Plan

## Overview
Building collaborative features to enhance user engagement through social accountability and community-driven productivity.

## Features to Implement

### 1. Focus Rooms (Real-time Collaboration)
**File**: `/src/components/social/FocusRoom.tsx`

Features:
- Create/join focus rooms with unique codes
- Real-time participant count display
- Shared session timers
- Video/audio optional (WebRTC)
- Chat for accountability check-ins
- Room types: Public, Private, Friends-only

Technical Stack:
- Socket.io for real-time sync
- WebRTC for video/audio
- Redis for room state management

### 2. Achievement Sharing System
**File**: `/src/components/social/AchievementShare.tsx`

Features:
- Share milestones to social feed
- Auto-generated achievement cards
- Social media integration (Twitter, LinkedIn)
- Customizable share templates
- Emoji reactions from community

### 3. Team Challenges
**File**: `/src/components/social/TeamChallenge.tsx`

Features:
- Create team-based focus challenges
- Leaderboards for teams
- Weekly/monthly competitions
- Prize pools (gamification currency)
- Team chat and coordination

### 4. Accountability Partners
**File**: `/src/hooks/useAccountabilityPartner.ts`

Features:
- Pair with accountability partner
- Daily check-in reminders
- Progress sharing
- Mutual goal setting
- Partner matching algorithm

### 5. Community Feed
**File**: `/src/components/social/CommunityFeed.tsx`

Features:
- Activity stream of community achievements
- Filter by friends/following/global
- Comment and react system
- Trending focus sessions
- Featured users of the week

## Implementation Priority

1. ✅ **AI Dashboard** (Phase 3 - Complete)
2. 🔄 **Focus Rooms** (Next - High Priority)
3. ⏳ **Achievement Sharing** (Medium Priority)
4. ⏳ **Community Feed** (Medium Priority)
5. ⏳ **Accountability Partners** (Low Priority)
6. ⏳ **Team Challenges** (Low Priority)

## Database Schema Updates Required

```sql
-- Focus Rooms
CREATE TABLE focus_rooms (
  id UUID PRIMARY KEY,
  name VARCHAR(100),
  code VARCHAR(10) UNIQUE,
  creator_id UUID REFERENCES users(id),
  max_participants INT DEFAULT 10,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  active BOOLEAN DEFAULT true
);

-- Room Participants
CREATE TABLE room_participants (
  room_id UUID REFERENCES focus_rooms(id),
  user_id UUID REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  PRIMARY KEY (room_id, user_id)
);

-- Achievements
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  achievement_type VARCHAR(50),
  metadata JSONB,
  earned_at TIMESTAMP DEFAULT NOW(),
  shared BOOLEAN DEFAULT false
);

-- Community Posts
CREATE TABLE community_posts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  content TEXT,
  achievement_id UUID REFERENCES user_achievements(id),
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints Needed

```
POST   /api/rooms/create          - Create focus room
GET    /api/rooms/:code           - Join room by code
DELETE /api/rooms/:id             - Leave/close room
GET    /api/rooms/:id/participants - Get room participants

POST   /api/achievements/share    - Share achievement
GET    /api/feed                  - Get community feed
POST   /api/feed/:id/react        - React to post

POST   /api/partners/request      - Request partner
GET    /api/partners/matches      - Get potential matches
```

## UI Components

### FocusRoom Component
```tsx
<FocusRoom
  roomId={string}
  onJoin={() => void}
  onLeave={() => void}
  participants={User[]}
  sessionData={SessionData}
/>
```

### AchievementShare Component
```tsx
<AchievementShare
  achievement={Achievement}
  onShare={(platform) => void}
  showReactions={boolean}
/>
```

### CommunityFeed Component
```tsx
<CommunityFeed
  filter={'friends' | 'global' | 'trending'}
  onLoadMore={() => void}
  onPostClick={(post) => void}
/>
```

## Timeline Estimate

- **Week 1**: Focus Rooms (Socket.io integration)
- **Week 2**: Achievement System + Sharing
- **Week 3**: Community Feed + Reactions
- **Week 4**: Accountability Partners + Polish

## Success Metrics

- [ ] 50% of users join at least 1 focus room
- [ ] 30% share achievements weekly
- [ ] 20% have an accountability partner
- [ ] Average session duration increases by 25%
- [ ] User retention improves by 40%

---

*Ready to implement Phase 4 upon request*
