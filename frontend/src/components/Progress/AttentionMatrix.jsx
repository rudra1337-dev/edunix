import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Topic Attention & Learning Priorities Component
 * Helps learners identify units needing review, active units under study,
 * and upcoming modules whose prerequisites are satisfied.
 */
export const AttentionMatrix = ({
  attentionData = null,
  title = 'Topic Attention & Learning Priorities',
  subtitle = 'Prioritized units based on review schedules, active momentum, and prerequisite readiness',
}) => {
  const [activeTab, setActiveTab] = useState('review'); // 'review' | 'in_progress' | 'ready' | 'blocked'

  const {
    needsReview = [],
    inProgress = [],
    readyToStart = [],
    blocked = [],
  } = attentionData || {};

  const tabs = [
    { key: 'review', label: 'Needs Review', count: needsReview.length, icon: '🔄', color: '#f59e0b' },
    { key: 'in_progress', label: 'In Progress', count: inProgress.length, icon: '⚡', color: '#6366f1' },
    { key: 'ready', label: 'Ready to Start', count: readyToStart.length, icon: '🚀', color: '#10b981' },
    { key: 'blocked', label: 'Prerequisites Pending', count: blocked.length, icon: '⏳', color: '#64748b' },
  ];

  const currentList =
    activeTab === 'review'
      ? needsReview
      : activeTab === 'in_progress'
      ? inProgress
      : activeTab === 'ready'
      ? readyToStart
      : blocked;

  return (
    <div className="analytics-card attention-matrix-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">{title}</h3>
          <p className="analytics-card-subtitle">{subtitle}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="attention-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`attention-tab-btn ${activeTab === tab.key ? 'attention-tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            <span
              className="tab-count-badge"
              style={{
                background: activeTab === tab.key ? tab.color : 'rgba(255, 255, 255, 0.08)',
                color: activeTab === tab.key ? '#fff' : '#94a3b8',
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Panel */}
      <div className="attention-tab-content">
        {currentList.length === 0 ? (
          <div className="attention-empty-state">
            <span className="empty-icon">🎉</span>
            <p className="empty-title">
              {activeTab === 'review'
                ? 'No topics currently require review!'
                : activeTab === 'in_progress'
                ? 'No topics currently in progress.'
                : activeTab === 'ready'
                ? 'No unstarted topics ready.'
                : 'No topics are blocked by pending prerequisites.'}
            </p>
            <p className="empty-desc">
              {activeTab === 'review'
                ? 'Great job keeping up with active recall. Check upcoming topics to continue.'
                : 'Select an unlocked unit to continue your learning journey.'}
            </p>
          </div>
        ) : (
          <div className="attention-grid">
            {currentList.slice(0, 6).map((item) => (
              <div key={item.id} className="attention-topic-card">
                <div className="attention-card-header">
                  <span
                    className="attention-category-badge"
                    style={{
                      borderColor:
                        activeTab === 'review'
                          ? '#f59e0b'
                          : activeTab === 'in_progress'
                          ? '#6366f1'
                          : activeTab === 'ready'
                          ? '#10b981'
                          : '#64748b',
                      color:
                        activeTab === 'review'
                          ? '#f59e0b'
                          : activeTab === 'in_progress'
                          ? '#818cf8'
                          : activeTab === 'ready'
                          ? '#34d399'
                          : '#94a3b8',
                    }}
                  >
                    {item.badge}
                  </span>
                  {item.roadmapTitle && (
                    <span className="attention-roadmap-tag" title={item.roadmapTitle}>
                      {item.roadmapTitle}
                    </span>
                  )}
                </div>

                <h4 className="attention-topic-title">{item.title}</h4>
                <p className="attention-topic-reason">{item.reason}</p>

                {/* Subtask checklist progress preview if available */}
                {Array.isArray(item.checklist) && item.checklist.length > 0 && (
                  <div className="attention-checklist-bar">
                    <span className="checklist-subtext">
                      Checklist:{' '}
                      {item.checklist.filter((c) => c.completed).length} / {item.checklist.length}
                    </span>
                    <div className="mini-progress-track">
                      <div
                        className="mini-progress-fill"
                        style={{
                          width: `${Math.round(
                            (item.checklist.filter((c) => c.completed).length /
                              item.checklist.length) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="attention-card-footer">
                  {item.roadmapId && (
                    <Link
                      to={`/learning-journey/${item.roadmapId}`}
                      className="attention-action-btn"
                    >
                      Study Topic &rarr;
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttentionMatrix;
