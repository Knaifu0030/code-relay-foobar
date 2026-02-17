import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import ToastNotification from '../../components/notifications/ToastNotification';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.API_URL || '/api';
const SOCKET_BASE = API_BASE.replace(/\/api\/?$/, '');
const POLL_INTERVAL_MS = 15000;
const MAX_NOTIFICATIONS = 80;
const MAX_TOASTS = 3;

const NotificationContext = createContext(null);

const getNotificationErrorMessage = (requestError) => {
    const rawMessage = String(requestError?.response?.data?.error || '').trim();
    if (!rawMessage) return 'Unable to load notifications right now.';

    const lowerMessage = rawMessage.toLowerCase();
    if (
        lowerMessage.includes('doesn\'t exist') ||
        lowerMessage.includes('no such table') ||
        lowerMessage.includes('er_no_such_table') ||
        lowerMessage.includes('relation') && lowerMessage.includes('does not exist')
    ) {
        return 'Notifications are not initialized on the server yet. Please run the latest database migration.';
    }

    if (lowerMessage.includes('authentication required') || lowerMessage.includes('invalid token')) {
        return 'Your session expired. Please login again.';
    }

    return 'Unable to load notifications right now.';
};

const parseMetadata = (rawMetadata) => {
    if (!rawMetadata) return {};
    if (typeof rawMetadata === 'object') return rawMetadata;
    try {
        return JSON.parse(rawMetadata);
    } catch {
        return {};
    }
};

const normalizeNotification = (rawNotification) => {
    if (!rawNotification || !rawNotification.id) return null;

    return {
        id: String(rawNotification.id),
        user_id: rawNotification.user_id,
        type: rawNotification.type || 'assignment',
        title: rawNotification.title || 'Notification',
        message: rawNotification.message || '',
        metadata: parseMetadata(rawNotification.metadata),
        is_read: Boolean(rawNotification.is_read),
        created_at: rawNotification.created_at || new Date().toISOString(),
    };
};

const byCreatedAtDesc = (a, b) =>
    new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime();

const dedupeAndSortNotifications = (list) => {
    const map = new Map();
    (Array.isArray(list) ? list : []).forEach((item) => {
        const normalized = normalizeNotification(item);
        if (normalized?.id) {
            map.set(normalized.id, normalized);
        }
    });
    return [...map.values()].sort(byCreatedAtDesc);
};

export function NotificationProvider({ children }) {
    const { user, token } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [toasts, setToasts] = useState([]);

    const knownIdsRef = useRef(new Set());
    const hydratedRef = useRef(false);
    const socketRef = useRef(null);

    const enqueueToast = useCallback((notification) => {
        if (!notification?.id || notification.is_read) return;

        setToasts((prev) => {
            if (prev.some((toast) => toast.id === notification.id)) return prev;
            const toastPayload = {
                id: notification.id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                created_at: notification.created_at,
            };
            return [toastPayload, ...prev].slice(0, MAX_TOASTS);
        });
    }, []);

    const dismissToast = useCallback((toastId) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
    }, []);

    const fetchNotifications = useCallback(
        async ({ silent = false } = {}) => {
            if (!token || !user) return;

            if (!silent) {
                setLoading(true);
                setError('');
            }

            try {
                const response = await axios.get(`${API_BASE}/notifications`, {
                    params: { limit: 50, offset: 0 },
                    headers: { Authorization: `Bearer ${token}` },
                });

                const payload = response.data || {};
                const normalizedList = dedupeAndSortNotifications(payload.notifications).slice(0, MAX_NOTIFICATIONS);
                const freshUnread = normalizedList.filter(
                    (item) => !item.is_read && !knownIdsRef.current.has(item.id)
                );

                setNotifications(normalizedList);
                setUnreadCount(Number(payload.unreadCount ?? normalizedList.filter((item) => !item.is_read).length));

                const nextKnownIds = new Set(normalizedList.map((item) => item.id));
                knownIdsRef.current = nextKnownIds;

                if (hydratedRef.current) {
                    freshUnread.forEach(enqueueToast);
                } else {
                    hydratedRef.current = true;
                }
            } catch (requestError) {
                if (!silent) {
                    setError(getNotificationErrorMessage(requestError));
                }
            } finally {
                if (!silent) setLoading(false);
            }
        },
        [enqueueToast, token, user]
    );

    const markAsRead = useCallback(
        async (notificationId) => {
            if (!token || !notificationId) return;

            const targetNotification = notifications.find((item) => item.id === notificationId);

            setNotifications((prev) =>
                prev.map((item) =>
                    item.id === notificationId ? { ...item, is_read: true } : item
                )
            );
            if (targetNotification && !targetNotification.is_read) {
                setUnreadCount((prev) => Math.max(prev - 1, 0));
            }

            try {
                await axios.patch(
                    `${API_BASE}/notifications/${notificationId}/read`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } catch {
                fetchNotifications({ silent: true });
            }
        },
        [fetchNotifications, notifications, token]
    );

    const markAllAsRead = useCallback(async () => {
        if (!token) return;

        setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
        setUnreadCount(0);

        try {
            await axios.patch(
                `${API_BASE}/notifications/read-all`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch {
            fetchNotifications({ silent: true });
        }
    }, [fetchNotifications, token]);

    const createNotification = useCallback(
        async (payload) => {
            if (!token) throw new Error('Authentication required');

            const response = await axios.post(`${API_BASE}/notifications`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const createdNotification = normalizeNotification(response?.data?.notification);
            if (!createdNotification || knownIdsRef.current.has(createdNotification.id)) {
                return response.data;
            }

            knownIdsRef.current.add(createdNotification.id);
            setNotifications((prev) =>
                dedupeAndSortNotifications([createdNotification, ...prev]).slice(0, MAX_NOTIFICATIONS)
            );
            if (!createdNotification.is_read) {
                setUnreadCount((prev) => prev + 1);
                enqueueToast(createdNotification);
            }

            return response.data;
        },
        [enqueueToast, token]
    );

    useEffect(() => {
        if (!token || !user) {
            setNotifications([]);
            setUnreadCount(0);
            setToasts([]);
            setLoading(false);
            setError('');
            knownIdsRef.current = new Set();
            hydratedRef.current = false;
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        }
    }, [token, user]);

    useEffect(() => {
        if (!token || !user) return undefined;

        fetchNotifications({ silent: false });
        const intervalId = setInterval(() => {
            fetchNotifications({ silent: true });
        }, POLL_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, [fetchNotifications, token, user]);

    useEffect(() => {
        if (!token || !user) return undefined;

        const socket = io(SOCKET_BASE, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
        });

        socketRef.current = socket;

        socket.on('notification:new', (payload) => {
            const incoming = normalizeNotification(payload);
            if (!incoming || knownIdsRef.current.has(incoming.id)) return;

            knownIdsRef.current.add(incoming.id);
            setNotifications((prev) =>
                dedupeAndSortNotifications([incoming, ...prev]).slice(0, MAX_NOTIFICATIONS)
            );
            if (!incoming.is_read) {
                setUnreadCount((prev) => prev + 1);
                enqueueToast(incoming);
            }
        });

        return () => {
            socket.disconnect();
            if (socketRef.current === socket) {
                socketRef.current = null;
            }
        };
    }, [enqueueToast, token, user]);

    const value = useMemo(
        () => ({
            notifications,
            unreadCount,
            loading,
            error,
            fetchNotifications,
            markAsRead,
            markAllAsRead,
            createNotification,
        }),
        [createNotification, error, fetchNotifications, loading, markAllAsRead, markAsRead, notifications, unreadCount]
    );

    return (
        <NotificationContext.Provider value={value}>
            {children}
            <div className="notification-toast-stack" aria-live="polite" aria-atomic="true">
                {toasts.map((toast) => (
                    <ToastNotification
                        key={toast.id}
                        toast={toast}
                        onClose={dismissToast}
                    />
                ))}
            </div>
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
}
