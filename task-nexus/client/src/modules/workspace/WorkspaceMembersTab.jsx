import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle2, Mail, Search, Shield, UserPlus, Users } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.API_URL || '/api';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

export default function WorkspaceMembersTab({ workspaceId, workspaceRole }) {
    const [members, setMembers] = useState([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [searching, setSearching] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const memberEmails = useMemo(
        () => new Set(members.map((member) => normalizeEmail(member.email))),
        [members]
    );

    const duplicateInvite = memberEmails.has(normalizeEmail(inviteEmail));
    const canManageInvites = workspaceRole === 'owner' || workspaceRole === 'admin';

    const fetchMembers = async () => {
        const token = localStorage.getItem('nexus_token');
        try {
            const response = await axios.get(`${API_BASE}/workspaces/${workspaceId}/members`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setMembers(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to load workspace members');
        } finally {
            setLoadingMembers(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, [workspaceId]);

    const handleSearch = async () => {
        const normalized = normalizeEmail(inviteEmail);
        if (!normalized) {
            setError('Enter an email to search');
            setSuccess('');
            setSelectedUser(null);
            return;
        }

        if (duplicateInvite) {
            setError('This user is already a member of the workspace');
            setSuccess('');
            setSelectedUser(null);
            return;
        }

        const token = localStorage.getItem('nexus_token');
        setSearching(true);
        setError('');
        setSuccess('');

        try {
            const response = await axios.get(`${API_BASE}/users/search`, {
                params: { email: normalized, workspaceId },
                headers: { Authorization: `Bearer ${token}` },
            });

            const users = Array.isArray(response.data) ? response.data : [];
            const exactMatch = users.find((user) => normalizeEmail(user.email) === normalized) || null;

            if (!exactMatch) {
                setSelectedUser(null);
                setError('No registered user found with this email');
                return;
            }

            setSelectedUser(exactMatch);
        } catch (err) {
            setSelectedUser(null);
            setError(err?.response?.data?.error || 'Failed to search user');
        } finally {
            setSearching(false);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        const targetEmail = normalizeEmail(selectedUser?.email || inviteEmail);

        if (!targetEmail) {
            setError('Email is required');
            setSuccess('');
            return;
        }

        if (memberEmails.has(targetEmail)) {
            setError('This user is already a member of the workspace');
            setSuccess('');
            return;
        }

        const token = localStorage.getItem('nexus_token');
        setInviting(true);
        setError('');
        setSuccess('');

        try {
            const response = await axios.post(
                `${API_BASE}/workspaces/${workspaceId}/invite`,
                { email: targetEmail },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const invitedMember = response?.data?.member;
            if (invitedMember) {
                setMembers((prev) => [...prev, invitedMember]);
            } else {
                await fetchMembers();
            }

            setSuccess('Collaborator invited successfully');
            setInviteEmail('');
            setSelectedUser(null);
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to invite collaborator');
        } finally {
            setInviting(false);
        }
    };

    return (
        <div className="members-tab-content fade-in">
            <div className="members-invite-card glass">
                <div className="members-card-header">
                    <h3>Invite Collaborator</h3>
                    <span className="badge"><Shield size={14} /> {workspaceRole || 'member'}</span>
                </div>
                <p className="text-muted">Search a registered user by email and add them to this workspace.</p>

                {!canManageInvites && (
                    <p className="members-feedback members-feedback-error">
                        <AlertCircle size={15} />
                        <span>Only workspace owner or admin can invite members.</span>
                    </p>
                )}

                <form onSubmit={handleInvite} className="members-invite-form">
                    <div className="input-with-icon">
                        <Mail size={18} className="input-icon" />
                        <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => {
                                setInviteEmail(e.target.value);
                                setSelectedUser(null);
                                setError('');
                                setSuccess('');
                            }}
                            placeholder="teammate@company.com"
                            disabled={!canManageInvites}
                            required
                        />
                    </div>

                    <div className="members-invite-actions">
                        <button
                            type="button"
                            className="btn-ghost"
                            onClick={handleSearch}
                            disabled={searching || inviting || !canManageInvites || !inviteEmail.trim() || duplicateInvite}
                        >
                            <Search size={16} />
                            {searching ? 'Searching...' : 'Search'}
                        </button>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={inviting || searching || !canManageInvites || !inviteEmail.trim() || duplicateInvite}
                        >
                            <UserPlus size={16} />
                            {inviting ? 'Inviting...' : 'Invite'}
                        </button>
                    </div>
                </form>

                {selectedUser && (
                    <div className="members-search-result">
                        <div className="member-avatar">
                            {(selectedUser?.username?.[0] || selectedUser?.email?.[0] || 'U').toUpperCase()}
                        </div>
                        <div className="member-meta">
                            <span className="member-name">{selectedUser.username}</span>
                            <span className="member-email">{selectedUser.email}</span>
                        </div>
                    </div>
                )}

                {error && (
                    <p className="members-feedback members-feedback-error">
                        <AlertCircle size={15} />
                        <span>{error}</span>
                    </p>
                )}

                {success && (
                    <p className="members-feedback members-feedback-success">
                        <CheckCircle2 size={15} />
                        <span>{success}</span>
                    </p>
                )}
            </div>

            <div className="members-list-card glass">
                <div className="members-card-header">
                    <h3>Members</h3>
                    <span className="badge"><Users size={14} /> {members.length}</span>
                </div>

                {loadingMembers ? (
                    <div className="page-loading members-loading">
                        <div className="spinner"></div>
                        <p>Loading members...</p>
                    </div>
                ) : members.length === 0 ? (
                    <p className="text-muted">No members found in this workspace yet.</p>
                ) : (
                    <div className="members-list">
                        {members.map((member) => (
                            <div key={`${member.workspace_id || workspaceId}-${member.user_id || member.id}`} className="member-row">
                                <div className="member-avatar">
                                    {(member?.username?.[0] || member?.email?.[0] || 'U').toUpperCase()}
                                </div>
                                <div className="member-meta">
                                    <span className="member-name">{member.username || 'User'}</span>
                                    <span className="member-email">{member.email}</span>
                                </div>
                                <span className={`badge member-role role-${member.role || 'member'}`}>
                                    <Shield size={13} /> {member.role || 'member'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
