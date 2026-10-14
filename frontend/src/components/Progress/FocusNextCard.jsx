import { Link } from 'react-router-dom';

/**
 * Intelligent "What to Learn Next" Recommendation Card
 * Deterministically guides learners on their optimal next study step,
 * respecting review priority, active progress momentum, and prerequisites.
 */
export const FocusNextCard = ({
  recommendation = null,
}) => {
  if (!recommendation) return null;

  const { topic, roadmap, reason, actionLabel, actionType } = recommendation;

  return (
    <div className="analytics-card focus-next-card">
      <div className="focus-next-glow" />
      <div className="focus-next-content">
        <div className="focus-badge-row">
          <span className="focus-pill">🎯 Focus Next</span>
          {actionType === 'review' && (
            <span className="focus-status-tag focus-status-tag--review">🔄 Spaced Review</span>
          )}
          {actionType === 'continue' && (
            <span className="focus-status-tag focus-status-tag--active">⚡ Active Momentum</span>
          )}
          {actionType === 'start' && (
            <span className="focus-status-tag focus-status-tag--ready">🚀 Prerequisites Met</span>
          )}
          {actionType === 'complete' && (
            <span className="focus-status-tag focus-status-tag--complete">🎉 Curriculum Mastered</span>
          )}
        </div>

        <h2 className="focus-topic-title">
          {topic?.title || roadmap?.title || 'Personalized Study Direction'}
        </h2>

        <p className="focus-reason-text">{reason}</p>

        {roadmap && topic && (
          <div className="focus-context-meta">
            <span className="meta-item">
              <strong>Roadmap:</strong> {roadmap.title}
            </span>
            {topic.checklist?.length > 0 && (
              <span className="meta-item">
                <strong>Subtasks:</strong>{' '}
                {topic.checklist.filter((c) => c.completed).length} of {topic.checklist.length} done
              </span>
            )}
          </div>
        )}

        <div className="focus-actions-row">
          {roadmap ? (
            <Link to={`/learning-journey/${roadmap.id}`} className="btn btn-primary focus-cta-btn">
              {actionLabel}
            </Link>
          ) : (
            <Link to="/learning-journey" className="btn btn-primary focus-cta-btn">
              {actionLabel}
            </Link>
          )}

          <Link to="/chat" className="btn btn-secondary focus-ask-ai-btn">
            💬 Ask AI Tutor About This &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FocusNextCard;
