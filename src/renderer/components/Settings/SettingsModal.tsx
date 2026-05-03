import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  User, 
  Shield, 
  Camera, 
  Mail, 
  Lock, 
  AlertTriangle, 
  Trash2, 
  Check, 
  Loader2,
  ExternalLink
} from 'lucide-react';
import { FirebaseService } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'profile' | 'account';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { state: { user } } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Profile Tab State
  const [newName, setNewName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  
  // Account Tab State
  const [deleteStep, setDeleteStep] = useState(0); // 0: initial, 1: warning, 2: verify
  const [verifyEmail, setVerifyEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !user) return;

    setLoading(true);
    const unsub = FirebaseService.getInstance().listenToUserProfile(user.uid, (data) => {
      setProfileData(data);
      setNewName(data.name || '');
      setLoading(false);
    });

    return () => unsub();
  }, [isOpen, user]);

  // Name Change Cooldown Effect
  useEffect(() => {
    if (!profileData?.lastNameChange) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const lastChange = profileData.lastNameChange;
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const diff = now - lastChange;

      if (diff >= twentyFourHours) {
        setCountdown(null);
      } else {
        const remaining = twentyFourHours - diff;
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        setCountdown(`${hours}h ${minutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [profileData?.lastNameChange]);

  if (!isOpen) return null;

  const handleSaveName = async () => {
    if (!user || !newName.trim() || countdown) return;
    
    // Validation
    if (newName.length < 2 || newName.length > 50) {
      setNameError('Name must be between 2 and 50 characters');
      return;
    }
    const nameRegex = /^[a-zA-Z0-9\s\-\']+$/;
    if (!nameRegex.test(newName)) {
      setNameError('Special characters not allowed except spaces, hyphens, and apostrophes');
      return;
    }

    setNameSaving(true);
    setNameError(null);
    try {
      const isGoogle = user.providerData.some(p => p.providerId === 'google.com');
      await FirebaseService.getInstance().saveUserProfile(user.uid, {
        name: newName,
        lastNameChange: Date.now(),
        ...(isGoogle ? {} : { photoBase64: profileData?.photoBase64 || null })
      });
      // Success toast would go here if we had a toast system
    } catch (err) {
      setNameError('Failed to update name. Please try again.');
    } finally {
      setNameSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size exceeds 2MB');
      return;
    }

    // Check type
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      alert('Invalid file type');
      return;
    }

    setPhotoSaving(true);
    try {
      const isGoogle = user.providerData.some(p => p.providerId === 'google.com');
      if (isGoogle) {
        alert('Your profile photo is managed by Google.');
        return;
      }
      const base64 = await resizeImage(file, 400, 400);
      await FirebaseService.getInstance().saveUserProfile(user.uid, {
        name: profileData?.name || user.displayName || 'User',
        photoBase64: base64
      });
    } catch (err) {
      console.error('Photo upload failed:', err);
      alert('Failed to upload photo');
    } finally {
      setPhotoSaving(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user) return;
    const isGoogle = user.providerData.some(p => p.providerId === 'google.com');
    if (isGoogle) return;

    setPhotoSaving(true);
    try {
      await FirebaseService.getInstance().saveUserProfile(user.uid, {
        name: profileData?.name || user.displayName || 'User',
        photoBase64: null
      });
    } catch (err) {
      alert('Failed to remove photo');
    }
  };

  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/webp', 0.8));
        };
      };
      reader.onerror = reject;
    });
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      // 1. Re-authenticate
      await FirebaseService.getInstance().reauthenticate();
      
      // 2. Delete Data
      await FirebaseService.getInstance().deleteUserAccount(user.uid);
      
      // 3. Final steps handled by reload/redirect
      window.location.reload();
    } catch (err: any) {
      console.error('Deletion failed:', err);
      if (err.code === 'auth/requires-recent-login') {
        setDeleteError('Please sign in again before deleting your account.');
      } else {
        setDeleteError('Something went wrong. Please try again or contact support.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const initials = profileData?.name?.substring(0, 2).toUpperCase() || '??';
  const isGoogleAccount = user?.providerData.some(p => p.providerId === 'google.com');
  const currentPhoto = isGoogleAccount ? user?.photoURL : (profileData?.photoBase64 || null);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <motion.div 
        className="settings-modal" 
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
      >
        <header className="settings-header">
          <div className="settings-title">
            <Shield size={20} className="settings-title-icon" />
            <h2>Settings</h2>
          </div>
          <button className="settings-close" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="settings-body">
          <aside className="settings-nav">
            <button 
              className={`settings-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={18} />
              <span>Profile</span>
            </button>
            <button 
              className={`settings-nav-item ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              <Lock size={18} />
              <span>Account</span>
            </button>
          </aside>

          <main className="settings-content">
            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <motion.div 
                  key="profile"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="settings-section"
                >
                  <div className="profile-photo-section">
                    <div className="profile-photo-container">
                      <div className="profile-photo-wrapper">
                        {currentPhoto ? (
                          <img src={currentPhoto} alt="Profile" className="profile-photo" />
                        ) : (
                          <div className="profile-photo-initials">{initials}</div>
                        )}
                        {!isGoogleAccount && (
                          <button 
                            className="profile-photo-edit" 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={photoSaving}
                          >
                            {photoSaving ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                          </button>
                        )}
                      </div>

                      {isGoogleAccount ? (
                        <div className="google-managed-photo">
                          <div className="google-managed-label">
                            <svg viewBox="0 0 24 24" width="14" height="14">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            <span>Profile photo managed by Google</span>
                          </div>
                          <p className="google-managed-hint">To change your photo, update it in your Google account settings.</p>
                        </div>
                      ) : (
                        <>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            onChange={handlePhotoUpload}
                          />
                          {profileData?.photoBase64 && (
                            <button className="remove-photo-btn" onClick={handleRemovePhoto}>
                              Remove photo
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="settings-form-group">
                    <label>Display Name</label>
                    <div className="name-input-wrapper">
                      <input 
                        type="text" 
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="Your display name"
                        disabled={!!countdown || nameSaving}
                        className={countdown ? 'disabled' : ''}
                      />
                      <button 
                        className="save-name-btn"
                        onClick={handleSaveName}
                        disabled={!!countdown || nameSaving || !newName.trim() || newName === profileData?.name}
                      >
                        {nameSaving ? <Loader2 size={14} className="animate-spin" /> : 'Save name'}
                      </button>
                    </div>
                    {countdown && (
                      <p className="cooldown-msg">
                        You can change your name again in <span className="countdown">{countdown}</span>
                      </p>
                    )}
                    {nameError && <p className="name-error-msg">{nameError}</p>}
                  </div>

                  <div className="settings-form-group">
                    <label>Email Address</label>
                    <div className="email-display">
                      <Lock size={14} className="lock-icon" />
                      <span>{user?.email}</span>
                    </div>
                    <p className="field-hint">Email cannot be changed manually.</p>
                  </div>

                  <div className="settings-form-group">
                    <label>Account Type</label>
                    <div className="account-type-badge">
                      {isGoogleAccount ? (
                        <>
                          <div className="google-icon-wrapper">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                          </div>
                          <span>Google Account</span>
                        </>
                      ) : (
                        <>
                          <Mail size={16} />
                          <span>Email Account</span>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'account' && (
                <motion.div 
                  key="account"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="settings-section"
                >
                  <div className="danger-zone">
                    <div className="danger-zone-header">
                      <AlertTriangle size={18} />
                      <h3>Danger Zone</h3>
                    </div>
                    <div className="danger-zone-content">
                      <div className="danger-zone-text">
                        <h4>Delete Account</h4>
                        <p>Permanently delete your account and all associated data. This action cannot be undone.</p>
                      </div>
                      <button className="delete-account-btn" onClick={() => setDeleteStep(1)}>
                        Delete Account
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </motion.div>

      {/* Delete Confirmation Flow */}
      <AnimatePresence>
        {deleteStep === 1 && (
          <div className="modal-overlay" onClick={() => setDeleteStep(0)}>
            <motion.div 
              className="modal-content modal-content--warning" 
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="warning-icon-wrapper">
                <AlertTriangle size={32} />
              </div>
              <h3>Delete your account?</h3>
              <div className="warning-list">
                <p>This will permanently delete:</p>
                <ul>
                  <li>Your account and profile</li>
                  <li>All projects you own</li>
                  <li>All your comments and mentions</li>
                </ul>
                <p className="warning-footer">This cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button className="btn btn--secondary" onClick={() => setDeleteStep(0)}>Cancel</button>
                <button className="btn btn--danger" onClick={() => setDeleteStep(2)}>Continue</button>
              </div>
            </motion.div>
          </div>
        )}

        {deleteStep === 2 && (
          <div className="modal-overlay" onClick={() => setDeleteStep(0)}>
            <motion.div 
              className="modal-content modal-content--verify" 
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3>Confirm your identity</h3>
              <p>To confirm, type your email address below:</p>
              <div className="verify-input-container">
                <input 
                  type="text" 
                  value={verifyEmail}
                  onChange={e => setVerifyEmail(e.target.value)}
                  placeholder={user?.email || ''}
                  className={verifyEmail.toLowerCase() === user?.email?.toLowerCase() ? 'valid' : 'invalid'}
                />
                {verifyEmail.toLowerCase() === user?.email?.toLowerCase() && (
                  <Check size={18} className="verify-check" />
                )}
              </div>
              
              {deleteError && <p className="delete-error-msg">{deleteError}</p>}
              
              <div className="modal-actions">
                <button className="btn btn--secondary" onClick={() => setDeleteStep(0)}>Cancel</button>
                <button 
                  className="btn btn--danger" 
                  disabled={verifyEmail.toLowerCase() !== user?.email?.toLowerCase() || deleting}
                  onClick={handleDeleteAccount}
                >
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : 'Delete my account'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
