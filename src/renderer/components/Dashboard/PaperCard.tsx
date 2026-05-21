import React from 'react';
import { Trash2, FileText, ChevronRight, Users, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import type { DocumentSchema } from '../../services/firebase';
import { truncateText, formatRelativeTime } from '../../utils/project.utils';

interface ProjectMember {
  id: string;
  name: string;
  photoURL?: string;
  photoBase64?: string;
}

interface PaperCardProps {
  doc: DocumentSchema;
  index?: number;
  onClick: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  previewText?: string;
  previewLoading?: boolean;
  members?: ProjectMember[];
  docCount?: number;
  isSelected?: boolean;
  isSelectionMode?: boolean;
}

export const PaperCard = React.memo(({ 
  doc, 
  index = 0,
  onClick, 
  onDelete, 
  previewText, 
  previewLoading = false,
  members = [],
  docCount = 0,
  isSelected = false,
  isSelectionMode = false
}: PaperCardProps) => {
  const colors = [
    '#7c3aed', // Purple
    '#10b981', // Green
    '#ec4899', // Pink
    '#f59e0b', // Yellow
  ];
  const accentColor = colors[index % colors.length];

  const renderAvatars = () => {
    const displayMembers = (members || []).slice(0, 3);
    
    return (
      <div className="flex items-center">
        {displayMembers.map((member, i) => {
          const initials = member.name?.substring(0, 2).toUpperCase() || '??';
          const avatarUrl = member.photoBase64 || member.photoURL;
          
          return (
            <div 
              key={member.id} 
              className="w-6 h-6 rounded-full border-2 border-[var(--theme-surface)] bg-[var(--theme-border)] flex items-center justify-center text-[8px] font-black text-[var(--theme-text-secondary)] overflow-hidden ring-1 ring-[var(--theme-border)] shadow-md"
              style={{ marginLeft: i === 0 ? 0 : -6 }}
              title={member.name}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <motion.div
      onClick={onClick}
      whileHover={{
        borderColor: accentColor,
        boxShadow: `0 8px 30px rgba(0,0,0,0.4), 0 0 0 1px ${accentColor}`,
        y: -5
      }}
      style={{
        height: 'auto',
        minHeight: '0',
        borderLeft: `4px solid ${accentColor}`,
        width: '100%',
        boxSizing: 'border-box',
        padding: '20px 20px 16px 20px'
      }}
      className="group relative flex flex-col rounded-[14px] bg-[var(--theme-surface)] border border-[var(--theme-border)] cursor-pointer overflow-hidden shadow-lg"
    >
      {isSelectionMode && (
        <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10 }}>
          <div style={{
            width: '18px', height: '18px', borderRadius: '50%',
            border: `2px solid ${isSelected ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 30%, transparent)'}`,
            background: isSelected ? 'var(--theme-primary)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--theme-on-primary)' }} />}
          </div>
        </div>
      )}
      {/* Delete button - top right */}
      <div className="absolute top-4 right-4 z-10">
        {onDelete && (
          <button
            className="p-1.5 rounded-lg text-[var(--theme-text-secondary)]/10 hover:text-[var(--theme-error)] hover:bg-[color-mix(in_srgb,var(--theme-error)_10%,transparent)] transition-all opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <h3 className="text-[16px] font-bold transition-colors" style={{ color: accentColor, marginBottom: '8px' }}>
        {truncateText(doc.title || 'Untitled Project', 40)}
      </h3>
      
      <p className="text-[13px] text-[var(--theme-text-secondary)] leading-relaxed line-clamp-2">
        {previewText ? cleanText(previewText) : (
          <span>{doc.description || 'No documents yet. Click to get started.'}</span>
        )}
      </p>

      <div className="flex justify-between items-center pt-4 border-t border-[var(--theme-border)]" style={{ marginTop: 'auto' }}>
        {renderAvatars()}
        
        <div className="flex items-center gap-3 text-[12px] text-[var(--theme-text-secondary)]">
          <div className="flex items-center gap-1">
            <FileText size={12} />
            <span className="font-medium">{docCount} Docs</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span className="font-medium">{formatRelativeTime(doc.updatedAt)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

function cleanText(text: string) {
  return text.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
}
