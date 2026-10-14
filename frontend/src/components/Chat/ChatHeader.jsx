import './ChatHeader.css';

export const ChatHeader = ({
  title,
  mode,
  onModeChange,
  onToggleSidebar,
  status,
  isGenerating,
  syncState,
  onTriggerSync,
}) => {
  const getStatusBadge = () => {
    if (mode === 'online') {
      return status?.online?.available ? (
        <span className="status-indicator status-indicator--online" title={status.online.message}>
          ● Online Ready
        </span>
      ) : (
        <span className="status-indicator status-indicator--warning" title={status?.online?.message}>
          ▲ Online Unconfigured
        </span>
      );
    }

    if (mode === 'offline') {
      return status?.offline?.available ? (
        <span className="status-indicator status-indicator--online" title={status.offline.message}>
          ● Ollama Ready
        </span>
      ) : (
        <span className="status-indicator status-indicator--offline" title={status?.offline?.message}>
          ○ Ollama Offline
        </span>
      );
    }

    // Auto Mode
    if (status?.online?.available) {
      return (
        <span className="status-indicator status-indicator--online" title="Online primary ready">
          ● Auto (Online Ready)
        </span>
      );
    } else if (status?.offline?.available) {
      return (
        <span className="status-indicator status-indicator--fallback" title="Online unavailable, local fallback ready">
          ⚡ Auto (Local Fallback Ready)
        </span>
      );
    } else {
      return (
        <span className="status-indicator status-indicator--warning" title="Neither service currently detected">
          ▲ Services Checking
        </span>
      );
    }
  };

  const getSyncBadge = () => {
    if (!syncState) return null;
    if (syncState.isSyncing) {
      return (
        <span className="status-indicator status-indicator--online" title="Synchronizing with server...">
          🔄 Syncing...
        </span>
      );
    }
    if (syncState.pendingCount > 0) {
      return (
        <button
          type="button"
          onClick={onTriggerSync}
          className="status-indicator status-indicator--fallback"
          style={{ cursor: 'pointer', border: 'none' }}
          title="Changes saved in IndexedDB. Click to sync with cloud."
        >
          ⚡ {syncState.pendingCount} Offline Queued
        </button>
      );
    }
    return (
      <span className="status-indicator status-indicator--online" title="IndexedDB memory active and in sync">
        💾 Offline Memory Active
      </span>
    );
  };

  return (
    <header className="chat-header">
      <div className="chat-header-left">
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <div className="chat-header-title-box">
          <h2 className="chat-header-title">{title || 'New Conversation'}</h2>
          <span className="chat-header-brand-tag">EDUNIX AI</span>
        </div>
      </div>

      <div className="chat-header-right">
        {/* Offline Memory / Sync Status Indicator */}
        <div className="chat-status-wrapper">{getSyncBadge()}</div>

        {/* Real-time Service Status Indicator */}
        <div className="chat-status-wrapper">{getStatusBadge()}</div>

        {/* Manual Mode Selector */}
        <div className="mode-selector-wrapper">
          <label htmlFor="ai-mode-select" className="sr-only">
            Select AI Mode
          </label>
          <select
            id="ai-mode-select"
            value={mode}
            disabled={isGenerating}
            onChange={(e) => onModeChange(e.target.value)}
            className={`mode-select mode-select--${mode}`}
            title="Manual AI Mode Selector"
          >
            <option value="auto">⚡ Auto (Fallback)</option>
            <option value="online">🌐 Online AI</option>
            <option value="offline">💻 Local AI (Ollama)</option>
          </select>
        </div>
      </div>
    </header>
  );
};

export default ChatHeader;
