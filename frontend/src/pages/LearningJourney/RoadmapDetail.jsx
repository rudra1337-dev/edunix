import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import learningPlanService, {
  ITEM_STATUSES,
  calculateProgress,
} from '../../services/learning/learningPlanService';
import syncEngine from '../../services/sync/syncEngine';
import './RoadmapDetail.css';

export const RoadmapDetail = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || 'local-user';

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [syncState, setSyncState] = useState(syncEngine.state);

  // UI state for Notion document interaction
  const [openSections, setOpenSections] = useState({});
  const [expandedTopics, setExpandedTopics] = useState({});
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState({
    summary: '',
    goal: '',
    estimatedDuration: '',
    targetAudience: '',
  });
  const [notesState, setNotesState] = useState({});
  const [savedNotesFeedback, setSavedNotesFeedback] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Load roadmap data
  const loadRoadmap = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      let loadedPlan = await learningPlanService.getPlan(planId);

      if (!loadedPlan) {
        // Fallback to active plan if requested plan not found
        loadedPlan = await learningPlanService.getOrCreateActivePlan(userId);
      }

      if (!loadedPlan) {
        throw new Error(`Roadmap with ID "${planId}" could not be located.`);
      }

      setPlan(loadedPlan);
      setTitleDraft(loadedPlan.title || '');
      setMetaDraft({
        summary: loadedPlan.summary || loadedPlan.description || '',
        goal: loadedPlan.goal || '',
        estimatedDuration: loadedPlan.estimatedDuration || '4-6 Weeks',
        targetAudience: loadedPlan.targetAudience || 'All Learners',
      });

      // Default all sections to open
      const initialSections = {};
      (loadedPlan.sections || []).forEach((sec) => {
        initialSections[sec.id] = true;
      });
      setOpenSections(initialSections);

      // Populate notes state for topics
      const initialNotes = {};
      (loadedPlan.items || []).forEach((item) => {
        if (item.notes) {
          initialNotes[item.id] = item.notes;
        }
      });
      setNotesState(initialNotes);
    } catch (err) {
      console.error('[RoadmapDetail] Error loading roadmap:', err);
      setErrorMsg(err.message || 'Failed to load roadmap.');
    } finally {
      setLoading(false);
    }
  }, [planId, userId]);

  useEffect(() => {
    loadRoadmap();
  }, [loadRoadmap]);

  // Subscribe to syncEngine state
  useEffect(() => {
    syncEngine.initialize();
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState({ ...state });
    });
    return () => unsubscribe();
  }, []);

  const toggleSection = (sectionId) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const toggleTopic = (topicId) => {
    setExpandedTopics((prev) => ({
      ...prev,
      [topicId]: !prev[topicId],
    }));
  };

  // Status transition handler
  const handleStatusChange = async (itemId, targetStatus) => {
    if (!plan) return;
    try {
      setErrorMsg(null);
      const res = await learningPlanService.updateItemStatus({
        userId,
        planId: plan.id,
        itemId,
        newStatus: targetStatus,
      });

      if (res.changed) {
        setPlan(res.plan);
        syncEngine.triggerSync(userId).catch(console.error);
      }
    } catch (err) {
      console.error('[RoadmapDetail] Status change error:', err);
      setErrorMsg(err.message || 'Could not update status.');
    }
  };

  // Checklist subtask checkbox toggle
  const handleChecklistToggle = async (topicId, checklistId, completed) => {
    if (!plan) return;
    try {
      setErrorMsg(null);
      const updatedPlan = await learningPlanService.updateChecklistItem({
        userId,
        planId: plan.id,
        topicId,
        checklistId,
        completed,
      });
      setPlan(updatedPlan);
      syncEngine.triggerSync(userId).catch(console.error);
    } catch (err) {
      console.error('[RoadmapDetail] Checklist update error:', err);
      setErrorMsg(err.message || 'Failed to update subtask.');
    }
  };

  // Rename roadmap
  const handleSaveTitle = async () => {
    if (!titleDraft.trim() || !plan) return;
    try {
      const updatedPlan = await learningPlanService.renameRoadmap({
        userId,
        planId: plan.id,
        newTitle: titleDraft.trim(),
      });
      setPlan(updatedPlan);
      setEditingTitle(false);
      setSuccessMsg('Roadmap title updated.');
      setTimeout(() => setSuccessMsg(null), 3000);
      syncEngine.triggerSync(userId).catch(console.error);
    } catch (err) {
      console.error('[RoadmapDetail] Rename error:', err);
      setErrorMsg(err.message || 'Failed to rename roadmap.');
    }
  };

  // Save metadata
  const handleSaveMeta = async () => {
    if (!plan) return;
    try {
      const updatedPlan = await learningPlanService.updateRoadmapDetails({
        userId,
        planId: plan.id,
        ...metaDraft,
      });
      setPlan(updatedPlan);
      setEditingMeta(false);
      setSuccessMsg('Roadmap metadata updated.');
      setTimeout(() => setSuccessMsg(null), 3000);
      syncEngine.triggerSync(userId).catch(console.error);
    } catch (err) {
      console.error('[RoadmapDetail] Metadata update error:', err);
      setErrorMsg(err.message || 'Failed to update details.');
    }
  };

  // Save notes for a specific topic
  const handleSaveNotes = async (topicId) => {
    if (!plan) return;
    const notes = notesState[topicId] || '';
    try {
      const updatedPlan = await learningPlanService.updateTopicNotes({
        userId,
        planId: plan.id,
        topicId,
        notes,
      });
      setPlan(updatedPlan);
      setSavedNotesFeedback((prev) => ({ ...prev, [topicId]: true }));
      setTimeout(() => {
        setSavedNotesFeedback((prev) => ({ ...prev, [topicId]: false }));
      }, 2500);
      syncEngine.triggerSync(userId).catch(console.error);
    } catch (err) {
      console.error('[RoadmapDetail] Notes save error:', err);
      setErrorMsg(err.message || 'Failed to save notes.');
    }
  };

  // Delete roadmap with tombstone & navigate back
  const handleDeleteRoadmap = async () => {
    if (!plan) return;
    try {
      await learningPlanService.deleteRoadmap({
        userId,
        planId: plan.id,
      });
      syncEngine.triggerSync(userId).catch(console.error);
      navigate('/learning-journey', { replace: true });
    } catch (err) {
      console.error('[RoadmapDetail] Delete error:', err);
      setErrorMsg(err.message || 'Failed to delete roadmap.');
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="roadmap-document-page">
        <div className="auth-loading-screen">
          <div className="auth-spinner" />
          <p>Opening Notion-style learning roadmap from IndexedDB...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="roadmap-document-page">
        <div className="roadmap-not-found">
          <h2>Roadmap Not Found</h2>
          <p>The requested roadmap could not be loaded from local storage.</p>
          <Link to="/learning-journey" className="doc-btn doc-btn--primary">
            ← Return to Learning Journey
          </Link>
        </div>
      </div>
    );
  }

  const items = plan.items || [];
  const stats = calculateProgress(items);
  const sections = plan.sections || [];

  return (
    <div className="roadmap-document-page">
      {/* Top Breadcrumb Bar */}
      <div className="doc-breadcrumb-bar">
        <div className="doc-breadcrumbs">
          <Link to="/learning-journey" className="doc-breadcrumb-link">
            🗺️ Learning Journey
          </Link>
          <span className="doc-breadcrumb-sep">/</span>
          <span className="doc-breadcrumb-current">{plan.title}</span>
        </div>

        <div className="doc-header-actions">
          {/* Cloud Sync Status */}
          <button
            type="button"
            onClick={() => syncEngine.triggerSync(userId)}
            className={`doc-sync-pill ${
              syncState.pendingCount > 0 ? 'doc-sync-pill--pending' : ''
            }`}
            title="Synchronize offline changes with cloud"
          >
            {syncState.isSyncing ? (
              <span>🔄 Syncing...</span>
            ) : syncState.pendingCount > 0 ? (
              <span>⚡ {syncState.pendingCount} Queued Offline</span>
            ) : (
              <span>✓ Cloud Synced</span>
            )}
          </button>

          <Link
            to={`/chat?prompt=${encodeURIComponent(
              `I am studying the roadmap "${plan.title}". What should I focus on first?`
            )}`}
            className="doc-btn doc-btn--ai"
            title="Ask AI tutor for guidance on this roadmap"
          >
            ⚡ Ask AI Tutor
          </Link>

          <button
            type="button"
            className="doc-btn doc-btn--danger"
            onClick={() => setShowDeleteModal(true)}
            title="Delete roadmap"
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="auth-alert auth-alert--error" style={{ marginBottom: '1.25rem' }}>
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="auth-alert auth-alert--success" style={{ marginBottom: '1.25rem' }}>
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Notion Document Header / Cover Area */}
      <header className="doc-cover-card">
        <div className="doc-badge-row">
          <span className="doc-badge">📑 Notion Roadmap Document</span>
          <span className="doc-badge doc-badge--source">
            {plan.source === 'ai_generated' ? '✨ AI Generated' : '🛠️ Structured'}
          </span>
        </div>

        {/* Title (Inline Edit) */}
        {editingTitle ? (
          <div className="doc-title-edit-row">
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="doc-title-input"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
            />
            <button type="button" onClick={handleSaveTitle} className="doc-btn doc-btn--primary">
              Save
            </button>
            <button type="button" onClick={() => setEditingTitle(false)} className="doc-btn">
              Cancel
            </button>
          </div>
        ) : (
          <div className="doc-title-row">
            <h1 className="doc-title">{plan.title}</h1>
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              className="doc-icon-btn"
              title="Rename Roadmap"
            >
              ✏️
            </button>
          </div>
        )}

        {/* Summary & Goal */}
        <p className="doc-summary">{plan.summary || plan.goal}</p>

        {/* Metadata Chips */}
        <div className="doc-meta-chips">
          <div className="doc-meta-chip">
            <span className="meta-chip-label">⏱️ Duration:</span>
            <span className="meta-chip-val">{plan.estimatedDuration || '4-6 Weeks'}</span>
          </div>
          <div className="doc-meta-chip">
            <span className="meta-chip-label">🎯 Audience:</span>
            <span className="meta-chip-val">{plan.targetAudience || 'All Learners'}</span>
          </div>
          <div className="doc-meta-chip">
            <span className="meta-chip-label">📌 Sections:</span>
            <span className="meta-chip-val">{sections.length} Core Modules</span>
          </div>
          <button
            type="button"
            className="doc-edit-meta-btn"
            onClick={() => setEditingMeta(!editingMeta)}
          >
            {editingMeta ? 'Close Metadata Editor' : '✏️ Edit Metadata'}
          </button>
        </div>

        {/* Metadata Edit Form (Collapsible) */}
        {editingMeta && (
          <div className="doc-meta-editor">
            <div className="doc-editor-grid">
              <label className="doc-form-group">
                <span>Curriculum Goal:</span>
                <input
                  type="text"
                  value={metaDraft.goal}
                  onChange={(e) => setMetaDraft({ ...metaDraft, goal: e.target.value })}
                  placeholder="Primary learning goal"
                />
              </label>
              <label className="doc-form-group">
                <span>Summary / Overview:</span>
                <input
                  type="text"
                  value={metaDraft.summary}
                  onChange={(e) => setMetaDraft({ ...metaDraft, summary: e.target.value })}
                  placeholder="Brief description"
                />
              </label>
              <label className="doc-form-group">
                <span>Estimated Duration:</span>
                <input
                  type="text"
                  value={metaDraft.estimatedDuration}
                  onChange={(e) =>
                    setMetaDraft({ ...metaDraft, estimatedDuration: e.target.value })
                  }
                  placeholder="e.g. 4-6 Weeks"
                />
              </label>
              <label className="doc-form-group">
                <span>Target Audience:</span>
                <input
                  type="text"
                  value={metaDraft.targetAudience}
                  onChange={(e) =>
                    setMetaDraft({ ...metaDraft, targetAudience: e.target.value })
                  }
                  placeholder="e.g. Intermediate Developers"
                />
              </label>
            </div>
            <div className="doc-editor-actions">
              <button type="button" onClick={handleSaveMeta} className="doc-btn doc-btn--primary">
                Save Details
              </button>
              <button type="button" onClick={() => setEditingMeta(false)} className="doc-btn">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Document Progress Bar */}
        <div className="doc-progress-section">
          <div className="doc-progress-info">
            <span className="doc-progress-text">Overall Roadmap Progress</span>
            <span className="doc-progress-pct">{stats.percentage}%</span>
          </div>
          <div className="doc-progress-track">
            <div className="doc-progress-fill" style={{ width: `${stats.percentage}%` }} />
          </div>
          <div className="doc-progress-stats">
            <span>{stats.completed} Mastered</span>
            <span>{stats.inProgress} In Progress</span>
            <span>{stats.review} Review</span>
            <span>{stats.notStarted} Remaining</span>
          </div>
        </div>
      </header>

      {/* Curriculum Details: Objectives & Prerequisites */}
      {(plan.learningObjectives?.length > 0 || plan.prerequisites?.length > 0) && (
        <section className="doc-curriculum-overview">
          {plan.learningObjectives?.length > 0 && (
            <div className="doc-overview-block">
              <h3 className="doc-block-title">🎯 Key Learning Objectives</h3>
              <ul className="doc-objectives-list">
                {plan.learningObjectives.map((obj, i) => (
                  <li key={i}>{obj}</li>
                ))}
              </ul>
            </div>
          )}

          {plan.prerequisites?.length > 0 && (
            <div className="doc-overview-block">
              <h3 className="doc-block-title">📋 Recommended Prerequisites</h3>
              <div className="doc-prereq-tags">
                {plan.prerequisites.map((prereq, i) => (
                  <span key={i} className="doc-prereq-tag">
                    {prereq}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Notion-Style Sections & Topics */}
      <section className="doc-sections-container" aria-label="Roadmap Curriculum">
        <h2 className="doc-sections-heading">Roadmap Modules & Learning Blocks</h2>

        {sections.map((section, sIdx) => {
          const isOpen = openSections[section.id] !== false;
          const secTopics = section.topics || [];
          const secCompleted = secTopics.filter(
            (t) => t.status === ITEM_STATUSES.COMPLETED
          ).length;

          return (
            <div key={section.id || sIdx} className="notion-section-block">
              {/* Section Header (Toggleable) */}
              <button
                type="button"
                className="notion-section-header"
                onClick={() => toggleSection(section.id)}
                aria-expanded={isOpen}
              >
                <div className="notion-section-title-wrap">
                  <span className={`notion-chevron ${isOpen ? 'notion-chevron--open' : ''}`}>
                    ▶
                  </span>
                  <span className="notion-section-index">{sIdx + 1}.</span>
                  <h3 className="notion-section-title">{section.title}</h3>
                </div>

                <div className="notion-section-meta">
                  {section.description && (
                    <span className="notion-section-desc">{section.description}</span>
                  )}
                  <span className="notion-section-counter">
                    {secCompleted}/{secTopics.length} Mastered
                  </span>
                </div>
              </button>

              {/* Section Content: Topics */}
              {isOpen && (
                <div className="notion-section-body">
                  {secTopics.map((topic) => {
                    const isExpanded = expandedTopics[topic.id];
                    const isCompleted = topic.status === ITEM_STATUSES.COMPLETED;
                    const isInProgress = topic.status === ITEM_STATUSES.IN_PROGRESS;
                    const isReview = topic.status === ITEM_STATUSES.REVIEW;
                    const isNotStarted = topic.status === ITEM_STATUSES.NOT_STARTED;

                    const checklist = topic.checklist || [];
                    const exercises = topic.practiceExercises || [];
                    const resources = topic.resources || [];
                    const completedSubtasks = checklist.filter((c) => c.completed).length;

                    return (
                      <div
                        key={topic.id}
                        className={`notion-topic-card notion-topic-card--${topic.status}`}
                      >
                        {/* Topic Row Summary */}
                        <div className="notion-topic-summary-row">
                          {/* Checkbox */}
                          <div className="notion-checkbox-wrap">
                            <input
                              type="checkbox"
                              id={`chk-topic-${topic.id}`}
                              checked={isCompleted}
                              onChange={() => {
                                if (isCompleted) {
                                  handleStatusChange(topic.id, ITEM_STATUSES.REVIEW);
                                } else if (isInProgress || isReview) {
                                  handleStatusChange(topic.id, ITEM_STATUSES.COMPLETED);
                                } else {
                                  handleStatusChange(topic.id, ITEM_STATUSES.IN_PROGRESS);
                                }
                              }}
                              className="notion-topic-check"
                              aria-label={`Mark ${topic.title} status`}
                            />
                          </div>

                          {/* Title & Status */}
                          <div
                            className="notion-topic-label"
                            onClick={() => toggleTopic(topic.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') toggleTopic(topic.id);
                            }}
                          >
                            <span className="notion-topic-title">{topic.title}</span>
                            <span className={`notion-status-badge notion-status-badge--${topic.status}`}>
                              {topic.status.replace('_', ' ')}
                            </span>
                            {checklist.length > 0 && (
                              <span className="notion-subtask-indicator">
                                ✓ {completedSubtasks}/{checklist.length} subtasks
                              </span>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div className="notion-topic-quick-actions">
                            <button
                              type="button"
                              className="notion-expand-btn"
                              onClick={() => toggleTopic(topic.id)}
                              title="Expand/Collapse Topic Details"
                            >
                              {isExpanded ? 'Hide Details ▲' : 'Open Document ▼'}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Notion Topic Details */}
                        {isExpanded && (
                          <div className="notion-topic-details">
                            {/* Summary / Explanation */}
                            {(topic.explanation || topic.summary) && (
                              <div className="notion-topic-prose">
                                <p>{topic.explanation || topic.summary}</p>
                              </div>
                            )}

                            {/* Subtasks Checklist */}
                            {checklist.length > 0 && (
                              <div className="notion-subtask-block">
                                <h4 className="notion-detail-title">Subtasks & Practice Checklist</h4>
                                <div className="notion-subtasks-list">
                                  {checklist.map((chk) => (
                                    <label
                                      key={chk.id}
                                      className={`notion-subtask-item ${
                                        chk.completed ? 'notion-subtask-item--done' : ''
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={Boolean(chk.completed)}
                                        onChange={(e) =>
                                          handleChecklistToggle(topic.id, chk.id, e.target.checked)
                                        }
                                        className="notion-subtask-checkbox"
                                      />
                                      <span>{chk.text}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Practice Exercises */}
                            {exercises.length > 0 && (
                              <div className="notion-exercises-block">
                                <h4 className="notion-detail-title">💻 Practical Terminal Exercises</h4>
                                <div className="notion-exercises-grid">
                                  {exercises.map((ex, exIdx) => (
                                    <div key={exIdx} className="notion-exercise-card">
                                      <div className="notion-exercise-instruction">
                                        {ex.instruction || ex.title}
                                      </div>
                                      {ex.command && (
                                        <pre className="notion-code-block">
                                          <code>{ex.command}</code>
                                        </pre>
                                      )}
                                      {ex.hints && (
                                        <span className="notion-exercise-hint">💡 Hint: {ex.hints}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Recommended Resources */}
                            {resources.length > 0 && (
                              <div className="notion-resources-block">
                                <h4 className="notion-detail-title">📚 Recommended Documentation</h4>
                                <ul className="notion-resources-list">
                                  {resources.map((res, rIdx) => (
                                    <li key={rIdx}>
                                      {res.url ? (
                                        <a
                                          href={res.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="notion-resource-link"
                                        >
                                          {res.title || res.url} ↗
                                        </a>
                                      ) : (
                                        <span>{res.title || res}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Personal Learner Notes Editor */}
                            <div className="notion-notes-block">
                              <div className="notion-notes-header">
                                <h4 className="notion-detail-title">📝 My Learning Notes</h4>
                                {savedNotesFeedback[topic.id] && (
                                  <span className="notion-notes-saved-badge">✓ Notes Saved</span>
                                )}
                              </div>
                              <textarea
                                className="notion-notes-textarea"
                                rows={3}
                                placeholder="Type your personal insights, command outputs, or questions here... (Saves offline & syncs)"
                                value={notesState[topic.id] || ''}
                                onChange={(e) =>
                                  setNotesState({ ...notesState, [topic.id]: e.target.value })
                                }
                              />
                              <button
                                type="button"
                                className="notion-save-notes-btn"
                                onClick={() => handleSaveNotes(topic.id)}
                              >
                                💾 Save Notes
                              </button>
                            </div>

                            {/* Topic Status Transitions & AI Tutor */}
                            <div className="notion-topic-bottom-toolbar">
                              <div className="notion-transition-btns">
                                {isNotStarted && (
                                  <button
                                    type="button"
                                    className="notion-btn notion-btn--primary"
                                    onClick={() =>
                                      handleStatusChange(topic.id, ITEM_STATUSES.IN_PROGRESS)
                                    }
                                  >
                                    ▶ Start Topic
                                  </button>
                                )}

                                {isInProgress && (
                                  <>
                                    <button
                                      type="button"
                                      className="notion-btn"
                                      onClick={() =>
                                        handleStatusChange(topic.id, ITEM_STATUSES.REVIEW)
                                      }
                                    >
                                      🔄 Needs Review
                                    </button>
                                    <button
                                      type="button"
                                      className="notion-btn notion-btn--primary"
                                      onClick={() =>
                                        handleStatusChange(topic.id, ITEM_STATUSES.COMPLETED)
                                      }
                                    >
                                      ✓ Mark Mastered
                                    </button>
                                  </>
                                )}

                                {isReview && (
                                  <button
                                    type="button"
                                    className="notion-btn notion-btn--review"
                                    onClick={() =>
                                      handleStatusChange(topic.id, ITEM_STATUSES.COMPLETED)
                                    }
                                  >
                                    ✓ Complete Revision
                                  </button>
                                )}

                                {isCompleted && (
                                  <button
                                    type="button"
                                    className="notion-btn"
                                    onClick={() =>
                                      handleStatusChange(topic.id, ITEM_STATUSES.REVIEW)
                                    }
                                  >
                                    🔄 Review Again
                                  </button>
                                )}
                              </div>

                              <Link
                                to={`/chat?prompt=${encodeURIComponent(
                                  `Can you explain the topic "${topic.title}" from my "${plan.title}" roadmap?`
                                )}`}
                                className="notion-btn notion-btn--ai"
                              >
                                ⚡ Ask Edunix AI Tutor
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="doc-modal-overlay">
          <div className="doc-modal-dialog">
            <h3 className="doc-modal-title">Delete Roadmap?</h3>
            <p className="doc-modal-text">
              Are you sure you want to delete &ldquo;{plan.title}&rdquo;? This will remove the
              roadmap from local IndexedDB and record a sync tombstone to delete it from the cloud.
            </p>
            <div className="doc-modal-actions">
              <button
                type="button"
                className="doc-btn doc-btn--danger"
                onClick={handleDeleteRoadmap}
              >
                Yes, Delete Roadmap
              </button>
              <button
                type="button"
                className="doc-btn"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoadmapDetail;
