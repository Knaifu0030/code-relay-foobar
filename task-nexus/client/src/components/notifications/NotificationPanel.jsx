import React from 'react';
import { CheckCheck, RefreshCcw, X } from 'lucide-react';
import { useNotifications } from '../../modules/context/NotificationContext';
import NotificationItem from './NotificationItem';

export default function NotificationPanel({ onClose }) {
    const {
        notifications,
        unreadCount,
        loading,
        error,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
    } = useNotifications();

    return (
        <div className="notification-panel glass" role="dialog" aria-label="Notifications panel">
            <div className="notification-panel-header">
                <div>
                    <h3>Notifications</h3>
                    <p className="text-muted text-sm">{unreadCount} unread</p>
                </div>
                <div className="notification-panel-actions">
                    <button
                        type="button"
                        className="btn-ghost notification-panel-btn"
                        onClick={() => fetchNotifications({ silent: false })}
                        aria-label="Refresh notifications"
                    >
                        <RefreshCcw size={14} />
                    </button>
                    <button
                        type="button"
                        className="btn-ghost notification-panel-btn"
                        onClick={markAllAsRead}
                        disabled={unreadCount === 0}
                        aria-label="Mark all notifications as read"
                    >
                        <CheckCheck size={14} />
                    </button>
                    <button
                        type="button"
                        className="btn-ghost notification-panel-btn"
                        onClick={onClose}
                        aria-label="Close notifications panel"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="notification-loading">
                    <div className="spinner"></div>
                    <p className="text-muted">Loading notifications...</p>
                </div>
            ) : (
                <>
                    {error && <p className="notification-error">{error}</p>}
                    {notifications.length === 0 ? (
                        <div className="notification-empty">
                            <p>No notifications yet.</p>
                        </div>
                    ) : (
                        <ul className="notification-list">
                            {notifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onMarkRead={markAsRead}
                                />
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}
