import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import learningPlanService, { calculateProgress } from '../../services/learning/learningPlanService';
import learningEventRepository from '../../services/storage/learningEventRepository';
import './Progress.css';

export const Progress = () => {
  const { user } = useAuth();
  const userId = user?.id || 'local-user';

  const [plan, setPlan] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const activePlan = await learningPlanService.getOrCreateActivePlan(userId);
        const recentEvents = await learningEventRepository.getEvents(userId, 20);
        setPlan(activePlan);
        setEvents(recentEvents || []);
      } catch (err) {
        console.error('[Progress] Error loading progress data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  const stats = calculateProgress(plan?.items || []);

  if (loading) {
    return (
      <div className="progress-page">
        <div className="auth-loading-screen">
          <div className="auth-spinner" />
          <p>Loading your retention and mastery metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="progress-page">
      <header className="progress-page-header">
        <span className="badge badge--role">📊 Progress & Retention Metrics</span>
        <h1 className="progress-page-title">Curriculum Retention Tracker</h1>
        <p className="progress-page-subtitle">
          Real-time metrics derived from your offline IndexedDB study plans and AI tutoring sessions.
        </p>
      </header>

      {/* Main Stats Grid */}
      <div className="progress-kpi-grid">
        <div className="kpi-card">
          <span className="kpi-icon">🎯</span>
          <div className="kpi-content">
            <span className="kpi-value">{stats.percentage}%</span>
            <span className="kpi-label">Mastery Rate</span>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-icon">✅</span>
          <div className="kpi-content">
            <span className="kpi-value">{stats.completed} / {stats.total}</span>
            <span className="kpi-label">Completed Units</span>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-icon">🔄</span>
          <div className="kpi-content">
            <span className="kpi-value">{stats.review}</span>
            <span className="kpi-label">Units in Review</span>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-icon">⚡</span>
          <div className="kpi-content">
            <span className="kpi-value">{events.length}</span>
            <span className="kpi-label">Learning Events Recorded</span>
          </div>
        </div>
      </div>

      {/* Recent Learning Activity Timeline */}
      <section className="activity-section">
        <div className="activity-header">
          <h2>Recent Learning Activity</h2>
          <Link to="/learning-journey" className="btn btn-secondary">
            View Full Journey Roadmap →
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="activity-empty">
            <p>No activity events recorded yet.</p>
            <p className="activity-empty-sub">
              Start learning or review topics in your Learning Journey to track your progress!
            </p>
          </div>
        ) : (
          <ul className="activity-timeline">
            {events.map((evt) => (
              <li key={evt.eventId} className="timeline-item">
                <span className="timeline-dot" />
                <div className="timeline-content">
                  <div className="timeline-title-row">
                    <span className="timeline-title">
                      {evt.type.replace(/_/g, ' ').toUpperCase()}: {evt.topic}
                    </span>
                    <span className="timeline-date">
                      {new Date(evt.occurredAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {evt.payload?.previousStatus && (
                    <span className="timeline-meta">
                      Status transition: {evt.payload.previousStatus} → {evt.payload.newStatus}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Progress;
