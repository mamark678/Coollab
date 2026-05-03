import React, { useEffect, useState } from 'react';
import { FirebaseService, DocumentProperties, PropertyType, DocumentProperty, DocumentSchema } from '../../services/firebase';
import { Plus, Trash2, ChevronDown, ChevronRight, Settings, Type, Hash, Calendar, CheckSquare, List, Link, Info, X, Sliders } from 'lucide-react';
import { getBuiltInProperties, BuiltInProperties } from '../../utils/documentUtils';
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
        </div>
      </div>
    );
};
