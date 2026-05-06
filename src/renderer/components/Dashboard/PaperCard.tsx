import React from 'react';
import { Trash2, FileText } from 'lucide-react';
import type { DocumentSchema } from '../../services/firebase';
import { getProjectColor, getDimmerProjectColor, truncateText, formatRelativeTime } from '../../utils/project.utils';
import './PaperCard.css';

interface ProjectMember {
  id: string;
  name: string;
  photoURL?: string;
  photoBase64?: string;
}

interface PaperCardProps {
  doc: DocumentSchema;
  onClick: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  previewText?: string;
  previewLoading?: boolean;
  members?: ProjectMember[];
  docCount?: number;
}

export const PaperCard = React.memo(({ 
  doc, 
  onClick, 
  onDelete, 
  previewText, 
  previewLoading = false,
  members = [],
  docCount = 0
}: PaperCardProps) => {
  const accentColor = getProjectColor(doc.id);
  const titleColor = getDimmerProjectColor(doc.id);

  const renderAvatars = () => {
    const displayMembers = members.slice(0, 3);
    const extraCount = members.length > 3 ? members.length - 3 : 0;

    return (
      <div className="paper-card__avatars">
        {displayMembers.map((member, index) => {
          const initials = member.name.substring(0, 2).toUpperCase();
          const avatarUrl = member.photoBase64 || member.photoURL;
          
          return (
            <div 
              key={member.id} 
              className="paper-card__avatar"
              style={{ zIndex: 10 - index, marginLeft: index === 0 ? 0 : -8 }}
              title={member.name}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={member.name} />
              ) : (
                <span>{initials}</span>
              )}
            </div>
          );
        })}
        {extraCount > 0 && (
          <div className="paper-card__avatar-extra" style={{ zIndex: 5 }}>
            +{extraCount}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="paper-card" 
      onClick={onClick} 
      id={`paper-card-${doc.id}`}
      style={{ '--accent-color': accentColor } as React.CSSProperties}
    >
      {/* Accent Border */}
      <div className="paper-card__accent-border" />

      {/* Header with Delete Button */}
      {onDelete && (
        <button
          className="paper-card__delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(e);
          }}
          title="Delete project"
          type="button"
        >
          <Trash2 size={14} />
        </button>
      )}

      {/* Body */}
      <div className="paper-card__body">
        <h3 className="paper-card__title" style={{ color: titleColor }}>
          {truncateText(doc.title || 'Untitled Project', 40)}
        </h3>
        
        <div className="paper-card__preview-container">
          {previewLoading ? (
            <div className="paper-card__preview-skeleton">
              <div className="skeleton-line" />
              <div className="skeleton-line" style={{ width: '85%' }} />
              <div className="skeleton-line" style={{ width: '70%' }} />
            </div>
          ) : (
            <p className="paper-card__preview-text">
              {previewText ? truncateText(previewText, 120) : (
                <span className="paper-card__preview-empty">
                  No documents yet. Click to get started.
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="paper-card__footer">
        <div className="paper-card__footer-left">
          {renderAvatars()}
        </div>
        <div className="paper-card__footer-right">
          <div className="paper-card__doc-count" style={{ color: accentColor }}>
            <FileText size={14} />
            <span>{docCount}</span>
          </div>
          <span className="paper-card__time">
            {formatRelativeTime(doc.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
});
