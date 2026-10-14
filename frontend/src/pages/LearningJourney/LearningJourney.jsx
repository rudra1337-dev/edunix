import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import learningPlanService, {
  ITEM_STATUSES,
  calculateProgress,
} from '../../services/learning/learningPlanService';
import syncEngine from '../../services/sync/syncEngine';
import './LearningJourney.css';

export const LearningJourney = () => {
  const { user } = useAuth();
  const userId = user?.id || 'local-user';

  const [plan, setPlan] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [syncState, setSyncState] = useState(syncEngine.state);

  // Load plan from IndexedDB
  const loadPlan = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const activePlan = await learningPlanService.getOrCreateActivePlan(userId);
      setPlan(activePlan);
    } catch (err) {
      console.error('[LearningJourney] Error loading plan:', err);
      setErrorMsg(err.message || 'Failed to load learning plan from local storage.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  // Subscribe to syncEngine
  useEffect(() => {
    syncEngine.initialize();
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState({ ...state });
    });
    return () => unsubscribe();
  }, []);

  // Handle status transitions
  const handleTransition = async (itemId, targetStatus) => {
    if (!plan) return;
    try {
      setErrorMsg(null);
      const result = await learningPlanService.updateItemStatus({
        userId,
        planId: plan.id,
        itemId,
        newStatus: targetStatus,
      });

      if (result.changed) {
        setPlan(result.plan);
        // Trigger non-blocking background sync
        syncEngine.triggerSync(userId).catch(console.error);
      }
    } catch (err) {
      console.error('[LearningJourney] Transition error:', err);
      setErrorMsg(err.message || 'Status transition could not be applied.');
    }
  };

  const items = plan?.items || [];
  const stats = calculateProgress(items);

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  if (loading) {
    return (
      <div className="journey-page">
        <div className="auth-loading-screen">
          <div className="auth-spinner" />
          <p>Loading your offline learning roadmap from IndexedDB...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="journey-page">
      {/* Top Header Card */}
      <header className="journey-header">
        <div className="journey-header-main">
          <div className="journey-badge">🗺️ Adaptive Learning Roadmap</div>
          <h1 className="journey-title">{plan?.title || 'Learning Roadmap'}</h1>
          <p className="journey-goal">{plan?.goal}</p>
        </div>

        {/* Sync Status Pill */}
        <button
          type="button"
          onClick={() => syncEngine.triggerSync(userId)}
          className={`journey-sync-badge ${
            syncState.pendingCount > 0 ? 'journey-sync-badge--pending' : ''
          }`}
          title="Click to sync pending IndexedDB changes with cloud"
        >
          {syncState.isSyncing ? (
            <span>🔄 Syncing...</span>
          ) : syncState.pendingCount > 0 ? (
            <span>⚡ {syncState.pendingCount} Changes Queued (Offline)</span>
          ) : (
            <span>✓ In Sync with Cloud</span>
          )}
        </button>
      </header>

      {/* Error Banner */}
      {errorMsg && (
        <div className="auth-alert auth-alert--error" style={{ marginBottom: '1.5rem' }}>
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Progress Overview Card */}
      <section className="progress-card" aria-label="Progress Overview">
        <div className="progress-header">
          <span className="progress-label">Curriculum Mastery</span>
          <span className="progress-percentage">{stats.percentage}%</span>
        </div>

        <div
          className="progress-bar-track"
          role="progressbar"
          aria-valuenow={stats.percentage}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div className="progress-bar-fill" style={{ width: `${stats.percentage}%` }} />
        </div>

        <div className="progress-stats-grid">
          <div className="stat-box">
            <span className="stat-number">{stats.total}</span>
            <span className="stat-label">Total Topics</span>
          </div>
          <div className="stat-box">
            <span className="stat-number stat-number--completed">{stats.completed}</span>
            <span className="stat-label">Completed</span>
          </div>
          <div className="stat-box">
            <span className="stat-number stat-number--progress">{stats.inProgress}</span>
            <span className="stat-label">In Progress</span>
          </div>
          <div className="stat-box">
            <span className="stat-number stat-number--review">{stats.review}</span>
            <span className="stat-label">Needs Review</span>
          </div>
          <div className="stat-box">
            <span className="stat-number stat-number--notstarted">{stats.notStarted}</span>
            <span className="stat-label">Remaining</span>
          </div>
        </div>
      </section>

      {/* Filter Tabs */}
      <div className="checklist-filter-bar" role="tablist">
        <button
          type="button"
          className={`filter-btn ${filter === 'all' ? 'filter-btn--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Topics ({stats.total})
        </button>
        <button
          type="button"
          className={`filter-btn ${filter === ITEM_STATUSES.IN_PROGRESS ? 'filter-btn--active' : ''}`}
          onClick={() => setFilter(ITEM_STATUSES.IN_PROGRESS)}
        >
          In Progress ({stats.inProgress})
        </button>
        <button
          type="button"
          className={`filter-btn ${filter === ITEM_STATUSES.REVIEW ? 'filter-btn--active' : ''}`}
          onClick={() => setFilter(ITEM_STATUSES.REVIEW)}
        >
          Review Needed ({stats.review})
        </button>
        <button
          type="button"
          className={`filter-btn ${filter === ITEM_STATUSES.COMPLETED ? 'filter-btn--active' : ''}`}
          onClick={() => setFilter(ITEM_STATUSES.COMPLETED)}
        >
          Completed ({stats.completed})
        </button>
      </div>

      {/* Interactive Checklist Container */}
      <div className="checklist-container">
        {filteredItems.map((item) => {
          const isCompleted = item.status === ITEM_STATUSES.COMPLETED;
          const isInProgress = item.status === ITEM_STATUSES.IN_PROGRESS;
          const isReview = item.status === ITEM_STATUSES.REVIEW;
          const isNotStarted = item.status === ITEM_STATUSES.NOT_STARTED;

          return (
            <div
              key={item.id}
              className={`checklist-item checklist-item--${item.status}`}
            >
              {/* Accessible Checkbox */}
              <div className="checklist-checkbox-wrapper">
                <input
                  type="checkbox"
                  id={`check-${item.id}`}
                  checked={isCompleted}
                  className="item-checkbox"
                  onChange={() => {
                    if (isCompleted) {
                      handleTransition(item.id, ITEM_STATUSES.REVIEW);
                    } else if (isInProgress || isReview) {
                      handleTransition(item.id, ITEM_STATUSES.COMPLETED);
                    } else {
                      handleTransition(item.id, ITEM_STATUSES.IN_PROGRESS);
                    }
                  }}
                  aria-label={`Mark ${item.title} as completed`}
                />
              </div>

              {/* Topic Information */}
              <div className="checklist-item-content">
                <div className="item-title-row">
                  <label htmlFor={`check-${item.id}`} className="item-title">
                    {item.order}. {item.title}
                  </label>
                  <span className={`item-status-pill item-status-pill--${item.status}`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </div>

                <p className="item-desc">{item.description}</p>

                <div className="item-meta">
                  {item.completedAt && (
                    <span>
                      ✓ Completed:{' '}
                      {new Date(item.completedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                  {isReview && item.reviewMetadata?.reviewCount > 0 && (
                    <span>🔄 Reviewed {item.reviewMetadata.reviewCount} time(s)</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="checklist-item-actions">
                {isNotStarted && (
                  <button
                    type="button"
                    className="item-action-btn item-action-btn--primary"
                    onClick={() => handleTransition(item.id, ITEM_STATUSES.IN_PROGRESS)}
                  >
                    ▶ Start Learning
                  </button>
                )}

                {isInProgress && (
                  <>
                    <button
                      type="button"
                      className="item-action-btn"
                      onClick={() => handleTransition(item.id, ITEM_STATUSES.REVIEW)}
                      title="Move topic into review queue"
                    >
                      🔄 Needs Revision
                    </button>
                    <button
                      type="button"
                      className="item-action-btn item-action-btn--primary"
                      onClick={() => handleTransition(item.id, ITEM_STATUSES.COMPLETED)}
                    >
                      ✓ Mark Mastered
                    </button>
                  </>
                )}

                {isReview && (
                  <button
                    type="button"
                    className="item-action-btn item-action-btn--review"
                    onClick={() => handleTransition(item.id, ITEM_STATUSES.COMPLETED)}
                  >
                    ✓ Complete Revision
                  </button>
                )}

                {isCompleted && (
                  <button
                    type="button"
                    className="item-action-btn"
                    onClick={() => handleTransition(item.id, ITEM_STATUSES.REVIEW)}
                    title="Request a refresher review for this mastered concept"
                  >
                    🔄 Revisit Topic
                  </button>
                )}

                <Link
                  to="/chat"
                  className="item-action-btn"
                  title="Ask Edunix AI tutor about this topic"
                >
                  💬 Ask AI Tutor
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LearningJourney;
