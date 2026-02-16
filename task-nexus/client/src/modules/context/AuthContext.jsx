import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'nexus_token';

const AuthContext = createContext(null);

const setAxiosAuthHeader = (authToken) => {
    if (authToken) {
        axios.defaults.headers.common.Authorization = `Bearer ${authToken}`;
        return;
    }
    delete axios.defaults.headers.common.Authorization;
};

const normalizeUser = (rawUser) => {
    const source = rawUser?.data && typeof rawUser.data === 'object' ? rawUser.data : rawUser;
    if (!source || typeof source !== 'object') return null;

    const normalized = {
        id: source.id ?? source.user_id ?? null,
        username: source.username ?? source.name ?? '',
        email: source.email ?? '',
    };

    if (!normalized.id && !normalized.username && !normalized.email) return null;
    return normalized;
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isActive = true;

        const clearSession = (shouldRedirect = false) => {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem('token');
            setAxiosAuthHeader(null);
            if (isActive) {
                setToken(null);
                setUser(null);
            }

            if (shouldRedirect && typeof window !== 'undefined' && window.location.pathname !== '/login') {
                window.location.replace('/login');
            }
        };

        const hydrateAuth = async () => {
            const storedToken = localStorage.getItem(TOKEN_KEY);
            if (!storedToken) {
                setAxiosAuthHeader(null);
                if (isActive) setLoading(false);
                return;
            }

            setToken(storedToken);
            setAxiosAuthHeader(storedToken);

            try {
                const response = await axios.get(`${API_BASE}/auth/me`);
                const normalizedUser = normalizeUser(response.data);
                if (!normalizedUser) throw new Error('Invalid user payload');
                if (isActive) setUser(normalizedUser);
            } catch (error) {
                const status = error?.response?.status;
                const isInvalidToken = status === 401 || status === 403;
                if (isInvalidToken) {
                    clearSession(true);
                } else if (isActive) {
                    setUser(null);
                }
            } finally {
                if (isActive) setLoading(false);
            }
        };

        hydrateAuth();

        return () => {
            isActive = false;
        };
    }, []);

    const login = async (email, password) => {
        const response = await axios.post(`${API_BASE}/auth/login`, { email, password });
        const authToken = response?.data?.token;

        if (!authToken) {
            throw new Error('Authentication token missing in login response');
        }

        localStorage.setItem(TOKEN_KEY, authToken);
        setAxiosAuthHeader(authToken);
        setToken(authToken);

        let normalizedUser = normalizeUser(response?.data?.user);
        if (!normalizedUser) {
            const meResponse = await axios.get(`${API_BASE}/auth/me`);
            normalizedUser = normalizeUser(meResponse.data);
        }

        if (!normalizedUser) {
            throw new Error('Unable to hydrate user profile');
        }

        setUser(normalizedUser);

        return {
            token: authToken,
            user: normalizedUser,
        };
    };

    const register = async (username, email, password) => {
        const response = await axios.post(`${API_BASE}/auth/register`, { username, email, password });
        const authToken = response?.data?.token;

        if (!authToken) {
            throw new Error('Authentication token missing in register response');
        }

        localStorage.setItem(TOKEN_KEY, authToken);
        setAxiosAuthHeader(authToken);
        setToken(authToken);

        let normalizedUser = normalizeUser(response?.data?.user);
        if (!normalizedUser) {
            const meResponse = await axios.get(`${API_BASE}/auth/me`);
            normalizedUser = normalizeUser(meResponse.data);
        }

        if (!normalizedUser) {
            throw new Error('Unable to hydrate user profile');
        }

        setUser(normalizedUser);

        return {
            token: authToken,
            user: normalizedUser,
        };
    };

    const logout = () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('token');
        setAxiosAuthHeader(null);
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
