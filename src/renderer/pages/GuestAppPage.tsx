import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CollaborativeEditor from '../components/Editor/CollaborativeEditor';
import { FirebaseService } from '../services/firebase';
import { LogIn } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const GuestAppPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('Shared Document');
  const [loading, setLoading] = useState(true);

  const { state: { user, loading: authLoading } } = useAuth();

  useEffect(() => {
    // If we've finished loading auth and there is NO user,
    // we sign in anonymously so the guest has a UID for Firestore rules.
    if (!authLoading && !user) {
      console.log('[GuestAppPage] Signing in anonymously...');
      FirebaseService.getInstance().signInAnonymously().catch(err => {
        console.error('[GuestAppPage] Anonymous sign-in failed:', err);
      });
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (!projectId) return;
    FirebaseService.getInstance().getNote(projectId).then((note) => {
      if (note) setTitle(note.title || 'Untitled Document');
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0a4b8' }}>
        Loading document…
      </div>
    );
  }

  return (
    <div className="app-layout">
      <div className="app-main" style={{ borderRadius: 0, marginLeft: 0 }}>
        {/* Guest Top Bar */}
        <div className="app-top-bar" style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6dd49e', background: 'rgba(109, 212, 158, 0.1)', padding: '4px 8px', borderRadius: 4, marginRight: 12 }}>
              COLLABORATING
            </span>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#e8eaf0' }}>
              {title}
            </span>
          </div>
          <button
            onClick={() => navigate('/login')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              background: 'linear-gradient(135deg, #7c6bf0 0%, #6558d4 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(124, 107, 240, 0.3)',
            }}
          >
            <LogIn size={14} />
            Create Account
          </button>
        </div>

        {/* Editor Area */}
        <div className="app-content">
          <div className="app-editor-area" style={{ flex: 1, overflowY: 'auto' }}>
            <CollaborativeEditor
              roomName={projectId || ''}
              projectId={projectId}
              username={user?.isAnonymous ? 'Guest' : (user?.displayName || 'Guest')}
              userId={user?.uid}
              color="#7c6bf0"
              title={title}
              onTitleChange={setTitle}
              readOnly={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
