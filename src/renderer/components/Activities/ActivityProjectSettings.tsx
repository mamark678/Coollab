import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, Settings, Zap } from 'lucide-react';
import { FirebaseService, DocumentSchema } from '../../services/firebase';
import './Activities.css';

interface ActivityProjectSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export const ActivityProjectSettings: React.FC<ActivityProjectSettingsProps> = ({
  isOpen,
  onClose,
  projectId
}) => {
  const [projectData, setProjectData] = useState<DocumentSchema | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState<'individual' | 'group'>('individual');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!isOpen || !projectId) return;

    setLoading(true);
    FirebaseService.getInstance().getNote(projectId).then(doc => {
      if (doc) {
        setProjectData(doc);
        setName(doc.title || '');
        setDescription(doc.description || '');
        setActivityType(doc.activityType || 'individual');
      }
      setLoading(false);
    });
  }, [isOpen, projectId]);

  const handleSave = async () => {
    if (activityType !== projectData?.activityType) {
      setShowWarning(true);
      return;
    }
    await performSave();
  };

  const performSave = async () => {
    setSaving(true);
    try {
      await FirebaseService.getInstance().saveNote(projectId, {
        title: name,
        description,
        activityType
      });
      onClose();
    } catch (err) {
      console.error('[ActivitySettings] Save failed:', err);
    } finally {
      setSaving(false);
      setShowWarning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: 'rgba(124, 107, 240, 0.1)', borderRadius: '8px' }}>
              <Settings size={20} color="#7c6bf0" />
            </div>
            <h2 style={{ margin: 0 }}>Project Settings</h2>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#a0a4b8' }}>Loading settings...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="modal-field">
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#a0a4b8' }}>Project Name</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="dashboard__input"
                style={{ width: '100%' }}
              />
            </div>

            <div className="modal-field">
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#a0a4b8' }}>Description</label>
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="dashboard__input"
                style={{ width: '100%', minHeight: '80px', padding: '10px', resize: 'vertical' }}
              />
            </div>

            <div className="modal-field">
              <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px', color: '#a0a4b8' }}>Activity Type</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', gap: '10px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="activityTypeEdit" 
                    value="individual" 
                    checked={activityType === 'individual'} 
                    onChange={() => setActivityType('individual')}
                    style={{ marginTop: '4px' }}
                  />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>Individual Activity</div>
                    <div style={{ fontSize: '12px', color: '#a0a4b8' }}>Students work in isolated workspaces.</div>
                  </div>
                </label>
                <label style={{ display: 'flex', gap: '10px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="activityTypeEdit" 
                    value="group" 
                    checked={activityType === 'group'} 
                    onChange={() => setActivityType('group')}
                    style={{ marginTop: '4px' }}
                  />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>Group Activity</div>
                    <div style={{ fontSize: '12px', color: '#a0a4b8' }}>Students share the same workspace.</div>
                  </div>
                </label>
              </div>
            </div>

            {showWarning && (
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid rgba(239, 68, 68, 0.2)', 
                borderRadius: '8px', 
                padding: '12px',
                display: 'flex',
                gap: '12px',
                marginTop: '10px'
              }}>
                <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#ef4444', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Warning: Changing Activity Type</div>
                  <div style={{ color: '#a0a4b8', fontSize: '12px', lineHeight: '1.4' }}>
                    Changing the activity type after students have joined may cause data inconsistencies. Are you sure you want to continue?
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button className="btn btn--danger btn--small" onClick={performSave}>Yes, Change Type</button>
                    <button className="btn btn--secondary btn--small" onClick={() => setShowWarning(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {!showWarning && (
              <div className="modal-actions" style={{ marginTop: '12px' }}>
                <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
                <button 
                  className="btn btn--primary" 
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  style={{ background: 'linear-gradient(135deg, #7c6bf0 0%, #6558d4 100%)', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
