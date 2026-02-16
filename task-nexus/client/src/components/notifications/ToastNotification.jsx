import React, { useEffect } from 'react';
import { AtSign, Briefcase, Clock3, UserPlus, X } from 'lucide-react';

const TOAST_META = {
    deadline: { icon: Clock3, className: 'notification-toast-deadline' },
    assignment: { icon: Briefcase, className: 'notification-toast-assignment' },
    mention: { icon: AtSign, className: 'notification-toast-mention' },
    invite: { icon: UserPlus, className: 'notification-toast-invite' },
};

export default function ToastNotification({ toast, onClose }) {
    const meta = TOAST_META[toast.type] || TOAST_META.assignment;
    const ToastIcon = meta.icon;

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            onClose(toast.id);
        }, 4500);

        return () => clearTimeout(timeoutId);
    }, [onClose, toast.id]);

    return (
        <div className={`notification-toast glass ${meta.className}`} role="status">
            <div className="notification-toast-icon">
                <ToastIcon size={16} />
            </div>
            <div className="notification-toast-body">
                <p className="notification-toast-title">{toast.title}</p>
                <p className="notification-toast-message">{toast.message}</p>
            </div>
            <button
                type="button"
                className="notification-toast-close"
                aria-label="Dismiss notification"
                onClick={() => onClose(toast.id)}
            >
                <X size={14} />
            </button>
        </div>
    );
}
