import React, { useEffect, useState } from 'react';
import { FirebaseService, DocumentProperties, PropertyType, DocumentProperty, DocumentSchema } from '../../services/firebase';
import { Plus, Trash2, ChevronDown, ChevronRight, Settings, Type, Hash, Calendar, CheckSquare, List, Link, Info, X, Sliders, Upload, Image, Loader2 } from 'lucide-react';
import { getBuiltInProperties, BuiltInProperties } from '../../utils/documentUtils';
import { useBackground } from '../../context/BackgroundContext';
import { useAppStore } from '../../store/useAppStore';
import { compressAndConvertToBase64 } from '../../utils/imageCompression';
import './PropertiesPanel.css';

export interface PropertiesPanelProps {
  noteId: string;
  onClose?: () => void;
}

const PROPERTY_TYPES: { type: PropertyType; icon: React.ReactNode; label: string }[] = [
  { type: 'text', icon: <Type size={14} />, label: 'Text' },
  { type: 'number', icon: <Hash size={14} />, label: 'Number' },
  { type: 'date', icon: <Calendar size={14} />, label: 'Date' },
  { type: 'checkbox', icon: <CheckSquare size={14} />, label: 'Checkbox' },
  { type: 'multi-select', icon: <List size={14} />, label: 'Multi-select' },
  { type: 'url', icon: <Link size={14} />, label: 'URL' }
];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ noteId, onClose }) => {
  const [properties, setProperties] = useState<DocumentProperties>({});
  const [builtIn, setBuiltIn] = useState<BuiltInProperties | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showBuiltIn, setShowBuiltIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // Background Context & App Store
  const currentProjectId = useAppStore(s => s.currentProjectId);
  const { activeProjectBackground, setProjectBackground } = useBackground();
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  const bgFileInputRef = React.useRef<HTMLInputElement>(null);

  // Listen to the project note to check owner permission
  useEffect(() => {
    if (!currentProjectId) return;
    const unsub = FirebaseService.getInstance().listenToNote(currentProjectId, (data) => {
      setProjectOwnerId(data.ownerId || null);
    });
    return () => unsub();
  }, [currentProjectId]);

  const isProjectOwner = projectOwnerId === FirebaseService.getInstance().auth.currentUser?.uid;

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProjectId) return;

    setUploadingBg(true);
    setBgError(null);

    try {
      const base64 = await compressAndConvertToBase64(file);
      await setProjectBackground(currentProjectId, base64);
    } catch (err: any) {
      console.error('Error uploading project background:', err);
      setBgError(err.message || 'Failed to compress or upload background image.');
    } finally {
      setUploadingBg(false);
      if (bgFileInputRef.current) bgFileInputRef.current.value = '';
    }
  };

  const handleBgRemove = async () => {
    if (!currentProjectId) return;
    setUploadingBg(true);
    setBgError(null);
    try {
      await setProjectBackground(currentProjectId, null);
    } catch (err: any) {
      console.error('Error removing project background:', err);
      setBgError(err.message || 'Failed to remove background image.');
    } finally {
      setUploadingBg(false);
    }
  };

  useEffect(() => {
    if (!noteId) return;
    const firebase = FirebaseService.getInstance();
    
    // We need all docs for backlinks/path calculation
    // In a real app, this would be a specialized hook or cached store
    const fetchContext = async () => {
      const allDocs = await firebase.listUserNotes(firebase.auth.currentUser?.uid || '');
      return allDocs;
    };

    const unsub = firebase.listenToNote(noteId, async (data) => {
      setProperties(data.properties || {});
      const allDocs = await fetchContext();
      setBuiltIn(getBuiltInProperties(data, allDocs));
      
      // Auto expand if there are properties
      if (data.properties && Object.keys(data.properties).length > 0 && loading) {
        setIsExpanded(true);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [noteId]);

  const saveProperties = async (newProps: DocumentProperties) => {
    // Optimistic update
    setProperties(newProps);
    const firebase = FirebaseService.getInstance();
    await firebase.saveNote(noteId, { properties: newProps });
  };

  const addProperty = () => {
    let key = 'New Property';
    let counter = 1;
    while (properties[key]) {
      key = `New Property ${counter}`;
      counter++;
    }
    const newProps = { ...properties, [key]: { type: 'text' as PropertyType, value: '' } };
    setIsExpanded(true);
    saveProperties(newProps);
  };

  const renameProperty = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    if (properties[newKey]) {
      alert('A property with this name already exists.');
      return;
    }
    const newProps = { ...properties };
    newProps[newKey] = newProps[oldKey];
    delete newProps[oldKey];
    saveProperties(newProps);
  };

  const changePropertyType = (key: string, type: PropertyType) => {
    const newProps = { ...properties };
    let value = newProps[key].value;
    
    // Type conversion logic
    if (type === 'checkbox') value = !!value;
    else if (type === 'multi-select' && !Array.isArray(value)) value = value ? [String(value)] : [];
    else if (type === 'number') value = Number(value) || 0;
    else if (type === 'date') value = value || new Date().toISOString().split('T')[0];
    else if (type === 'text' || type === 'url') value = String(value);

    newProps[key] = { type, value };
    saveProperties(newProps);
  };

  const updatePropertyValue = (key: string, value: any) => {
    const newProps = { ...properties };
    newProps[key].value = value;
    saveProperties(newProps);
  };

  const deleteProperty = (key: string) => {
    const newProps = { ...properties };
    delete newProps[key];
    saveProperties(newProps);
  };

  if (loading) return null;

  const propKeys = Object.keys(properties);

  return (
    <div className="properties-panel">
      <div className="properties-panel__side-header">
        <h3 className="properties-panel__side-title">
          <Sliders size={16} />
          Properties
        </h3>
        {onClose && (
          <button 
            className="properties-panel__close-btn" 
            onClick={onClose}
            title="Close Panel"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="properties-panel__scroll-area">
        {builtIn && (
            <div className="built-in-properties" style={{ borderTop: 'none', paddingTop: 0, marginBottom: 12 }}>
              <div 
                className="built-in-properties__header"
                onClick={() => setShowBuiltIn(!showBuiltIn)}
              >
                {showBuiltIn ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>Built-in Properties</span>
              </div>
              
              {showBuiltIn && (
                <div className="built-in-properties__list">
                  {Object.entries(builtIn).map(([key, value]) => (
                    <div key={key} className="property-row property-row--readonly">
                      <div className="property-row__key">
                        <Info size={14} className="info-icon" />
                        <span className="property-key-label">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                      </div>
                      <div className="property-row__value">
                        <span className="readonly-value">
                          {Array.isArray(value) ? (value.length > 0 ? value.join(', ') : '—') : 
                           typeof value === 'number' && key.toLowerCase().includes('time') ? new Date(value).toLocaleString() :
                           (value || '—')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="properties-list">
            {propKeys.map((key) => {
              const prop = properties[key];
              const typeConfig = PROPERTY_TYPES.find(t => t.type === prop.type) || PROPERTY_TYPES[0];
              
              return (
                <div key={key} className="property-row">
                  <div className="property-row__key">
                    <div className="property-type-selector">
                      <select 
                        value={prop.type} 
                        onChange={(e) => changePropertyType(key, e.target.value as PropertyType)}
                        title="Change Type"
                      >
                        {PROPERTY_TYPES.map(t => (
                          <option key={t.type} value={t.type}>{t.label}</option>
                        ))}
                      </select>
                      {typeConfig.icon}
                    </div>
                    <input 
                      type="text" 
                      defaultValue={key}
                      onBlur={(e) => renameProperty(key, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                      className="property-key-input"
                    />
                  </div>
                  
                  <div className="property-row__value">
                    {prop.type === 'text' && (
                      <input 
                        type="text" 
                        value={prop.value || ''} 
                        onChange={(e) => updatePropertyValue(key, e.target.value)}
                        placeholder="Empty"
                        className="property-value-input"
                      />
                    )}
                    {prop.type === 'number' && (
                      <input 
                        type="number" 
                        value={prop.value || ''} 
                        onChange={(e) => updatePropertyValue(key, e.target.value)}
                        placeholder="Empty"
                        className="property-value-input"
                      />
                    )}
                    {prop.type === 'date' && (
                      <input 
                        type="date" 
                        value={prop.value || ''} 
                        onChange={(e) => updatePropertyValue(key, e.target.value)}
                        className="property-value-input"
                      />
                    )}
                    {prop.type === 'url' && (
                      <input 
                        type="url" 
                        value={prop.value || ''} 
                        onChange={(e) => updatePropertyValue(key, e.target.value)}
                        placeholder="https://"
                        className="property-value-input"
                      />
                    )}
                    {prop.type === 'checkbox' && (
                      <input 
                        type="checkbox" 
                        checked={!!prop.value} 
                        onChange={(e) => updatePropertyValue(key, e.target.checked)}
                        className="property-value-checkbox"
                      />
                    )}
                    {prop.type === 'multi-select' && (
                      <input 
                        type="text" 
                        value={Array.isArray(prop.value) ? prop.value.join(', ') : ''} 
                        onChange={(e) => {
                          const val = e.target.value;
                          updatePropertyValue(key, val.split(',').map(s => s.trim()).filter(Boolean));
                        }}
                        placeholder="tag1, tag2..."
                        className="property-value-input"
                      />
                    )}
                  </div>
                  
                  <button 
                    className="property-row__delete" 
                    onClick={() => deleteProperty(key)}
                    title="Delete property"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          
          <button className="properties-panel__add-btn" onClick={addProperty}>
            <Plus size={14} />
            <span>Add property</span>
          </button>

          {/* Project Workspace Background Image Upload */}
          <div style={{ 
            marginTop: 24, 
            paddingTop: 16, 
            borderTop: '1px solid var(--theme-border)' 
          }}>
            <h4 style={{ 
              color: 'var(--theme-text-primary)', 
              fontSize: 12, 
              fontWeight: 600, 
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <Image size={14} /> Workspace Background
            </h4>

            {isProjectOwner ? (
              <>
                <p style={{ color: 'var(--theme-text-secondary)', marginBottom: 12, fontSize: 11, lineHeight: 1.4 }}>
                  Customize the background image for all members in this project workspace.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ 
                    width: '100%', 
                    height: 90, 
                    borderRadius: 6, 
                    background: activeProjectBackground ? `url(${activeProjectBackground})` : 'var(--theme-surface)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: '1px solid var(--theme-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--theme-text-secondary)',
                    fontSize: 11,
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {!activeProjectBackground && <span>No Background Set</span>}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      type="file" 
                      ref={bgFileInputRef}
                      onChange={handleBgUpload}
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                    <button
                      onClick={() => bgFileInputRef.current?.click()}
                      disabled={uploadingBg}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 4,
                        background: 'var(--theme-primary)',
                        color: 'var(--theme-on-primary)',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: 12,
                        opacity: uploadingBg ? 0.6 : 1
                      }}
                    >
                      {uploadingBg ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                      Upload
                    </button>
                    {activeProjectBackground && (
                      <button
                        onClick={handleBgRemove}
                        disabled={uploadingBg}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 4,
                          background: 'transparent',
                          color: 'var(--theme-danger, #ef4444)',
                          border: '1px solid var(--theme-danger, #ef4444)',
                          cursor: 'pointer',
                          fontWeight: 500,
                          fontSize: 12,
                          opacity: uploadingBg ? 0.6 : 1
                        }}
                      >
                        <Trash2 size={12} />
                        Remove
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--theme-text-secondary)', textAlign: 'center' }}>
                    Compressed to max 1280x720 automatically.
                  </span>
                </div>
              </>
            ) : (
              <>
                <p style={{ color: 'var(--theme-text-secondary)', fontSize: 11, lineHeight: 1.4 }}>
                  Only the project owner can set the workspace background image.
                </p>
                {activeProjectBackground && (
                  <div style={{ 
                    width: '100%', 
                    height: 90, 
                    borderRadius: 6, 
                    background: `url(${activeProjectBackground})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: '1px solid var(--theme-border)',
                    marginTop: 8
                  }} />
                )}
              </>
            )}

            {bgError && (
              <div style={{ 
                marginTop: 10, 
                color: 'var(--theme-danger, #ef4444)', 
                fontSize: 11,
                background: 'color-mix(in srgb, var(--theme-danger, #ef4444) 10%, transparent)',
                padding: '6px 10px',
                borderRadius: 4
              }}>
                {bgError}
              </div>
            )}
          </div>
        </div>
      </div>
    );
};
