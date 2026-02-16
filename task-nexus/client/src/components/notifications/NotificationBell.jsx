import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../modules/context/NotificationContext';
import NotificationPanel from './NotificationPanel';

export default function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);
    const { unreadCount } = useNotifications();

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleOutsideClick = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') setIsOpen(false);
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);

    return (
        <div className="notification-bell-wrapper" ref={wrapperRef}>
            <button
                type="button"
                className={`notification-bell-btn ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen((prev) => !prev)}
                aria-label="Open notifications"
                aria-expanded={isOpen}
                aria-haspopup="dialog"
            >
                <Bell size={18} />
                {unreadCount > 0 && <span className="notification-badge">{unreadLabel}</span>}
            </button>

            {isOpen && <NotificationPanel onClose={() => setIsOpen(false)} />}
        </div>
    );
}
