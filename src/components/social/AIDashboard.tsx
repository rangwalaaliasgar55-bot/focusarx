import React, { useState } from 'react';
import { useAIRecommendations, useFocusSessionTracker, useSmartBreakReminder } from '../hooks/useAI';

interface AIDashboardProps {
  onSessionStart?: () => void;
  onSessionEnd?: () => void;
}

const AIDashboard: React.FC<AIDashboardProps> = ({ onSessionStart, onSessionEnd }) => {
  const {
    recommendations,
    productivityScore,
    peakHours,
    optimalDuration,
    distractionTriggers,
    breakSuggestion,
    isLoading,
    refreshRecommendations
  } = useAIRecommendations();

  const {
    currentSession,
    sessionCount,
    startSession,
    endSession,
    recordDistraction,
    completeTask
  } = useFocusSessionTracker();

  const {
    formattedTime,
    isActive,
    isBreakTime,
    startTimer,
    pauseTimer,
    resetTimer
  } = useSmartBreakReminder(optimalDuration);

  const [taskInput, setTaskInput] = useState('');

  const handleStartSession = () => {
    const sessionId = `session-${Date.now()}`;
    startSession(sessionId);
    startTimer();
    if (onSessionStart) onSessionStart();
  };

  const handleEndSession = () => {
    endSession();
    resetTimer();
    if (onSessionEnd) onSessionEnd();
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (taskInput.trim()) {
      completeTask(taskInput.trim());
      setTaskInput('');
    }
  };

  const formatHour = (hour: number): string => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:00 ${ampm}`;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Moderate';
    return 'Needs Improvement';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-purple-300 text-lg">AI is analyzing your patterns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">AI Focus Dashboard</h1>
            <p className="text-purple-300">Your intelligent productivity companion</p>
          </div>
          <button
            onClick={refreshRecommendations}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Refresh Analysis
          </button>
        </div>

        {/* Productivity Score Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white mb-2">Productivity Score</h2>
              <p className="text-purple-300">Based on your recent focus sessions</p>
            </div>
            <div className="text-right">
              <div className={`text-6xl font-bold ${getScoreColor(productivityScore)}`}>
                {productivityScore}
              </div>
              <div className="text-purple-300 mt-1">{getScoreLabel(productivityScore)}</div>
            </div>
          </div>
          <div className="mt-4 bg-gray-700 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                productivityScore >= 80 ? 'bg-emerald-500' :
                productivityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${productivityScore}%` }}
            ></div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Session Control */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-semibold text-white mb-4">Focus Session</h2>
            
            {!currentSession ? (
              <div className="text-center py-8">
                <p className="text-purple-300 mb-4">Ready to start a focused work session?</p>
                <button
                  onClick={handleStartSession}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105"
                >
                  Start Focus Session
                </button>
                <p className="text-purple-400 mt-4 text-sm">
                  Optimal duration: {optimalDuration} minutes
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Session Status:</span>
                  <span className="text-green-400 font-semibold">Active</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Time Remaining:</span>
                  <span className="text-2xl font-mono text-white">{formattedTime}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={isActive ? pauseTimer : startTimer}
                    className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                  >
                    {isActive ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={recordDistraction}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Record Distraction ({currentSession.distractions || 0})
                  </button>
                </div>

                <form onSubmit={handleAddTask} className="flex gap-2">
                  <input
                    type="text"
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    placeholder="Complete a task..."
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </form>

                {currentSession.completedTasks && currentSession.completedTasks.length > 0 && (
                  <div>
                    <h3 className="text-white font-semibold mb-2">Completed Tasks:</h3>
                    <ul className="space-y-1">
                      {currentSession.completedTasks.map((task, index) => (
                        <li key={index} className="text-green-400 text-sm">✓ {task}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={handleEndSession}
                  className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  End Session
                </button>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-purple-300 text-sm">Total Sessions Completed: <span className="text-white font-semibold">{sessionCount}</span></p>
            </div>
          </div>

          {/* AI Recommendations */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-semibold text-white mb-4">AI Recommendations</h2>
            
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <div key={index} className="bg-purple-800/30 rounded-lg p-4 border border-purple-500/30">
                  <p className="text-purple-100">{rec}</p>
                </div>
              ))}
            </div>

            {peakHours.length > 0 && (
              <div className="mt-6">
                <h3 className="text-white font-semibold mb-2">Your Peak Hours:</h3>
                <div className="flex gap-2 flex-wrap">
                  {peakHours.map((hour) => (
                    <span
                      key={hour}
                      className="px-3 py-1 bg-purple-600 text-white rounded-full text-sm"
                    >
                      {formatHour(hour)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {distractionTriggers.length > 0 && distractionTriggers[0] !== 'Insufficient data for distraction analysis' && (
              <div className="mt-6">
                <h3 className="text-white font-semibold mb-2">Distraction Alerts:</h3>
                {distractionTriggers.map((trigger, index) => (
                  <div key={index} className="bg-red-800/30 rounded-lg p-3 border border-red-500/30 mb-2">
                    <p className="text-red-200 text-sm">⚠️ {trigger}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Break Suggestion */}
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 backdrop-blur-lg rounded-2xl p-6 border border-blue-400/30">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white mb-2">Smart Break Suggestion</h2>
              <p className="text-blue-300">Based on your session duration and mood</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-400">{breakSuggestion}</div>
              <p className="text-blue-300 text-sm mt-1">Recommended activity</p>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 text-center">
            <div className="text-4xl font-bold text-purple-400 mb-2">{optimalDuration}</div>
            <div className="text-purple-300">Optimal Duration (min)</div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 text-center">
            <div className="text-4xl font-bold text-pink-400 mb-2">{peakHours.length}</div>
            <div className="text-pink-300">Peak Hours Identified</div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 text-center">
            <div className="text-4xl font-bold text-emerald-400 mb-2">
              {currentSession?.completedTasks?.length || 0}
            </div>
            <div className="text-emerald-300">Tasks This Session</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIDashboard;
