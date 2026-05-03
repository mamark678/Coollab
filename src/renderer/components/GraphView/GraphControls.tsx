// ─── Graph Controls ────────────────────────────────────────────────────────
// Filter panel and zoom/search controls for the graph view.

import {
  Flame,
  Maximize2,
  Minimize2,
  Search,
  SlidersHorizontal,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import './GraphView.css';
import type { GraphConfig } from './GraphView.types';

interface GraphControlsProps {
  config: GraphConfig;
  viewState: any;
  onConfigChange: (config: GraphConfig) => void;
  onViewStateChange: (state: any) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onReheat: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

export const GraphControls: React.FC<GraphControlsProps> = ({
  config,
  viewState,
  onConfigChange,
  onViewStateChange,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onReheat,
  onToggleFullscreen,
  isFullscreen,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const updateConfig = <K extends keyof GraphConfig>(key: K, value: GraphConfig[K]): void => {
    onConfigChange({ ...config, [key]: value });
  };

  const updateViewState = (key: string, value: any): void => {
    onViewStateChange({ ...viewState, [key]: value });
  };

  const hasSearch = Boolean(viewState.searchQuery);

  return (
    <>
      {/* ── Always-visible search bar (top of graph) ── */}
      <div className={`graph-search-bar ${searchFocused || hasSearch ? 'graph-search-bar--active' : ''}`}>
        <Search size={13} className="graph-search-bar__icon" />
        <input
          ref={searchRef}
          className="graph-search-bar__input"
          type="text"
          placeholder="Search nodes…"
          value={viewState.searchQuery ?? ''}
          onChange={(e) => updateViewState('searchQuery', e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {hasSearch && (
          <button
            className="graph-search-bar__clear"
            onClick={() => {
              updateViewState('searchQuery', '');
              searchRef.current?.focus();
            }}
            type="button"
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="graph-filter-panel">
          <div className="graph-filter-panel__header">
            <span>Graph Settings</span>
            <button
              className="graph-filter-panel__close"
              onClick={() => setShowFilters(false)}
              type="button"
              aria-label="Close filters"
            >
              <X size={14} />
            </button>
          </div>

          <div className="graph-filter-section">
            <span className="graph-filter-section-title">View Mode</span>
            <label className="graph-filter-toggle">
              <input
                type="checkbox"
                checked={viewState.isLocalView}
                onChange={(e) => updateViewState('isLocalView', e.target.checked)}
              />
              <span>Local graph only</span>
            </label>
            {viewState.isLocalView && (
              <div className="graph-filter-slider">
                <span>Depth</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={config.localViewDepth}
                  onChange={(e) => updateConfig('localViewDepth', Number(e.target.value))}
                />
                <span className="graph-filter-slider__value">{config.localViewDepth}</span>
              </div>
            )}
          </div>

          <div className="graph-filter-section">
            <span className="graph-filter-section-title">Visibility</span>
            <label className="graph-filter-toggle">
              <input
                type="checkbox"
                checked={config.showOrphans}
                onChange={(e) => updateConfig('showOrphans', e.target.checked)}
              />
              <span>Show orphans</span>
            </label>
            <label className="graph-filter-toggle">
              <input
                type="checkbox"
                checked={config.showTags}
                onChange={(e) => updateConfig('showTags', e.target.checked)}
              />
              <span>Show tags</span>
            </label>
            <label className="graph-filter-toggle">
              <input
                type="checkbox"
                checked={viewState.showMinimap ?? false}
                onChange={(e) => updateViewState('showMinimap', e.target.checked)}
              />
              <span>Show minimap</span>
            </label>
          </div>

          <div className="graph-filter-section">
            <span className="graph-filter-section-title">Physics</span>
            <div className="graph-filter-slider">
              <span>Link distance</span>
              <input
                type="range" min="30" max="200"
                value={config.linkDistance}
                onChange={(e) => updateConfig('linkDistance', Number(e.target.value))}
              />
              <span className="graph-filter-slider__value">{config.linkDistance}</span>
            </div>
            <div className="graph-filter-slider">
              <span>Repel force</span>
              <input
                type="range" min="30" max="500"
                value={config.repelForce}
                onChange={(e) => updateConfig('repelForce', Number(e.target.value))}
              />
              <span className="graph-filter-slider__value">{config.repelForce}</span>
            </div>
            <div className="graph-filter-slider">
              <span>Gravity</span>
              <input
                type="range" min="0" max="0.2" step="0.01"
                value={config.gravity}
                onChange={(e) => updateConfig('gravity', Number(e.target.value))}
              />
              <span className="graph-filter-slider__value">{config.gravity}</span>
            </div>
            <div className="graph-filter-slider">
              <span>Link strength</span>
              <input
                type="range" min="0.1" max="1" step="0.05"
                value={config.linkStrength}
                onChange={(e) => updateConfig('linkStrength', Number(e.target.value))}
              />
              <span className="graph-filter-slider__value">{config.linkStrength}</span>
            </div>
          </div>

          <div className="graph-filter-section">
            <span className="graph-filter-section-title">Appearance</span>
            <div className="graph-filter-slider">
              <span>Node size</span>
              <input
                type="range" min="3" max="16"
                value={config.nodeSize}
                onChange={(e) => updateConfig('nodeSize', Number(e.target.value))}
              />
              <span className="graph-filter-slider__value">{config.nodeSize}</span>
            </div>
            <div className="graph-filter-slider">
              <span>Label zoom</span>
              <input
                type="range" min="0.2" max="2" step="0.1"
                value={config.labelThreshold}
                onChange={(e) => updateConfig('labelThreshold', Number(e.target.value))}
              />
              <span className="graph-filter-slider__value">{config.labelThreshold}×</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Control buttons (bottom-left) ── */}
      <div className="graph-controls">
        <button
          className="graph-controls__btn"
          onClick={onZoomIn}
          title="Zoom in"
          type="button"
        >
          <ZoomIn size={15} />
        </button>
        <button
          className="graph-controls__btn"
          onClick={onZoomOut}
          title="Zoom out"
          type="button"
        >
          <ZoomOut size={15} />
        </button>
        <button
          className="graph-controls__btn"
          onClick={onFitToScreen}
          title="Fit to screen"
          type="button"
        >
          <Maximize2 size={15} />
        </button>
        <button
          className="graph-controls__btn"
          onClick={onReheat}
          title="Reheat simulation"
          type="button"
        >
          <Flame size={15} />
        </button>
        <button
          className={`graph-controls__btn ${showFilters ? 'graph-controls__btn--active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          title="Settings"
          type="button"
        >
          <SlidersHorizontal size={15} />
        </button>
        {onToggleFullscreen && (
          <button
            className={`graph-controls__btn ${isFullscreen ? 'graph-controls__btn--active' : ''}`}
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            type="button"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        )}
      </div>
    </>
  );
};