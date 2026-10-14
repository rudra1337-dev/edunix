import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import learningPlanService from '../../services/learning/learningPlanService';
import learningEventRepository from '../../services/storage/learningEventRepository';
import syncEngine from '../../services/sync/syncEngine';
import progressAnalyticsService from '../../services/analytics/progressAnalyticsService';

// Interactive Analytics Components
import ProgressRingChart from '../../components/Progress/ProgressRingChart';
import ActivityTimelineChart from '../../components/Progress/ActivityTimelineChart';
import RoadmapComparisonChart from '../../components/Progress/RoadmapComparisonChart';
import StatusDistributionChart from '../../components/Progress/StatusDistributionChart';
import SectionProgressBars from '../../components/Progress/SectionProgressBars';
import AttentionMatrix from '../../components/Progress/AttentionMatrix';
import FocusNextCard from '../../components/Progress/FocusNextCard';
import LearningInsightsList from '../../components/Progress/LearningInsightsList';

import './Progress.css';

export const Progress = () => {
  const { user } = useAuth();
  const userId = user?.id || 'local-user';
  const userName = user?.name || 'Learner';

  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('all');
  const [events, setEvents] = useState([]);
  const [timelineRange, setTimelineRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [syncState, setSyncState] = useState(syncEngine.state);

  // Load all user roadmaps and real learning events from local IndexedDB
  const loadAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      // Ensure active starter roadmap exists
      await learningPlanService.getOrCreateActivePlan(userId);

      const [allPlans, recentEvents] = await Promise.all([
        learningPlanService.getPlans(userId),
        learningEventRepository.getEvents(userId, 150),
      ]);

      setPlans(allPlans || []);
      setEvents(recentEvents || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[Progress] Error loading analytics data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  // Subscribe to syncEngine for real-time offline/online sync state
  useEffect(() => {
    syncEngine.initialize();
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState({ ...state });
    });
    return () => unsubscribe();
  }, []);

  // Filtered active plans
  const activePlans = useMemo(() => {
    return progressAnalyticsService.filterActivePlans(plans);
  }, [plans]);

  // Active or selected roadmap
  const selectedPlan = useMemo(() => {
    if (selectedPlanId === 'all') return null;
    return activePlans.find((p) => p.id === selectedPlanId) || null;
  }, [activePlans, selectedPlanId]);

  // Derived Analytics Datasets (Pure & Deterministic)
  const metrics = useMemo(() => {
    if (selectedPlan) {
      return progressAnalyticsService.calculateRoadmapMetrics(selectedPlan, events);
    }
    return progressAnalyticsService.calculateOverallMetrics(activePlans, events);
  }, [selectedPlan, activePlans, events]);

  const targetTopics = useMemo(() => {
    if (selectedPlan) {
      return (selectedPlan.items || []).map((t) => ({
        ...t,
        roadmapId: selectedPlan.id,
        roadmapTitle: selectedPlan.title,
      }));
    }
    return progressAnalyticsService.extractAllTopics(activePlans);
  }, [selectedPlan, activePlans]);

  const statusDistribution = useMemo(() => {
    return progressAnalyticsService.calculateStatusDistribution(targetTopics);
  }, [targetTopics]);

  const timelineData = useMemo(() => {
    const relevantEvents = selectedPlan
      ? events.filter((e) => e.learningPlanId === selectedPlan.id)
      : events;
    return progressAnalyticsService.calculateActivityTimeline(
      relevantEvents,
      targetTopics,
      timelineRange
    );
  }, [selectedPlan, events, targetTopics, timelineRange]);

  const comparisonData = useMemo(() => {
    return progressAnalyticsService.calculateRoadmapComparison(activePlans);
  }, [activePlans]);

  const sectionProgress = useMemo(() => {
    if (!selectedPlan) return [];
    return progressAnalyticsService.calculateSectionProgress(selectedPlan);
  }, [selectedPlan]);

  const attentionData = useMemo(() => {
    return progressAnalyticsService.getAttentionTopics(selectedPlan ? [selectedPlan] : activePlans);
  }, [selectedPlan, activePlans]);

  const recommendation = useMemo(() => {
    return progressAnalyticsService.getStudyRecommendation(
      selectedPlan ? [selectedPlan] : activePlans
    );
  }, [selectedPlan, activePlans]);

  const insights = useMemo(() => {
    return progressAnalyticsService.deriveLearningInsights(metrics, activePlans, events);
  }, [metrics, activePlans, events]);

  if (loading) {
    return (
      <div className="progress-page">
        <div className="auth-loading-screen">
          <div className="auth-spinner" />
          <p>Calculating your personalized learning metrics from local memory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="progress-page">
      {/* --------------------------------------------------------------------
          1. PAGE HEADER & FILTER CONTROLS
          -------------------------------------------------------------------- */}
      <header className="progress-page-header">
        <div className="header-title-group">
          <div className="header-badge-row">
            <span className="badge-analytics">📊 Personalized Learning Analytics</span>
            <span
              className={`badge-sync-state ${
                syncState.pendingCount > 0 ? 'badge-sync-state--pending' : ''
              }`}
              title={
                syncState.isOnline
                  ? 'All changes synchronized to server'
                  : 'Operating locally in offline mode'
              }
            >
              {syncState.isOnline ? '🟢 Online & Synced' : '⚡ Offline Mode (IndexedDB)'}
            </span>
          </div>

          <h1 className="progress-page-title">Learning Progress</h1>
          <p className="progress-page-subtitle">
            Welcome back, {userName}. Here is a complete analysis of your curriculum completion,
            retention schedules, and recommended study steps.
          </p>
        </div>

        <div className="header-controls">
          <label className="roadmap-filter-label">
            Filter by Roadmap:
            <select
              className="roadmap-select-input"
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              aria-label="Filter progress by roadmap"
            >
              <option value="all">🌐 All Roadmaps (Overall View)</option>
              {activePlans.map((p) => {
                const pMetrics = progressAnalyticsService.calculateTopicMetrics(p.items || []);
                return (
                  <option key={p.id} value={p.id}>
                    {p.title} ({pMetrics.topicCompletionRate}%)
                  </option>
                );
              })}
            </select>
          </label>

          <button
            type="button"
            className="btn-refresh"
            onClick={loadAnalyticsData}
            title="Recalculate metrics from local IndexedDB"
          >
            🔄 Recalculate
          </button>

          {lastUpdated && (
            <span className="last-updated-tag">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </header>

      {/* --------------------------------------------------------------------
          2. SUMMARY STATISTIC KPI CARDS
          -------------------------------------------------------------------- */}
      <div className="progress-kpi-grid">
        <div className="kpi-card">
          <span className="kpi-icon" style={{ color: '#34d399' }}>🎯</span>
          <div className="kpi-content">
            <span className="kpi-value">{metrics.topicCompletionRate}%</span>
            <span className="kpi-label">Mastery Rate</span>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-icon" style={{ color: '#10b981' }}>✅</span>
          <div className="kpi-content">
            <span className="kpi-value">
              {metrics.completedTopics} / {metrics.totalTopics}
            </span>
            <span className="kpi-label">Units Completed</span>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-icon" style={{ color: '#818cf8' }}>⚡</span>
          <div className="kpi-content">
            <span className="kpi-value">{metrics.inProgressTopics} Active</span>
            <span className="kpi-label">In Progress</span>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-icon" style={{ color: '#fbbf24' }}>🔄</span>
          <div className="kpi-content">
            <span className="kpi-value">{metrics.reviewTopics} Review</span>
            <span className="kpi-label">Needs Spaced Recall</span>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-icon" style={{ color: '#94a3b8' }}>⏳</span>
          <div className="kpi-content">
            <span className="kpi-value">{metrics.notStartedTopics} Upcoming</span>
            <span className="kpi-label">Not Started</span>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-icon" style={{ color: '#38bdf8' }}>📝</span>
          <div className="kpi-content">
            <span className="kpi-value">
              {metrics.completedSubtasks} / {metrics.totalSubtasks}
            </span>
            <span className="kpi-label">Checklist Tasks ({metrics.subtaskCompletionRate}%)</span>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-icon" style={{ color: '#c084fc' }}>📈</span>
          <div className="kpi-content">
            <span className="kpi-value">{metrics.totalEvents} Events</span>
            <span className="kpi-label">Study Actions Recorded</span>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------
          3. WHAT TO LEARN NEXT (HERO RECOMMENDATION)
          -------------------------------------------------------------------- */}
      <FocusNextCard recommendation={recommendation} />

      {/* --------------------------------------------------------------------
          4. TWO-COLUMN CHARTS: PROGRESS RING & STATUS DISTRIBUTION
          -------------------------------------------------------------------- */}
      <div className="dashboard-grid-2col">
        <ProgressRingChart
          percentage={metrics.topicCompletionRate}
          entries={statusDistribution.entries}
          totalTopics={metrics.totalTopics}
          title={selectedPlan ? `${selectedPlan.title} Progress` : 'Overall Curriculum Progress'}
          subtitle="Interactive completion ring with proportional status breakdown"
        />

        <StatusDistributionChart
          distribution={statusDistribution}
          title="Curriculum Status Distribution"
          subtitle="Breakdown of topics across active learning and spaced repetition states"
        />
      </div>

      {/* --------------------------------------------------------------------
          5. LEARNING ACTIVITY & PROGRESS OVER TIME (LINE / AREA CHART)
          -------------------------------------------------------------------- */}
      <ActivityTimelineChart
        timelineData={timelineData}
        activeRange={timelineRange}
        onRangeChange={setTimelineRange}
        title="Learning Trends Over Time"
        subtitle="Empirical activity timeline plotted from your study actions and completed topics"
      />

      {/* --------------------------------------------------------------------
          6. ROADMAP COMPARISON (OVERALL VIEW) OR SECTION PROGRESS (SINGLE VIEW)
          -------------------------------------------------------------------- */}
      {selectedPlan ? (
        <SectionProgressBars
          sections={sectionProgress}
          roadmapId={selectedPlan.id}
          title={`${selectedPlan.title} Modules Breakdown`}
          subtitle="Sequential progress through each section and module of this curriculum"
        />
      ) : (
        <RoadmapComparisonChart
          comparisonData={comparisonData}
          title="Roadmap Progress Comparison"
          subtitle="Compare completion rates and remaining topic workloads across all your roadmaps"
        />
      )}

      {/* --------------------------------------------------------------------
          7. TOPIC ATTENTION & LEARNING PRIORITIES MATRIX
          -------------------------------------------------------------------- */}
      <AttentionMatrix
        attentionData={attentionData}
        title="Topic Attention & Priorities"
        subtitle="Categorized view of units needing review, active modules, and ready prerequisites"
      />

      {/* --------------------------------------------------------------------
          8. PERSONALIZED LEARNING INSIGHTS (FACT-BASED)
          -------------------------------------------------------------------- */}
      <LearningInsightsList
        insights={insights}
        title="Personalized Learning Insights"
        subtitle="Actionable, evidence-based observations derived from your study milestones"
      />
    </div>
  );
};

export default Progress;
