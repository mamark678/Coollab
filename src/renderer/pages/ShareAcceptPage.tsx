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
    background: 'linear-gradient(168deg, #0a0a12 0%, #111118 100%)',
    color: '#e8eaf0',
    fontFamily: "'Inter', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  };

  const cardStyle: React.CSSProperties = {
    width: 420,
    maxWidth: 'calc(100vw - 48px)',
    background: 'linear-gradient(168deg, #16161e 0%, #111118 100%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: '48px 36px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    textAlign: 'center',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
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
      <div style={orbStyle('rgba(124, 107, 240, 1)', 300, '10%', '10%')} />
      <div style={orbStyle('rgba(78, 161, 247, 1)', 250, '60%', '65%')} />

      <div style={cardStyle}>
        {acceptState === 'loading' && (
          <>
            <div style={{ ...iconContainerStyle, background: 'rgba(124, 107, 240, 0.15)' }}>
              <Loader size={28} color="#9485f5" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                Joining project…
              </h2>
              <p style={{ fontSize: 14, color: '#a0a4b8', lineHeight: 1.5 }}>
                Processing your invitation link.
              </p>
            </div>
          </>
        )}

        {acceptState === 'success' && (
          <>
            <div style={{ ...iconContainerStyle, background: 'rgba(109, 212, 158, 0.15)' }}>
              <CheckCircle size={28} color="#6dd49e" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                You're in! 🎉
              </h2>
              <p style={{ fontSize: 14, color: '#a0a4b8', lineHeight: 1.5 }}>
                You've been added to <strong style={{ color: '#e8eaf0' }}>{projectTitle}</strong> as{' '}
                {permission === 'editor' ? (
                  <span style={{ color: '#6dd49e', fontWeight: 500 }}>an editor</span>
                ) : (
                  <span style={{ color: '#4ea1f7', fontWeight: 500 }}>a viewer</span>
                )}.
              </p>
              <p style={{ fontSize: 12, color: '#6b6f82', marginTop: 12 }}>
                Redirecting to dashboard…
              </p>
            </div>
            <button
              onClick={() => navigate('/', { replace: true })}
              style={{
                padding: '10px 28px',
                background: 'linear-gradient(135deg, #7c6bf0 0%, #6558d4 100%)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(124, 107, 240, 0.3)',
                marginTop: 4,
              }}
            >
              Go to Dashboard
            </button>
          </>
        )}

        {acceptState === 'error' && (
          <>
            <div style={{ ...iconContainerStyle, background: 'rgba(230, 107, 122, 0.15)' }}>
              <XCircle size={28} color="#e66b7a" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                Link Invalid
              </h2>
              <p style={{ fontSize: 14, color: '#a0a4b8', lineHeight: 1.5 }}>
                {errorMsg}
              </p>
            </div>
            <button
              onClick={() => navigate('/', { replace: true })}
              style={{
                padding: '10px 28px',
                background: 'var(--surface-raised, #252530)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                color: '#e8eaf0',
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
            <div style={{ ...iconContainerStyle, background: 'rgba(78, 161, 247, 0.15)' }}>
              <Eye size={28} color="#4ea1f7" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                View Shared Project
              </h2>
              <p style={{ fontSize: 14, color: '#a0a4b8', lineHeight: 1.5 }}>
                You've been invited to view <strong style={{ color: '#e8eaf0' }}>{projectTitle}</strong>.<br />
                Guests can View the document. To Edit, you must Sign In.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: 4 }}>
              <button
                onClick={() => navigate(`/guest/${projectId}`, { replace: true })}
                style={{
                  padding: '10px 20px',
                  background: 'var(--surface-raised, #252530)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 8,
                  color: '#e8eaf0',
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
                  background: 'linear-gradient(135deg, #7c6bf0 0%, #6558d4 100%)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 12px rgba(124, 107, 240, 0.3)',
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
