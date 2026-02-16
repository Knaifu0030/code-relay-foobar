import React from 'react';
import { AtSign, Briefcase, Check, Clock3, UserPlus } from 'lucide-react';

const TYPE_META = {
    deadline: { icon: Clock3, label: 'Deadline', colorClass: 'notification-type-deadline' },
    assignment: { icon: Briefcase, label: 'Assignment', colorClass: 'notification-type-assignment' },
    mention: { icon: AtSign, label: 'Mention', colorClass: 'notification-type-mention' },
    invite: { icon: UserPlus, label: 'Invite', colorClass: 'notification-type-invite' },
};

const formatRelativeTime = (createdAt) => {
    if (!createdAt) return '';

    const now = Date.now();
    const created = new Date(createdAt).getTime();
    if (!Number.isFinite(created)) return '';

    const seconds = Math.round((created - now) / 1000);
    const absSeconds = Math.abs(seconds);

    if (absSeconds < 60) return 'just now';

    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) {
        return `${Math.abs(minutes)}m ago`;
    }

    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) {
        return `${Math.abs(hours)}h ago`;
    }

    const days = Math.round(hours / 24);
    return `${Math.abs(days)}d ago`;
};

export default function NotificationItem({ notification, onMarkRead }) {
    const meta = TYPE_META[notification.type] || TYPE_META.assignment;
    const TypeIcon = meta.icon;

    return (
        <li className={`notification-item ${notification.is_read ? '' : 'unread'}`}>
            <div className={`notification-type-icon ${meta.colorClass}`}>
                <TypeIcon size={15} />
            </div>

            <div className="notification-item-body">
                <div className="notification-item-row">
                    <p className="notification-item-title">{notification.title}</p>
                    <span className="notification-item-time">{formatRelativeTime(notification.created_at)}</span>
                </div>
                <p className="notification-item-message">{notification.message}</p>
                <div className="notification-item-footer">
                    <span className="notification-item-type">{meta.label}</span>
                    {!notification.is_read && (
                        <button
                            type="button"
                            className="notification-read-btn"
                            onClick={() => onMarkRead(notification.id)}
                        >
                            <Check size={13} />
                            Mark read
                        </button>
                    )}
                </div>
            </div>
        </li>
    );
}
