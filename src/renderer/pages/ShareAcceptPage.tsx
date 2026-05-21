import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Share2, CheckCircle, XCircle, Loader, Eye } from 'lucide-react';
import { ShareService } from '../services/share';
import { FirebaseService } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';

type AcceptState = 'loading' | 'success' | 'error' | 'guest';

export const ShareAcceptPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { state: { user, loading: authLoading } } = useAuth();
  const [acceptState, setAcceptState] = useState<AcceptState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [permission, setPermission] = useState('');
  const [projectId, setProjectId] = useState('');
  const wasProcessed = React.useRef(false);

  useEffect(() => {
    if (authLoading || wasProcessed.current) return;

    if (!token) {
      setAcceptState('error');
      setErrorMsg('Invalid share link.');
      return;
    }

    if (!user) {
      // Unauthenticated users can view the share link details to proceed as guest
      ShareService.getInstance().getShareLink(token).then(async (link) => {
        if (!link) {
          setAcceptState('error');
          setErrorMsg('Invalid share link.');
          return;
        }
        const project = await FirebaseService.getInstance().getNote(link.projectId);
        setProjectTitle(project?.title || 'Untitled Project');
        setProjectId(link.projectId);
        setAcceptState('guest');
      }).catch((err) => {
        console.error('[ShareAcceptPage] Guest fetch error:', err);
        setAcceptState('error');
        setErrorMsg('Something went wrong. Please check your connection.');
      });
      return;
    }

    // Mark as processed to prevent double-calls as auth settles
    wasProcessed.current = true;

    (async () => {
      try {
        const result = await ShareService.getInstance().acceptShareLink(token, user.uid);
        if (!result) {
          setAcceptState('error');
          setErrorMsg('This share link is invalid, expired, or has been revoked.');
          return;
        }

        // Fetch project metadata
        const project = await FirebaseService.getInstance().getNote(result.projectId);
        setProjectTitle(project?.title || 'Untitled Project');
        setPermission(result.permission);
        setAcceptState('success');

        // Auto-navigate after 3 seconds
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);
      } catch (err: any) {
        console.error('[ShareAcceptPage] Error:', err);
        setAcceptState('error');
        // Provide more detail if it's a permission error
        if (err.code === 'permission-denied') {
          setErrorMsg('Access Denied: You don\'t have permission to join this project.');
        } else {
          setErrorMsg(`Error: ${err.message || 'Something went wrong while processing the share link.'}`);
        }
      }
    })();
  }, [token, user, authLoading, navigate]);

  const containerStyle: React.CSSProperties = {
    height: '100dvh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--theme-background)',
    color: 'var(--theme-text-primary)',
    fontFamily: "'Inter', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  };

  const cardStyle: React.CSSProperties = {
    width: 420,
    maxWidth: 'calc(100vw - 48px)',
    background: 'var(--theme-surface)',
    border: '1px solid var(--theme-border)',
    borderRadius: 16,
    padding: '48px 36px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    textAlign: 'center',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.25)',
    animation: 'share-dialog-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    zIndex: 1,
  };

  const iconContainerStyle: React.CSSProperties = {
    width: 64,
    height: 64,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  // Background orbs
  const orbStyle = (color: string, size: number, top: string, left: string): React.CSSProperties => ({
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: '50%',
    background: color,
    filter: 'blur(80px)',
    opacity: 0.15,
    top,
    left,
  });

  return (
    <div style={containerStyle}>
      {/* Background orbs */}
      <div style={orbStyle('color-mix(in srgb, var(--theme-primary) 100%, transparent)', 300, '10%', '10%')} />
      <div style={orbStyle('color-mix(in srgb, var(--theme-secondary) 100%, transparent)', 250, '60%', '65%')} />

      <div style={cardStyle}>
        {acceptState === 'loading' && (
          <>
            <div style={{ ...iconContainerStyle, background: 'color-mix(in_srgb, var(--theme-primary) 15%, transparent)' }}>
              <Loader size={28} color="var(--theme-primary)" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                Joining project…
              </h2>
              <p style={{ fontSize: 14, color: 'var(--theme-text-secondary)', lineHeight: 1.5 }}>
                Processing your invitation link.
              </p>
            </div>
          </>
        )}

        {acceptState === 'success' && (
          <>
            <div style={{ ...iconContainerStyle, background: 'color-mix(in_srgb, var(--theme-success) 15%, transparent)' }}>
              <CheckCircle size={28} color="var(--theme-success)" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                You're in! 🎉
              </h2>
              <p style={{ fontSize: 14, color: 'var(--theme-text-secondary)', lineHeight: 1.5 }}>
                You've been added to <strong style={{ color: 'var(--theme-text-primary)' }}>{projectTitle}</strong> as{' '}
                {permission === 'editor' ? (
                  <span style={{ color: 'var(--theme-success)', fontWeight: 500 }}>an editor</span>
                ) : (
                  <span style={{ color: 'var(--theme-secondary)', fontWeight: 500 }}>a viewer</span>
                )}.
              </p>
              <p style={{ fontSize: 12, color: 'var(--theme-text-secondary)', marginTop: 12 }}>
                Redirecting to dashboard…
              </p>
            </div>
            <button
              onClick={() => navigate('/', { replace: true })}
              style={{
                padding: '10px 28px',
                background: 'var(--theme-primary)',
                border: 'none',
                borderRadius: 8,
                color: 'var(--theme-on-primary)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 12px color-mix(in_srgb, var(--theme-primary) 30%, transparent)',
                marginTop: 4,
              }}
            >
              Go to Dashboard
            </button>
          </>
        )}

        {acceptState === 'error' && (
          <>
            <div style={{ ...iconContainerStyle, background: 'color-mix(in_srgb, var(--theme-error) 15%, transparent)' }}>
              <XCircle size={28} color="var(--theme-error)" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                Link Invalid
              </h2>
              <p style={{ fontSize: 14, color: 'var(--theme-text-secondary)', lineHeight: 1.5 }}>
                {errorMsg}
              </p>
            </div>
            <button
              onClick={() => navigate('/', { replace: true })}
              style={{
                padding: '10px 28px',
                background: 'var(--theme-surface)',
                border: '1px solid var(--theme-border)',
                borderRadius: 8,
                color: 'var(--theme-text-primary)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                marginTop: 4,
              }}
            >
              Go to Dashboard
            </button>
          </>
        )}

        {acceptState === 'guest' && (
          <>
            <div style={{ ...iconContainerStyle, background: 'color-mix(in_srgb, var(--theme-secondary) 15%, transparent)' }}>
              <Eye size={28} color="var(--theme-secondary)" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                View Shared Project
              </h2>
              <p style={{ fontSize: 14, color: 'var(--theme-text-secondary)', lineHeight: 1.5 }}>
                You've been invited to view <strong style={{ color: 'var(--theme-text-primary)' }}>{projectTitle}</strong>.<br />
                Guests can View the document. To Edit, you must Sign In.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: 4 }}>
              <button
                onClick={() => navigate(`/guest/${projectId}`, { replace: true })}
                style={{
                  padding: '10px 20px',
                  background: 'var(--theme-surface)',
                  border: '1px solid var(--theme-border)',
                  borderRadius: 8,
                  color: 'var(--theme-text-primary)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Continue as Guest
              </button>
              <button
                onClick={() => navigate(`/login?redirect=/share/${token}`, { replace: true })}
                style={{
                  padding: '10px 20px',
                  background: 'var(--theme-primary)',
                  border: 'none',
                  borderRadius: 8,
                  color: 'var(--theme-on-primary)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 12px color-mix(in_srgb, var(--theme-primary) 30%, transparent)',
                  transition: 'all 0.15s',
                }}
              >
                Sign In
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
