import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import learningPlanService, { calculateProgress } from '../../services/learning/learningPlanService';
import '../Progress/Progress.css';

export const StudyPlan = () => {
  const { user } = useAuth();
  const userId = user?.id || 'local-user';

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlan = async () => {
      try {
        const activePlan = await learningPlanService.getOrCreateActivePlan(userId);
        setPlan(activePlan);
      } catch (err) {
        console.error('[StudyPlan] Error loading plan:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPlan();
  }, [userId]);

  const items = plan?.items || [];
  const stats = calculateProgress(items);

  if (loading) {
    return (
      <div className="progress-page">
        <div className="auth-loading-screen">
          <div className="auth-spinner" />
          <p>Loading your study plan from local memory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="progress-page">
      <header className="progress-page-header">
        <span className="badge badge--role">📅 Structured Study Plan</span>
        <h1 className="progress-page-title">{plan?.title || 'Personalized Study Plan'}</h1>
        <p className="progress-page-subtitle">{plan?.goal}</p>
      </header>

      {/* Overview Cards */}
      <div className="progress-kpi-grid">
        <div className="kpi-card">
          <span className="kpi-icon">🎯</span>
          <div className="kpi-content">
            <span className="kpi-value">{stats.percentage}%</span>
            <span className="kpi-label">Plan Completion</span>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-icon">📖</span>
          <div className="kpi-content">
            <span className="kpi-value">{stats.inProgress} Active</span>
            <span className="kpi-label">In Progress Today</span>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-icon">🔄</span>
          <div className="kpi-content">
            <span className="kpi-value">{stats.review} Refresher</span>
            <span className="kpi-label">Needs Revision</span>
          </div>
        </div>
      </div>

      <section className="activity-section">
        <div className="activity-header">
          <h2>Curriculum Modules</h2>
          <Link to="/learning-journey" className="btn btn-primary">
            Open Interactive Checklist & Roadmap →
          </Link>
        </div>

        <ul className="activity-timeline">
          {items.map((item) => (
            <li key={item.id} className="timeline-item">
              <span
                className="timeline-dot"
                style={{
                  background:
                    item.status === 'completed'
                      ? '#10b981'
                      : item.status === 'in_progress'
                      ? '#6366f1'
                      : item.status === 'review'
                      ? '#f59e0b'
                      : '#64748b',
                }}
              />
              <div className="timeline-content">
                <div className="timeline-title-row">
                  <span className="timeline-title">
                    {item.order}. {item.title}
                  </span>
                  <span
                    className={`item-status-pill item-status-pill--${item.status}`}
                    style={{ fontSize: '0.72rem' }}
                  >
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
                <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default StudyPlan;
