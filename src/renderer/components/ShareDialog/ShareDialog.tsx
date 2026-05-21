import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  Eye,
  Link2,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { ShareService, ShareLink, SharePermission } from '../../services/share';
import { useAuth } from '../../hooks/useAuth';
import { FirebaseService } from '../../services/firebase';
import './ShareDialog.css';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  projectTitle,
}) => {
  const { state: { user } } = useAuth();
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [permission, setPermission] = useState<SharePermission>('editor');
  const [showPermissionDropdown, setShowPermissionDropdown] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [projectType, setProjectType] = useState<string | null>(null);
  const [studentInviteCode, setStudentInviteCode] = useState<string | null>(null);
  const [adminInviteCode, setAdminInviteCode] = useState<string | null>(null);

  // Load existing share links and project metadata
  const loadLinks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [data, projectDoc] = await Promise.all([
        ShareService.getInstance().getShareLinks(projectId),
        FirebaseService.getInstance().getNote(projectId)
      ]);
      setLinks(data);
      if (projectDoc) {
        setProjectType(projectDoc.type || null);
        
        let sCode = projectDoc.studentInviteCode;
        let aCode = projectDoc.adminInviteCode;
        
        // Auto-generate if missing (for legacy projects)
        if (!sCode || !aCode) {
          const shareService = ShareService.getInstance();
          const updates: any = {};
          if (!sCode) {
            sCode = shareService.generateToken();
            updates.studentInviteCode = sCode;
          }
          if (!aCode) {
            aCode = shareService.generateToken();
            updates.adminInviteCode = aCode;
          }
          await FirebaseService.getInstance().saveNote(projectId, updates);
        }

        setStudentInviteCode(sCode || null);
        setAdminInviteCode(aCode || null);
      }
    } catch (err) {
      console.error('[ShareDialog] Failed to load links:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      loadLinks();
    }
  }, [isOpen, loadLinks]);

  const handleCreateLink = useCallback(async () => {
    if (!user) {
      showToast('You must be logged in to share.');
      return;
    }
    if (!projectId) {
      showToast('No project selected to share.');
      return;
    }
    setCreating(true);
    try {
      const displayName = user.displayName || user.email?.split('@')[0] || 'User';
      const link = await ShareService.getInstance().createShareLink(
        projectId,
        permission,
        user.uid,
        displayName,
      );
      setLinks((prev) => [link, ...prev]);
      showToast('Share code created!');
    } catch (err: any) {
      console.error('[ShareDialog] Failed to create link:', err);
      showToast('Failed to create code: ' + (err.message || 'Unknown error'));
    } finally {
      setCreating(false);
    }
  }, [user, projectId, permission]);

  // Copy link to clipboard
  const handleCopyLink = useCallback(async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(token);
      showToast('Code copied to clipboard!');
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      // Fallback for Electron
      const textarea = document.createElement('textarea');
      textarea.value = token;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedToken(token);
      showToast('Code copied to clipboard!');
      setTimeout(() => setCopiedToken(null), 2000);
    }
  }, []);

  // Revoke link
  const handleRevokeLink = useCallback(async (token: string) => {
    try {
      await ShareService.getInstance().deleteShareLink(token);
      setLinks((prev) => prev.filter((l) => l.token !== token));
      showToast('Share code revoked');
    } catch (err) {
      console.error('[ShareDialog] Failed to revoke link:', err);
    }
  }, []);

  // Toast helper
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Format relative time
  const formatTime = (ts: number): string => {
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showPermissionDropdown) return;
    const handleClick = () => setShowPermissionDropdown(false);
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [showPermissionDropdown]);

  if (!isOpen) return null;

  return (
    <div className="share-overlay" onClick={onClose} id="share-overlay">
      <div
        className="share-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Share project"
        id="share-dialog"
      >
        {/* Header */}
        <div className="share-dialog__header">
          <div className="share-dialog__header-left">
            <div className="share-dialog__icon">
              <Share2 size={18} />
            </div>
            <div>
              <div className="share-dialog__title">Share Project</div>
              <div className="share-dialog__subtitle">{projectTitle}</div>
            </div>
          </div>
          <button
            className="share-dialog__close"
            onClick={onClose}
            title="Close"
            type="button"
            id="share-dialog-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="share-dialog__body">
          {loading ? (
            <div className="share-dialog__loading">
              <span className="loading-spinner" />
              Loading share details…
            </div>
          ) : (projectType === 'activity' || projectType === 'project') ? (
            <div className="share-dialog__activity-codes">
              <div className="share-dialog__links-header" style={{ marginTop: 0 }}>
                Project Invite Codes
              </div>
              <p style={{ fontSize: 13, color: 'var(--theme-text-secondary)', marginBottom: 16 }}>
                Share these codes with participants. Their role is automatically assigned based on the code they use.
              </p>
              
              <div className="share-link-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--theme-primary)', fontWeight: 600 }}>
                  <Eye size={16} /> Student Invite Code
                </div>
                <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', background: `color-mix(in srgb, var(--theme-background) ${0.2 * 100}%, transparent)`, padding: '8px 12px', borderRadius: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 14, letterSpacing: 1 }}>{studentInviteCode}</span>
                  <button
                    className={`share-link-row__btn share-link-row__btn--copy ${copiedToken === studentInviteCode ? 'share-link-row__btn--copied' : ''}`}
                    onClick={() => studentInviteCode && handleCopyLink(studentInviteCode)}
                    title="Copy code"
                    type="button"
                  >
                    {copiedToken === studentInviteCode ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                  </button>
                </div>
              </div>

              <div className="share-link-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: 16, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--theme-secondary)', fontWeight: 600 }}>
                  <Pencil size={16} /> Admin/Instructor Invite Code
                </div>
                <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', background: `color-mix(in srgb, var(--theme-background) ${0.2 * 100}%, transparent)`, padding: '8px 12px', borderRadius: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 14, letterSpacing: 1 }}>{adminInviteCode}</span>
                  <button
                    className={`share-link-row__btn share-link-row__btn--copy ${copiedToken === adminInviteCode ? 'share-link-row__btn--copied' : ''}`}
                    onClick={() => adminInviteCode && handleCopyLink(adminInviteCode)}
                    title="Copy code"
                    type="button"
                  >
                    {copiedToken === adminInviteCode ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Create New Link */}
              <div className="share-dialog__create">
                {/* Permission Selector */}
                <div className="share-dialog__permission-select" onMouseDown={(e) => e.stopPropagation()}>
                  <button
                    className="share-dialog__permission-btn"
                    onClick={() => setShowPermissionDropdown((v) => !v)}
                    type="button"
                    id="share-permission-toggle"
                  >
                    {permission === 'editor' ? (
                      <>
                        <Pencil size={14} />
                        Can Edit
                      </>
                    ) : (
                      <>
                        <Eye size={14} />
                        Can View
                      </>
                    )}
                    <ChevronDown size={14} />
                  </button>

                  {showPermissionDropdown && (
                    <div className="share-dialog__permission-dropdown">
                      <button
                        className={`share-dialog__permission-option ${permission === 'editor' ? 'share-dialog__permission-option--active' : ''}`}
                        onClick={() => {
                          setPermission('editor');
                          setShowPermissionDropdown(false);
                        }}
                        type="button"
                      >
                        <span className="share-dialog__permission-option-label">
                          <Pencil size={14} /> Can Edit
                        </span>
                        <span className="share-dialog__permission-option-desc">
                          Collaborators can edit documents, create files, and make changes.
                        </span>
                      </button>
                      <button
                        className={`share-dialog__permission-option ${permission === 'viewer' ? 'share-dialog__permission-option--active' : ''}`}
                        onClick={() => {
                          setPermission('viewer');
                          setShowPermissionDropdown(false);
                        }}
                        type="button"
                      >
                        <span className="share-dialog__permission-option-label">
                          <Eye size={14} /> Can View
                        </span>
                        <span className="share-dialog__permission-option-desc">
                          Collaborators can view documents but cannot make any changes.
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Create Button */}
                <button
                  className="share-dialog__create-btn"
                  onClick={handleCreateLink}
                  disabled={creating}
                  type="button"
                  id="share-create-link"
                >
                  {creating ? (
                    <>
                      <span className="loading-spinner" style={{ width: 14, height: 14 }} />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      Create Code
                    </>
                  )}
                </button>
              </div>

              {/* Active Links */}
              <div className="share-dialog__links-header">
                Active Codes ({links.length})
              </div>

              {links.length === 0 ? (
                <div className="share-dialog__links-empty">
                  <div className="share-dialog__links-empty-icon">
                    <Link2 size={22} />
                  </div>
                  <span className="share-dialog__links-empty-text">
                    No share codes yet.<br />
                    Create one to invite collaborators.
                  </span>
                </div>
              ) : (
                <div className="share-dialog__link-list">
                  {links.map((link) => (
                    <div key={link.token} className="share-link-row">
                      <div className={`share-link-row__icon share-link-row__icon--${link.permission}`}>
                        {link.permission === 'editor' ? <Pencil size={16} /> : <Eye size={16} />}
                      </div>
                      <div className="share-link-row__info">
                        <div className="share-link-row__permission">
                          {link.permission === 'editor' ? 'Can Edit' : 'View Only'}
                        </div>
                        <div className="share-link-row__meta">
                          Created by {link.createdByName} · {formatTime(link.createdAt)}
                        </div>
                      </div>
                      <div className="share-link-row__actions">
                        <button
                          className={`share-link-row__btn share-link-row__btn--copy ${copiedToken === link.token ? 'share-link-row__btn--copied' : ''}`}
                          onClick={() => handleCopyLink(link.token)}
                          title="Copy code"
                          type="button"
                        >
                          {copiedToken === link.token ? (
                            <>
                              <Check size={12} />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              Copy
                            </>
                          )}
                        </button>
                        <button
                          className="share-link-row__btn share-link-row__btn--revoke"
                          onClick={() => handleRevokeLink(link.token)}
                          title="Revoke code"
                          type="button"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Toast */}
        {toast && <div className="share-dialog__toast">{toast}</div>}
      </div>
    </div>
  );
};
