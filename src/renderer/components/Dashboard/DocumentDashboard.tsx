import React, { useCallback, useEffect, useState, startTransition, useRef, useMemo } from 'react';
import { Plus, FolderPlus, Link2, Settings, LogOut, LayoutGrid, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PaperCard } from './PaperCard';
import { useAppStore } from '../../store/useAppStore';
import { useAuth } from '../../hooks/useAuth';
import { FirebaseService, DocumentSchema } from '../../services/firebase';
import { useUserProfile } from '../../hooks/useUserProfile';
import { SettingsModal } from '../Settings/SettingsModal';
import { getUserAvatar } from '../../utils/avatar.utils';
import { cleanPreviewText } from '../../utils/project.utils';
import { YjsService } from '../../services/yjs';
import { useNotifications } from '../../context/NotificationContext';
import { useBackground } from '../../context/BackgroundContext';
import './DocumentDashboard.css';

interface DocumentDashboardProps {
  onSelectProject: (id: string, title: string) => void;
}

type FilterTab = 'all' | 'mine' | 'recent';

interface ProjectExtras {
  preview?: string;
  loading: boolean;
  members: any[];
  docCount: number;
}


export const DocumentDashboard: React.FC<DocumentDashboardProps> = ({ onSelectProject }) => {
  const { state: { user } } = useAuth();
  const { addNotification } = useNotifications();
  const { dashboardBackground } = useBackground();

  const [projects, setProjects] = useState<DocumentSchema[]>([]);
  const [orderedProjects, setOrderedProjects] = useState<DocumentSchema[]>([]);
  const [activeThisWeek, setActiveThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityName, setActivityName] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityType, setActivityType] = useState<'individual' | 'group'>('individual');
  const [isJoining, setIsJoining] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const saveOrderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Drag state
  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  
  // Extra states for project cards
  const [projectExtras, setProjectExtras] = useState<Record<string, ProjectExtras>>({});
  
  const navigate = useNavigate();
  const { profile } = useUserProfile(user?.uid);

  // ── Keep orderedProjects in sync with projects + saved order ────────────
  useEffect(() => {
    if (projects.length === 0) return;

    // Try to restore saved order from localStorage first
    const storageKey = user?.uid ? `project-order-${user.uid}` : null;
    const savedOrder: string[] = storageKey
      ? JSON.parse(localStorage.getItem(storageKey) || '[]')
      : [];

    if (savedOrder.length > 0) {
      const orderMap = new Map(savedOrder.map((id, i) => [id, i]));
      const sorted = [...projects].sort((a, b) => {
        const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : projects.length;
        const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : projects.length;
        return ai - bi;
      });
      setOrderedProjects(sorted);
    } else {
      setOrderedProjects(projects);
    }
  }, [projects, user?.uid]);

  // ── Persist new order on drag end ────────────────────────────────────────
  const handleReorder = useCallback((newOrder: DocumentSchema[]) => {
    setOrderedProjects(newOrder);

    const ids = newOrder.map(p => p.id);
    const storageKey = user?.uid ? `project-order-${user.uid}` : null;
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(ids));
    }

    // Debounce Firestore save
    if (saveOrderTimerRef.current) clearTimeout(saveOrderTimerRef.current);
    saveOrderTimerRef.current = setTimeout(() => {
      if (user?.uid) {
        FirebaseService.getInstance().saveUserProfile(user.uid, { projectOrder: ids }).catch(err =>
          console.warn('[Dashboard] Failed to persist project order:', err)
        );
      }
    }, 1500);
  }, [user?.uid]);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Guest';
  const userInitials = displayName.substring(0, 2).toUpperCase();

  // Load projects from Firebase
  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const docs = await FirebaseService.getInstance().listUserNotes(user.uid);
      const filteredProjects = docs.filter(doc => doc.isProject);
      
      startTransition(() => {
        setProjects(filteredProjects);
      });
      
      // Calculate Active This Week: projects with any document edited in last 7 days
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const activeProjectIds = new Set<string>();
      docs.forEach(d => {
        if ((d.updatedAt || 0) > oneWeekAgo) {
          const pId = d.isProject ? d.id : d.parentId;
          if (pId) activeProjectIds.add(pId);
        }
      });
      setActiveThisWeek(activeProjectIds.size);

      // Initialize extras state
      const initialExtras: Record<string, ProjectExtras> = {};
      filteredProjects.forEach(p => {
        initialExtras[p.id] = { loading: true, members: [], docCount: 0 };
      });
      setProjectExtras(initialExtras);

      // Fetch extras asynchronously for each project
      filteredProjects.forEach(async (project) => {
        try {
          const [previewDoc, allDocs, profiles] = await Promise.all([
            FirebaseService.getInstance().getLatestDocumentPreview(project.id),
            FirebaseService.getInstance().listProjectNotes(project.id),
            FirebaseService.getInstance().getUserProfiles(project.collaborators || [])
          ]);

          const memberList = (project.collaborators || []).map(uid => ({
            id: uid,
            name: profiles[uid]?.name || 'Unknown',
            photoURL: profiles[uid]?.photoURL,
            photoBase64: (profiles[uid] as any)?.photoBase64
          }));

          startTransition(() => {
            setProjectExtras((prev: Record<string, ProjectExtras>) => ({
              ...prev,
              [project.id]: {
                preview: previewDoc ? cleanPreviewText(previewDoc.searchText || previewDoc.content || '') : undefined,
                loading: false,
                members: memberList,
                docCount: allDocs.length
              }
            }));
          });
        } catch (err) {
          console.error(`[Dashboard] Failed to load extras for project ${project.id}:`, err);
          setProjectExtras((prev: Record<string, ProjectExtras>) => ({
            ...prev,
            [project.id]: { ...prev[project.id], loading: false }
          }));
        }
      });

    } catch (err) {
      console.error('[Dashboard] Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProjects();
    }, 300); // Bug 2: Defer initial project loading
    return () => clearTimeout(timer);
  }, [loadProjects]);

  const handleCreateNew = useCallback(async () => {
    if (!user) return;
    
    const titleToUse = newProjectName.trim() || 'Untitled Project';
    const newProjectId = `project-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    try {
      const shareService = (await import('../../services/share')).ShareService.getInstance();
      const baseProjectData = {
        id: newProjectId,
        title: titleToUse,
        content: null,
        ownerId: user.uid,
        collaborators: [user.uid],
        createdAt: now,
        updatedAt: now,
        isProject: true,
      };

      const projectData = {
        ...baseProjectData,
        type: 'project' as const,
      };

      await FirebaseService.getInstance().createNote(newProjectId, projectData);
      
      setIsCreating(false);
      setNewProjectName('');
      onSelectProject(newProjectId, titleToUse);
      addNotification({ title: 'Project Created', message: `"${titleToUse}" is ready.`, type: 'success' });
    } catch (err) {
      console.error('[Dashboard] Failed to create project:', err);
      addNotification({ title: 'Creation Failed', message: 'Could not create project. Please try again.', type: 'error' });
    }
  }, [user, newProjectName, onSelectProject]);

  const handleCreateActivityProject = useCallback(async () => {
    if (!user) return;
    
    const titleToUse = activityName.trim();
    if (!titleToUse) return;

    const newProjectId = `activity-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    try {
      const shareService = (await import('../../services/share')).ShareService.getInstance();
      
      const projectData = {
        id: newProjectId,
        title: titleToUse,
        description: activityDescription.trim(),
        content: null,
        ownerId: user.uid,
        collaborators: [user.uid],
        createdAt: now,
        updatedAt: now,
        isProject: true,
        type: 'activity' as const,
        activityType: activityType,
        studentInviteCode: shareService.generateToken(),
        adminInviteCode: shareService.generateToken(),
      };

      await FirebaseService.getInstance().createNote(newProjectId, projectData);
      
      // Set owner permission as admin
      const db = FirebaseService.getInstance().db;
      const { doc, setDoc } = await import('firebase/firestore');
      const permRef = doc(db, 'projectPermissions', `${newProjectId}_${user.uid}`);
      await setDoc(permRef, {
        projectId: newProjectId,
        userId: user.uid,
        role: 'admin',
        grantedAt: now,
        grantedByToken: 'creator',
      });
      
      setShowActivityModal(false);
      setActivityName('');
      setActivityDescription('');
      setActivityType('individual');
      onSelectProject(newProjectId, titleToUse);
      addNotification({ title: 'Activity Project Created', message: `"${titleToUse}" is ready.`, type: 'success' });
    } catch (err) {
      console.error('[Dashboard] Failed to create activity project:', err);
      addNotification({ title: 'Creation Failed', message: 'Could not create activity project.', type: 'error' });
    }
  }, [user, activityName, activityDescription, onSelectProject]);

  const handleJoinProject = useCallback(() => {
    const link = joinLink.trim();
    if (!link) return;
    
    let token = link;
    if (link.includes('/share/')) {
       token = link.split('/share/').pop() || link;
    }
    
    if (token) {
       navigate(`/share/${token}`);
    }
  }, [joinLink, navigate]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    const project = projects.find((p: DocumentSchema) => p.id === projectId);
    if (project && project.ownerId !== user?.uid) {
      alert('Only the project owner can delete this project');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await FirebaseService.getInstance().deleteNote(projectId);
      setProjects((prev: DocumentSchema[]) => prev.filter((d: DocumentSchema) => d.id !== projectId));
      setOrderedProjects((prev: DocumentSchema[]) => prev.filter((d: DocumentSchema) => d.id !== projectId));
      // Global fix for focus bug on Windows: force reload after delete
      window.location.reload();
    } catch (err) {
      console.error('[Dashboard] Failed to delete project:', err);
      addNotification({ title: 'Delete Failed', message: 'Could not delete project.', type: 'error' });
    }
  }, [projects, user?.uid]);

  // Filtered projects — sourced from orderedProjects to respect drag order
  const filteredProjects = orderedProjects.filter((proj: DocumentSchema) => {
    if (activeTab === 'mine') return proj.ownerId === user?.uid;
    if (activeTab === 'recent') {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return (proj.updatedAt || 0) > oneWeekAgo;
    }
    return true;
  });

  // Live-preview reordered list while dragging
  const displayProjects = useMemo(() => {
    if (dragSrcIdx === null || dragOverIdx === null || dragSrcIdx === dragOverIdx) {
      return filteredProjects;
    }
    const result = [...filteredProjects];
    const [moved] = result.splice(dragSrcIdx, 1);
    result.splice(dragOverIdx, 0, moved);
    return result;
  }, [filteredProjects, dragSrcIdx, dragOverIdx]);

  // Drag handlers
  const handleDragStart = useCallback((idx: number) => {
    setDragSrcIdx(idx);
    setDragOverIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragSrcIdx === null) return;

    // Compute new full order: take the filteredProjects reordering and apply it back to orderedProjects
    const reordered = [...filteredProjects];
    const [moved] = reordered.splice(dragSrcIdx, 1);
    reordered.splice(idx, 0, moved);

    // Build new full ordered list (merge filtered reorder back with non-filtered)
    const filteredIds = new Set(filteredProjects.map(p => p.id));
    const nonFiltered = orderedProjects.filter(p => !filteredIds.has(p.id));
    const newOrder = [...reordered, ...nonFiltered];

    handleReorder(newOrder);
    setDragSrcIdx(null);
    setDragOverIdx(null);
  }, [dragSrcIdx, filteredProjects, orderedProjects, handleReorder]);

  const handleDragEnd = useCallback(() => {
    setDragSrcIdx(null);
    setDragOverIdx(null);
  }, []);

  const totalProjectsCount = projects.length;
  const myProjectsCount = projects.filter((d: DocumentSchema) => d.ownerId === user?.uid).length;
  // recentProjectsCount is now activeThisWeek

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div 
      className="dashboard" 
      id="document-dashboard"
      style={{
        backgroundImage: dashboardBackground ? `url(${dashboardBackground})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="dashboard__inner">
        {/* Header */}
        <div className="dashboard__header">
          <div className="dashboard__header-content">
            <h1 className="dashboard__greeting">
              {getGreeting()}, {displayName} <span className="dashboard__greeting-wave">👋</span>
            </h1>
            <p className="dashboard__subtitle">
              Pick up where you left off, or start a new project.
            </p>
          </div>
          
          <div className="dashboard__user-section">
            <div className="dashboard__user-profile">
              <div className={`dashboard__avatar dashboard__avatar--${profile?.role || 'collaborator'}`}>
                {getUserAvatar({ ...profile, providerData: user?.providerData, photoURL: user?.photoURL }) ? (
                  <img 
                    src={getUserAvatar({ ...profile, providerData: user?.providerData, photoURL: user?.photoURL })!} 
                    alt={displayName} 
                    className="dashboard__avatar-img" 
                  />
                ) : userInitials}
              </div>
              <div className="dashboard__user-meta">
                <span className="dashboard__user-name">{displayName}</span>
                {profile?.role === 'instructor' && (
                  <span className="dashboard__role-badge dashboard__role-badge--instructor">
                    <span className="dashboard__role-badge-dot"></span>
                    🎓 Instructor
                  </span>
                )}
                {profile?.role === 'student' && (
                  <span className="dashboard__role-badge dashboard__role-badge--student">
                    <span className="dashboard__role-badge-dot"></span>
                    📖 Student
                  </span>
                )}
                {!profile?.role && (
                  <span className="dashboard__role-badge dashboard__role-badge--collaborator">
                    <span className="dashboard__role-badge-dot"></span>
                    👤 Collaborator
                  </span>
                )}
              </div>
            </div>
            
            <div className="dashboard__nav-actions">
              <button className="dashboard__nav-btn" onClick={() => setShowSettingsModal(true)} title="Settings">
                <Settings size={18} />
              </button>
              <button className="dashboard__nav-btn dashboard__nav-btn--logout" onClick={() => setShowLogoutConfirm(true)} title="Log Out">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="dashboard__actions">
          {!isCreating && !isJoining && (
            <>
              <button className="dashboard__action-btn dashboard__action-btn--primary" onClick={() => setIsCreating(true)} id="dashboard-new-doc">
                <FolderPlus size={16} />
                New Project
              </button>
              <button className="dashboard__action-btn dashboard__action-btn--activity" onClick={() => setShowActivityModal(true)} style={{ background: 'linear-gradient(135deg, #7c6bf0 0%, #6558d4 100%)', color: '#fff', border: 'none' }}>
                <Zap size={16} />
                New Activity Project
              </button>
              <button className="dashboard__action-btn" onClick={() => setIsJoining(true)} style={{ background: 'var(--surface-raised, #252530)' }}>
                <Link2 size={16} />
                Join via Link
              </button>
            </>
          )}

          {isCreating && (
            <div className="dashboard__create-inline" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Name your project..." 
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                ref={(el) => {
                  if (el) setTimeout(() => el.focus(), 50); // Bug 2.5: Focus fix
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateNew();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewProjectName('');
                  }
                }}
                className="dashboard__input"
              />
              <button 
                className="dashboard__action-btn dashboard__action-btn--primary" 
                onClick={handleCreateNew}
              >
                Create
              </button>
              <button 
                className="dashboard__action-btn" 
                onClick={() => { setIsCreating(false); setNewProjectName(''); }}
                style={{ background: 'transparent' }}
              >
                Cancel
              </button>
            </div>
          )}

          {isJoining && (
            <div className="dashboard__create-inline" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Paste link or token here..." 
                value={joinLink}
                onChange={(e) => setJoinLink(e.target.value)}
                ref={(el) => {
                  if (el) setTimeout(() => el.focus(), 50); // Bug 2.5: Focus fix
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleJoinProject();
                  if (e.key === 'Escape') {
                    setIsJoining(false);
                    setJoinLink('');
                  }
                }}
                className="dashboard__input"
                style={{ width: '250px' }}
              />
              <button 
                className="dashboard__action-btn dashboard__action-btn--primary" 
                onClick={handleJoinProject}
              >
                Join
              </button>
              <button 
                className="dashboard__action-btn" 
                onClick={() => { setIsJoining(false); setJoinLink(''); }}
                style={{ background: 'transparent' }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="dashboard__stats">
          <div className="dashboard__stat-card dashboard__stat-card--purple">
            <div className="dashboard__stat-label">Total Projects</div>
            <div className="dashboard__stat-value">{totalProjectsCount}</div>
          </div>
          <div className="dashboard__stat-card dashboard__stat-card--blue">
            <div className="dashboard__stat-label">My Projects</div>
            <div className="dashboard__stat-value">{myProjectsCount}</div>
          </div>
          <div className="dashboard__stat-card dashboard__stat-card--green">
            <div className="dashboard__stat-label">Active This Week</div>
            <div className="dashboard__stat-value">{activeThisWeek}</div>
          </div>
        </div>

        {/* Recent Projects Section Header */}
        <div className="dashboard__section-header">
          <h2 className="dashboard__section-title">Projects</h2>
          <div className="dashboard__tabs">
            {(['all', 'mine', 'recent'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                className={`dashboard__tab ${activeTab === tab ? 'dashboard__tab--active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'all' ? 'All' : tab === 'mine' ? 'Mine' : 'Recent'}
              </button>
            ))}
          </div>
        </div>

        {/* Project Grid */}
        {loading ? (
          <div className="dashboard__grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="paper-card skeleton" style={{ minHeight: '180px' }}>
                <div className="paper-card__body">
                  <div className="skeleton-text" style={{ width: '60%', height: '24px' }} />
                  <div className="skeleton-text" style={{ width: '100%', height: '14px' }} />
                  <div className="skeleton-text" style={{ width: '85%', height: '14px' }} />
                </div>
                <div className="paper-card__footer" style={{ marginTop: 'auto' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <div className="skeleton-circle" style={{ width: '24px', height: '24px' }} />
                    <div className="skeleton-circle" style={{ width: '24px', height: '24px' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="dashboard__grid">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="dashboard__empty"
            >
              <div className="dashboard__empty-illustration">
                <div className="empty-shape-1" />
                <div className="empty-shape-2" />
                <LayoutGrid size={64} className="dashboard__empty-icon" />
              </div>
              <h3 className="dashboard__empty-title">No projects yet</h3>
              <p className="dashboard__empty-desc">
                Your creative journey starts here. Create a project to begin collaborating in real-time.
              </p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button className="dashboard__action-btn dashboard__action-btn--primary" onClick={() => setIsCreating(true)}>
                  <Plus size={16} />
                  New Project
                </button>
                <button className="dashboard__action-btn" onClick={() => setIsJoining(true)}>
                  <Link2 size={16} />
                  Join via Link
                </button>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="dashboard__grid">
            {displayProjects.map((proj: DocumentSchema, index: number) => {
              const isDragging = dragSrcIdx !== null && proj.id === filteredProjects[dragSrcIdx]?.id;
              const isDragOver = index === dragOverIdx && dragSrcIdx !== null;
              
              return (
                <motion.div
                  key={proj.id}
                  layout
                  transition={{
                    type: 'spring',
                    stiffness: 350,
                    damping: 28,
                    mass: 0.8
                  }}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{
                    cursor: 'grab',
                    opacity: isDragging ? 0.3 : 1,
                    transform: isDragOver ? 'scale(1.02)' : 'scale(1)',
                    position: 'relative',
                  }}
                  className={`dashboard__draggable-wrapper ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
                >
                  {/* Subtle drag cue icon on hover */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      zIndex: 10,
                      pointerEvents: 'none',
                      opacity: 0.3,
                      transition: 'opacity 0.2s',
                    }}
                    className="drag-cue"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="12" r="1"></circle>
                      <circle cx="9" cy="5" r="1"></circle>
                      <circle cx="9" cy="19" r="1"></circle>
                      <circle cx="15" cy="12" r="1"></circle>
                      <circle cx="15" cy="5" r="1"></circle>
                      <circle cx="15" cy="19" r="1"></circle>
                    </svg>
                  </div>
                  <PaperCard
                    doc={proj}
                    onClick={() => {
                      if (dragSrcIdx === null) {
                        onSelectProject(proj.id, proj.title || 'Untitled Project');
                      }
                    }}
                    onDelete={proj.ownerId === user?.uid ? () => handleDeleteProject(proj.id) : undefined}
                    previewText={projectExtras[proj.id]?.preview}
                    previewLoading={projectExtras[proj.id]?.loading}
                    members={projectExtras[proj.id]?.members}
                    docCount={projectExtras[proj.id]?.docCount}
                  />
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="modal-content modal-content--small" onClick={e => e.stopPropagation()}>
            <h3>Log out?</h3>
            <p>Are you sure you want to log out?</p>
            <div className="modal-actions">
              <button className="btn btn--secondary" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="btn btn--danger" onClick={async () => {
                try {
                  sessionStorage.setItem('explicitly_logged_out', 'true');
                  useAppStore.getState().reset();
                  await YjsService.getInstance().clearAllPersistence();
                  await FirebaseService.getInstance().auth.signOut();
                  navigate('/login');
                } catch (err) {
                  console.error('[Dashboard] Logout failed:', err);
                  window.location.reload();
                }
              }}>Log out</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
      />

      {/* New Activity Project Modal */}
      {showActivityModal && (
        <div className="modal-overlay" onClick={() => setShowActivityModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ padding: '8px', background: 'rgba(124, 107, 240, 0.1)', borderRadius: '8px' }}>
                <Zap size={20} color="#7c6bf0" />
              </div>
              <h2 style={{ margin: 0 }}>New Activity Project</h2>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="modal-field">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#a0a4b8' }}>Activity Project Name</label>
                <input 
                  type="text" 
                  placeholder="Enter project name..." 
                  value={activityName}
                  onChange={(e) => setActivityName(e.target.value)}
                  ref={(el) => {
                    if (el) setTimeout(() => el.focus(), 50); // Bug 2.5: Focus fix
                  } }
                  className="dashboard__input"
                  style={{ width: '100%' }}
                />
              </div>
              
              <div className="modal-field">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#a0a4b8' }}>Description (optional)</label>
                <textarea 
                  placeholder="Describe what students will learn..." 
                  value={activityDescription}
                  onChange={(e) => setActivityDescription(e.target.value)}
                  className="dashboard__input"
                  style={{ width: '100%', minHeight: '80px', padding: '10px', resize: 'vertical' }}
                />
              </div>

              <div className="modal-field">
                <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px', color: '#a0a4b8' }}>Activity Type</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label className={`activity-type-option ${activityType === 'individual' ? 'activity-type-option--selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="activityType" 
                      value="individual" 
                      checked={activityType === 'individual'} 
                      onChange={() => setActivityType('individual')}
                      className="activity-type-radio"
                    />
                    <div>
                      <div className="activity-type-title">Individual Activity</div>
                      <div className="activity-type-description">
                        Each student works in their own isolated workspace. Actions by one student do not affect others.
                      </div>
                    </div>
                  </label>
                  <label className={`activity-type-option ${activityType === 'group' ? 'activity-type-option--selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="activityType" 
                      value="group" 
                      checked={activityType === 'group'} 
                      onChange={() => setActivityType('group')}
                      className="activity-type-radio"
                    />
                    <div>
                      <div className="activity-type-title">Group Activity</div>
                      <div className="activity-type-description">
                        Students share the same workspace and collaborate together.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button 
                className="btn btn--secondary" 
                onClick={() => { setShowActivityModal(false); setActivityName(''); setActivityDescription(''); }}
              >
                Cancel
              </button>
              <button 
                className="btn btn--primary" 
                onClick={handleCreateActivityProject}
                disabled={!activityName.trim()}
                style={{ background: 'linear-gradient(135deg, #7c6bf0 0%, #6558d4 100%)', border: 'none' }}
              >
                Create Activity Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
