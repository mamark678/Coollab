import React, { useState, useEffect } from 'react';
import { History, Save, RotateCcw, Eye, X } from 'lucide-react';
import { FirebaseService } from '../../services/firebase';
import type { VersionItem } from '../../types/version.types';
import { useAppStore } from '../../store/useAppStore';
import { useAuth } from '../../hooks/useAuth';
import './VersionHistoryPanel.css';
import type { Editor } from '@tiptap/core';

interface VersionHistoryPanelProps {
  editor: Editor | null;
  onRestore: (versionContent: string) => void;
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({ editor, onRestore }) => {
  const { currentNoteId, currentProjectId, projectMembers } = useAppStore();
  const { state: { user } } = useAuth();
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [customLabel, setCustomLabel] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<VersionItem | null>(null);

  useEffect(() => {
    if (!currentNoteId) return;
    const firebase = FirebaseService.getInstance();
    const unsubscribe = firebase.listenToVersions(currentNoteId, (items) => {
      setVersions(items);
    });
    return () => unsubscribe();
  }, [currentNoteId]);

  const saveVersion = async (label?: string) => {
    if (!currentNoteId || !user || !editor) return;
    
    const content = editor.getHTML();
    
    // Check if duplicate of latest
    if (versions.length > 0 && versions[0].content === content) {
      return; // Skip duplicate
    }
    
    const nextNumber = versions.length > 0 ? versions[0].versionNumber + 1 : 1;
    const finalLabel = label || `Version ${nextNumber} - ${new Date().toLocaleString()}`;
    
    const newVersion: VersionItem = {
      content,
      savedBy: { uid: user.uid, name: user.displayName || 'Unknown' },
      savedAt: Date.now(),
      label: finalLabel,
      versionNumber: nextNumber,
    };
    
    try {
      const firebase = FirebaseService.getInstance();
      await firebase.saveVersion(currentNoteId, newVersion);
      setCustomLabel('');
      setShowSaveForm(false);
    } catch (err) {
      console.error('[VersionHistory] Failed to save version:', err);
      alert('Failed to save version. Please check your internet connection and permissions.');
    }
  };

  const notifyRestore = async (versionNumber: number) => {
    if (!currentProjectId || !currentNoteId || !user) return;
    const firebase = FirebaseService.getInstance();
    
    for (const member of projectMembers) {
      if (member.uid !== user.uid) {
        await firebase.createNotification(member.uid, {
          type: 'version',
          fromUser: { uid: user.uid, name: user.displayName || 'Unknown' },
          projectId: currentProjectId,
          documentId: currentNoteId,
          message: `${user.displayName || 'Someone'} restored Version ${versionNumber}`,
          read: false,
          createdAt: Date.now()
        });
      }
    }
  };

  const handleRestore = async (version: VersionItem) => {
    if (!editor) return;
    const confirm = window.confirm(`Restore to version ${version.versionNumber}? Current changes will be saved as a new version before restoring.`);
    if (confirm) {
      await saveVersion('Auto-save before restore');
      onRestore(version.content);
      await notifyRestore(version.versionNumber);
    }
  };

  const formatTime = (ts: number): string => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diffInSeconds = (ts - Date.now()) / 1000;
    
    if (Math.abs(diffInSeconds) < 60) return 'Just now';
    if (Math.abs(diffInSeconds) < 3600) return rtf.format(Math.floor(diffInSeconds / 60), 'minute');
    if (Math.abs(diffInSeconds) < 86400) return rtf.format(Math.floor(diffInSeconds / 3600), 'hour');
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="version-history-panel">
      <div className="version-history-panel__header">
        <h3 className="version-history-panel__title">
          <History size={14} />
          Version History
        </h3>
      </div>

      <div className="version-history-panel__new">
        {!showSaveForm ? (
          <button 
            className="version-history-panel__add-btn"
            onClick={() => setShowSaveForm(true)}
          >
            <Save size={14} /> Save Version
          </button>
        ) : (
          <div className="version-history-panel__form">
            <input 
              type="text" 
              placeholder="Version name (optional)" 
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
              className="version-history-panel__input"
            />
            <div className="version-history-panel__actions">
              <button 
                className="version-history-panel__submit"
                onClick={() => saveVersion(customLabel || undefined)}
              >
                Save
              </button>
              <button 
                className="version-history-panel__cancel"
                onClick={() => setShowSaveForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="version-history-panel__list">
        {versions.length === 0 ? (
          <p className="version-history-panel__empty">No versions saved yet.</p>
        ) : (
          versions.map((v) => (
            <div key={v.id || v.versionNumber} className="version-item">
              <div className="version-item__header">
                <span className="version-item__label">v{v.versionNumber}: {v.label}</span>
                <span className="version-item__time">{formatTime(v.savedAt)}</span>
              </div>
              <div className="version-item__meta">
                Saved by {v.savedBy.name}
              </div>
              <div className="version-item__actions">
                <button className="version-item__btn" onClick={() => setPreviewVersion(v)}>
                  <Eye size={12} /> Preview
                </button>
                <button className="version-item__btn" onClick={() => handleRestore(v)}>
                  <RotateCcw size={12} /> Restore
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {previewVersion && (
        <div className="version-preview-modal">
          <div className="version-preview-modal__header">
            <h3>Preview: v{previewVersion.versionNumber}</h3>
            <button onClick={() => setPreviewVersion(null)} className="version-preview-modal__close">
              <X size={16} />
            </button>
          </div>
          <div className="version-preview-modal__content">
            <div className="version-preview-modal__doc" dangerouslySetInnerHTML={{ __html: previewVersion.content }} />
          </div>
        </div>
      )}
    </div>
  );
};
