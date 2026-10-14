import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import learningPlanService, {
  ITEM_STATUSES,
  calculateProgress,
} from '../../services/learning/learningPlanService';
import syncEngine from '../../services/sync/syncEngine';
import './LearningJourney.css';

export const LearningJourney = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || 'local-user';

  const [plans, setPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [syncState, setSyncState] = useState(syncEngine.state);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalTab, setModalTab] = useState('ai'); // 'ai' | 'manual'
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLevel, setAiLevel] = useState('Intermediate');
  const [aiDuration, setAiDuration] = useState('4 Weeks');
  const [manualForm, setManualForm] = useState({
    title: '',
    goal: '',
    estimatedDuration: '4 Weeks',
    targetAudience: 'All Learners',
  });

  // Load all user roadmaps
  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // Ensure active starter roadmap exists
      const currentActive = await learningPlanService.getOrCreateActivePlan(userId);
      setActivePlan(currentActive);

      // Get all roadmaps
      const allPlans = await learningPlanService.getPlans(userId);
      setPlans(allPlans);

      // Calculate next recommended step
      const rec = learningPlanService.getRecommendedNextStep(currentActive);
      setRecommendation(rec);
    } catch (err) {
      console.error('[LearningJourney] Error loading workspace:', err);
      setErrorMsg(err.message || 'Failed to load learning workspace.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // Subscribe to syncEngine
  useEffect(() => {
    syncEngine.initialize();
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState({ ...state });
    });
    return () => unsubscribe();
  }, []);

  // Handle Set Active
  const handleSetActive = async (planId) => {
    try {
      const updated = await learningPlanService.setActiveRoadmap({ userId, planId });

      // Update local state
      setActivePlan(updated);
      await loadWorkspace();
      syncEngine.triggerSync(userId).catch(console.error);
    } catch (err) {
      console.error('[LearningJourney] Set active error:', err);
      setErrorMsg(err.message || 'Failed to set active roadmap.');
    }
  };

  // Handle Delete
  const handleDeleteRoadmap = async (e, planId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this learning roadmap?')) {
      return;
    }

    try {
      await learningPlanService.deleteRoadmap({ userId, planId });
      await loadWorkspace();
      syncEngine.triggerSync(userId).catch(console.error);
    } catch (err) {
      console.error('[LearningJourney] Delete error:', err);
      setErrorMsg(err.message || 'Failed to delete roadmap.');
    }
  };

  // Handle AI Roadmap Generation
  const handleGenerateAIRoadmap = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim() || isGenerating) return;

    try {
      setIsGenerating(true);
      setErrorMsg(null);

      const generatedPlan = await learningPlanService.generateAIRoadmap({
        userId,
        prompt: aiPrompt.trim(),
        targetAudience: aiLevel,
        estimatedDuration: aiDuration,
      });

      setShowCreateModal(false);
      setAiPrompt('');
      syncEngine.triggerSync(userId).catch(console.error);
      navigate(`/learning-journey/${generatedPlan.id}`);
    } catch (err) {
      console.error('[LearningJourney] AI generation error:', err);
      setErrorMsg(err.message || 'Failed to generate roadmap with AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Manual Roadmap Creation
  const handleCreateManualRoadmap = async (e) => {
    e.preventDefault();
    if (!manualForm.title.trim()) return;

    try {
      setErrorMsg(null);
      const newPlan = await learningPlanService.createRoadmap({
        userId,
        title: manualForm.title.trim(),
        goal: manualForm.goal.trim() || 'Master topic concepts',
        estimatedDuration: manualForm.estimatedDuration,
        targetAudience: manualForm.targetAudience,
        sections: [
          {
            id: 'sec_1',
            title: '1. Fundamentals & Core Architecture',
            description: 'Core concepts and environment setup',
            order: 1,
            topics: [
              {
                id: `top_${Date.now()}_1`,
                title: 'Introduction & Setup',
                summary: 'Initial orientation and foundational concepts.',
                explanation: 'Getting started with practical examples and basic commands.',
                checklist: [{ id: 'chk_1', text: 'Review orientation guide', completed: false }],
                status: ITEM_STATUSES.NOT_STARTED,
              },
            ],
          },
        ],
      });

      setShowCreateModal(false);
      setManualForm({
        title: '',
        goal: '',
        estimatedDuration: '4 Weeks',
        targetAudience: 'All Learners',
      });
      syncEngine.triggerSync(userId).catch(console.error);
      navigate(`/learning-journey/${newPlan.id}`);
    } catch (err) {
      console.error('[LearningJourney] Manual creation error:', err);
      setErrorMsg(err.message || 'Failed to create roadmap.');
    }
  };

  // Filter roadmaps
  const filteredPlans = plans.filter((p) => {
    // Exclude archived/deleted
    if (p.isDeleted || p.isArchived || p.status === 'archived') return false;

    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (p.title || '').toLowerCase().includes(q);
      const matchGoal = (p.goal || '').toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchGoal && !matchDesc) return false;
    }

    // Status filter
    if (statusFilter === 'active') return p.id === activePlan?.id || p.status === 'active';
    if (statusFilter === 'completed') {
      const stats = calculateProgress(p.items || []);
      return stats.percentage === 100;
    }

    return true;
  });

  // Calculate workspace overall metrics
  const totalRoadmaps = plans.filter((p) => !p.isDeleted && !p.isArchived).length;
  const totalTopics = plans
    .filter((p) => !p.isDeleted && !p.isArchived)
    .reduce((sum, p) => sum + (p.items?.length || 0), 0);
  const completedTopics = plans
    .filter((p) => !p.isDeleted && !p.isArchived)
    .reduce(
      (sum, p) =>
        sum +
        (p.items || []).filter((i) => i.status === ITEM_STATUSES.COMPLETED).length,
      0
    );

  if (loading) {
    return (
      <div className="journey-workspace-page">
        <div className="auth-loading-screen">
          <div className="auth-spinner" />
          <p>Loading your offline learning workspace from IndexedDB...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="journey-workspace-page">
      {/* Workspace Header */}
      <header className="workspace-header">
        <div className="workspace-header-text">
          <div className="workspace-badge">🗺️ Personalized Learning Workspace</div>
          <h1 className="workspace-title">Your Learning Roadmaps</h1>
          <p className="workspace-subtitle">
            Structured, Notion-inspired learning paths with offline-first tracking and
            roadmap-aware AI tutoring.
          </p>
        </div>

        <div className="workspace-header-actions">
          {/* Cloud Sync Status */}
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
              <span>⚡ {syncState.pendingCount} Queued Offline</span>
            ) : (
              <span>✓ In Sync with Cloud</span>
            )}
          </button>

          {/* New Roadmap Button */}
          <button
            type="button"
            className="workspace-create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            + Create New Roadmap
          </button>
        </div>
      </header>

      {/* Error Alert */}
      {errorMsg && (
        <div className="auth-alert auth-alert--error" style={{ marginBottom: '1.5rem' }}>
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Global Workspace Statistics Bar */}
      <section className="workspace-kpi-bar" aria-label="Workspace Summary">
        <div className="kpi-metric">
          <span className="kpi-metric-val">{totalRoadmaps}</span>
          <span className="kpi-metric-lbl">Total Roadmaps</span>
        </div>
        <div className="kpi-metric">
          <span className="kpi-metric-val">{totalTopics}</span>
          <span className="kpi-metric-lbl">Curriculum Topics</span>
        </div>
        <div className="kpi-metric">
          <span className="kpi-metric-val kpi-metric-val--success">{completedTopics}</span>
          <span className="kpi-metric-lbl">Topics Mastered</span>
        </div>
        <div className="kpi-metric">
          <span className="kpi-metric-val kpi-metric-val--accent">
            {totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0}%
          </span>
          <span className="kpi-metric-lbl">Total Mastery</span>
        </div>
      </section>

      {/* Personalized Next Step Recommendation Card */}
      {recommendation?.topic && activePlan && (
        <section className="recommendation-banner" aria-label="Personalized Next Step">
          <div className="rec-icon">🎯</div>
          <div className="rec-content">
            <div className="rec-eyebrow">
              Recommended Next Step • {activePlan.title}
            </div>
            <h3 className="rec-title">{recommendation.topic.title}</h3>
            <p className="rec-reason">
              {recommendation.reason} —{' '}
              {recommendation.topic.summary || recommendation.topic.description}
            </p>
          </div>
          <div className="rec-actions">
            <Link
              to={`/learning-journey/${activePlan.id}`}
              className="rec-action-btn rec-action-btn--primary"
            >
              Resume Learning →
            </Link>
            <Link
              to={`/chat?prompt=${encodeURIComponent(
                `Can you guide me through "${recommendation.topic.title}" from my "${activePlan.title}" roadmap?`
              )}`}
              className="rec-action-btn rec-action-btn--ai"
            >
              ⚡ Ask AI Tutor
            </Link>
          </div>
        </section>
      )}

      {/* Search & Filter Toolbar */}
      <div className="workspace-toolbar">
        <div className="workspace-search-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="workspace-search-input"
            placeholder="Search roadmaps by title, skill, or goal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        <div className="workspace-filters">
          <button
            type="button"
            className={`ws-filter-btn ${statusFilter === 'all' ? 'ws-filter-btn--active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Roadmaps ({plans.length})
          </button>
          <button
            type="button"
            className={`ws-filter-btn ${
              statusFilter === 'active' ? 'ws-filter-btn--active' : ''
            }`}
            onClick={() => setStatusFilter('active')}
          >
            Active Focus
          </button>
          <button
            type="button"
            className={`ws-filter-btn ${
              statusFilter === 'completed' ? 'ws-filter-btn--active' : ''
            }`}
            onClick={() => setStatusFilter('completed')}
          >
            Mastered
          </button>
        </div>
      </div>

      {/* Roadmaps Grid */}
      {filteredPlans.length === 0 ? (
        <div className="workspace-empty-state">
          <div className="empty-icon">🗺️</div>
          <h3 className="empty-title">No Roadmaps Found</h3>
          <p className="empty-desc">
            {searchQuery
              ? `No roadmaps matching "${searchQuery}". Try a different keyword.`
              : 'You have not created any custom roadmaps yet. Start by generating one with AI!'}
          </p>
          <button
            type="button"
            className="workspace-create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            + Create New Roadmap
          </button>
        </div>
      ) : (
        <div className="roadmaps-grid">
          {filteredPlans.map((p) => {
            const stats = calculateProgress(p.items || []);
            const isActive = p.id === activePlan?.id;
            const sectionsCount = p.sections?.length || 1;

            return (
              <div
                key={p.id}
                className={`roadmap-card ${isActive ? 'roadmap-card--active' : ''}`}
              >
                {/* Card Header */}
                <div className="roadmap-card-header">
                  <div className="roadmap-card-badges">
                    {isActive ? (
                      <span className="card-badge card-badge--active">⚡ Active Focus</span>
                    ) : (
                      <span className="card-badge">Roadmap</span>
                    )}
                    <span className="card-badge card-badge--source">
                      {p.source === 'ai_generated' ? '✨ AI Generated' : '🛠️ Structured'}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="roadmap-card-delete"
                    onClick={(e) => handleDeleteRoadmap(e, p.id)}
                    title="Delete Roadmap"
                  >
                    🗑️
                  </button>
                </div>

                {/* Card Title & Goal */}
                <Link to={`/learning-journey/${p.id}`} className="roadmap-card-title-link">
                  <h3 className="roadmap-card-title">{p.title}</h3>
                </Link>
                <p className="roadmap-card-goal">{p.summary || p.goal}</p>

                {/* Metadata Pills */}
                <div className="roadmap-card-meta">
                  <span>⏱️ {p.estimatedDuration || '4-6 Weeks'}</span>
                  <span>🎯 {p.targetAudience || 'All Levels'}</span>
                  <span>📌 {sectionsCount} Sections</span>
                </div>

                {/* Progress Bar */}
                <div className="roadmap-card-progress">
                  <div className="card-prog-info">
                    <span className="card-prog-lbl">Curriculum Progress</span>
                    <span className="card-prog-pct">{stats.percentage}%</span>
                  </div>
                  <div className="card-prog-track">
                    <div
                      className="card-prog-fill"
                      style={{ width: `${stats.percentage}%` }}
                    />
                  </div>
                  <div className="card-prog-stats">
                    <span>
                      {stats.completed}/{stats.total} Topics Mastered
                    </span>
                    {stats.inProgress > 0 && <span>• {stats.inProgress} In Progress</span>}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="roadmap-card-actions">
                  <Link
                    to={`/learning-journey/${p.id}`}
                    className="card-action-btn card-action-btn--primary"
                  >
                    Open Document →
                  </Link>

                  {!isActive && (
                    <button
                      type="button"
                      className="card-action-btn"
                      onClick={() => handleSetActive(p.id)}
                      title="Set as primary active roadmap for AI tutor"
                    >
                      Set Active
                    </button>
                  )}

                  <Link
                    to={`/chat?prompt=${encodeURIComponent(
                      `Let's study the roadmap "${p.title}". Where should we begin?`
                    )}`}
                    className="card-action-btn card-action-btn--ai"
                    title="Ask AI tutor about this roadmap"
                  >
                    💬 Ask AI
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create New Roadmap Modal */}
      {showCreateModal && (
        <div className="workspace-modal-overlay">
          <div className="workspace-modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">Create Learning Roadmap</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="modal-tabs">
              <button
                type="button"
                className={`modal-tab-btn ${modalTab === 'ai' ? 'modal-tab-btn--active' : ''}`}
                onClick={() => setModalTab('ai')}
              >
                ✨ AI-Generated Roadmap
              </button>
              <button
                type="button"
                className={`modal-tab-btn ${
                  modalTab === 'manual' ? 'modal-tab-btn--active' : ''
                }`}
                onClick={() => setModalTab('manual')}
              >
                🛠️ Custom / Blank Document
              </button>
            </div>

            {/* Tab 1: AI Generated */}
            {modalTab === 'ai' ? (
              <form onSubmit={handleGenerateAIRoadmap} className="modal-form">
                <p className="modal-instructions">
                  Describe what you want to learn. Edunix AI will craft a Notion-style
                  structured curriculum with modules, terminal exercises, and checklist subtasks.
                </p>

                <div className="form-group">
                  <label htmlFor="aiPrompt">Learning Subject or Goal:</label>
                  <input
                    id="aiPrompt"
                    type="text"
                    required
                    placeholder="e.g. Linux Kernel Internals, Kubernetes Orchestration, Rust Async"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="aiLevel">Target Experience Level:</label>
                    <select
                      id="aiLevel"
                      value={aiLevel}
                      onChange={(e) => setAiLevel(e.target.value)}
                      disabled={isGenerating}
                    >
                      <option value="Beginner">Beginner (Foundations)</option>
                      <option value="Intermediate">Intermediate (Practitioner)</option>
                      <option value="Advanced">Advanced (Production Systems)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="aiDuration">Estimated Duration:</label>
                    <select
                      id="aiDuration"
                      value={aiDuration}
                      onChange={(e) => setAiDuration(e.target.value)}
                      disabled={isGenerating}
                    >
                      <option value="2 Weeks">2 Weeks (Intensive)</option>
                      <option value="4 Weeks">4 Weeks (Standard)</option>
                      <option value="8 Weeks">8 Weeks (Comprehensive)</option>
                    </select>
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="submit"
                    className="modal-submit-btn modal-submit-btn--ai"
                    disabled={isGenerating || !aiPrompt.trim()}
                  >
                    {isGenerating ? '⚡ Generating Curriculum...' : '✨ Generate Roadmap with AI'}
                  </button>
                  <button
                    type="button"
                    className="modal-cancel-btn"
                    onClick={() => setShowCreateModal(false)}
                    disabled={isGenerating}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              /* Tab 2: Manual / Custom */
              <form onSubmit={handleCreateManualRoadmap} className="modal-form">
                <div className="form-group">
                  <label htmlFor="manualTitle">Roadmap Title:</label>
                  <input
                    id="manualTitle"
                    type="text"
                    required
                    placeholder="e.g. Bash Automation & DevOps Tooling"
                    value={manualForm.title}
                    onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="manualGoal">Curriculum Goal / Summary:</label>
                  <input
                    id="manualGoal"
                    type="text"
                    placeholder="e.g. Master automation scripts, cron jobs, and CI/CD pipelines"
                    value={manualForm.goal}
                    onChange={(e) => setManualForm({ ...manualForm, goal: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="manualDuration">Estimated Duration:</label>
                    <input
                      id="manualDuration"
                      type="text"
                      placeholder="e.g. 4 Weeks"
                      value={manualForm.estimatedDuration}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, estimatedDuration: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="manualAudience">Target Audience:</label>
                    <input
                      id="manualAudience"
                      type="text"
                      placeholder="e.g. Junior Engineers"
                      value={manualForm.targetAudience}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, targetAudience: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="submit"
                    className="modal-submit-btn"
                    disabled={!manualForm.title.trim()}
                  >
                    Create Roadmap Document
                  </button>
                  <button
                    type="button"
                    className="modal-cancel-btn"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningJourney;
