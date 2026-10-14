import { useState } from 'react';
import './Sidebar.css';

export const Sidebar = ({
  conversations,
  activeId,
  isOpen,
  onClose,
  onNewChat,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const startEditing = (conv, e) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveRename = (id, e) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameChat(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (id, e) => {
    if (e.key === 'Enter') {
      handleSaveRename(id, e);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this conversation?')) {
      onDeleteChat(id);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`chat-sidebar ${isOpen ? 'chat-sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="sidebar-brand-icon">⚡</span>
            <span className="sidebar-brand-name">EDUNIX</span>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <div className="sidebar-action">
          <button
            type="button"
            className="new-chat-btn"
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
          >
            <span className="new-chat-icon">+</span>
            <span>New Chat</span>
          </button>
        </div>

        <div className="sidebar-history">
          <div className="sidebar-history-label">Recent Conversations</div>

          {conversations.length === 0 ? (
            <div className="sidebar-empty">
              <p>No conversations yet.</p>
              <span>Start your first chat above!</span>
            </div>
          ) : (
            <ul className="conversation-list">
              {conversations.map((conv) => {
                const isActive = conv.id === activeId;
                const isEditing = editingId === conv.id;

                return (
                  <li
                    key={conv.id}
                    className={`conversation-item ${
                      isActive ? 'conversation-item--active' : ''
                    }`}
                    onClick={() => {
                      onSelectChat(conv.id);
                      if (window.innerWidth < 768) onClose();
                    }}
                  >
                    <span className="conv-icon">💬</span>

                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={(e) => handleSaveRename(conv.id, e)}
                        onKeyDown={(e) => handleKeyDown(conv.id, e)}
                        onClick={(e) => e.stopPropagation()}
                        className="conv-rename-input"
                      />
                    ) : (
                      <span className="conv-title" title={conv.title}>
                        {conv.title}
                      </span>
                    )}

                    <div className="conv-actions">
                      {isEditing ? (
                        <button
                          type="button"
                          className="conv-action-btn"
                          onClick={(e) => handleSaveRename(conv.id, e)}
                          title="Save title"
                        >
                          ✓
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="conv-action-btn"
                          onClick={(e) => startEditing(conv, e)}
                          title="Rename chat"
                        >
                          ✎
                        </button>
                      )}
                      <button
                        type="button"
                        className="conv-action-btn conv-action-btn--delete"
                        onClick={(e) => handleDelete(conv.id, e)}
                        title="Delete chat"
                      >
                        🗑
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-info">
            <span className="sidebar-mode-note">Online & Offline Hybrid AI</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
