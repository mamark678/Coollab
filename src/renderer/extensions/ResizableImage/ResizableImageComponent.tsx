import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { ArrowDownUp, Square } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import './ResizableImage.css';

type ResizeDirection = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se' | null;

const EDGE_THRESHOLD = 10;

function getResizeDirection(e: React.MouseEvent, rect: DOMRect): ResizeDirection {
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const w = rect.width;
  const h = rect.height;

  const nearLeft = x <= EDGE_THRESHOLD;
  const nearRight = x >= w - EDGE_THRESHOLD;
  const nearTop = y <= EDGE_THRESHOLD;
  const nearBottom = y >= h - EDGE_THRESHOLD;

  if (nearTop && nearLeft) return 'nw';
  if (nearTop && nearRight) return 'ne';
  if (nearBottom && nearLeft) return 'sw';
  if (nearBottom && nearRight) return 'se';
  if (nearTop) return 'n';
  if (nearBottom) return 's';
  if (nearLeft) return 'w';
  if (nearRight) return 'e';
  return null;
}

const CURSOR_MAP: Record<string, string> = {
  nw: 'nwse-resize', ne: 'nesw-resize',
  sw: 'nesw-resize', se: 'nwse-resize',
  n: 'ns-resize', s: 'ns-resize',
  w: 'ew-resize', e: 'ew-resize',
};

const ResizableImageComponent: React.FC<NodeViewProps> = (props) => {
  const { node, updateAttributes, selected, editor } = props;
  const {
    src, alt, title, width, height,
    float, wrapMode,
    marginLeft, marginRight, marginTop, marginBottom
  } = node.attrs;

  const imgRef = useRef<HTMLImageElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<string>('move');

  const resizeStateRef = useRef<{
    active: boolean;
    direction: ResizeDirection;
    startX: number; startY: number;
    startW: number; startH: number;
    startMarginLeft: number; startMarginRight: number; startMarginTop: number;
    aspectRatio: number;
  }>({
    active: false, direction: null,
    startX: 0, startY: 0,
    startW: 0, startH: 0,
    startMarginLeft: 0, startMarginRight: 0, startMarginTop: 0,
    aspectRatio: 1,
  });

  // Sync real pixel height on load
  const handleImageLoad = useCallback(() => {
    if (!imgRef.current) return;
    const { naturalWidth, naturalHeight } = imgRef.current;
    const currentWidth = width || 300;
    if (!height || height === 'auto') {
      updateAttributes({ height: Math.round((naturalHeight / naturalWidth) * currentWidth) });
    }
  }, [width, height, updateAttributes]);

  // Detect edge on mouse move — update cursor
  const handleMouseMoveOverImage = useCallback((e: React.MouseEvent) => {
    if (resizeStateRef.current.active) return;
    if (!imgRef.current || !selected) {
      setCursor('move');
      return;
    }
    const rect = imgRef.current.getBoundingClientRect();
    const dir = getResizeDirection(e, rect);
    setCursor(dir ? CURSOR_MAP[dir] : 'move');
  }, [selected]);

  // Unified mouse down — resize or drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.image-toolbar')) return;
    if (!imgRef.current || !selected) return;

    const rect = imgRef.current.getBoundingClientRect();
    const dir = getResizeDirection(e, rect);

    if (dir) {
      // ── RESIZE ──
      e.preventDefault();
      e.stopPropagation();

      resizeStateRef.current = {
        active: true,
        direction: dir,
        startX: e.clientX,
        startY: e.clientY,
        startW: rect.width,
        startH: rect.height,
        startMarginLeft: node.attrs.marginLeft || 0,
        startMarginRight: node.attrs.marginRight || 0,
        startMarginTop: node.attrs.marginTop || 0,
        aspectRatio: rect.width / rect.height,
      };

      const onMouseMove = (me: MouseEvent) => {
        const rs = resizeStateRef.current;
        if (!rs.active) return;

        const editorRect = editor.view.dom.getBoundingClientRect();
        const dX = me.clientX - rs.startX;
        const dY = me.clientY - rs.startY;
        const lock = me.shiftKey;
        const currentFloat = node.attrs.float || 'none';
        const currentPadding = node.attrs.padding || 8;

        let newW = rs.startW;
        let newH = rs.startH;
        let newLeft = rs.startMarginLeft;
        let newTop = rs.startMarginTop;

        // Width delta
        if (dir.includes('e')) newW = rs.startW + dX;
        if (dir.includes('w')) { newW = rs.startW - dX; newLeft = rs.startMarginLeft + dX; }

        // Height delta
        if (dir.includes('s')) newH = rs.startH + dY;
        if (dir.includes('n')) { newH = rs.startH - dY; newTop = rs.startMarginTop + dY; }

        // Aspect ratio lock (Shift)
        if (lock && dir.length === 2) {
          if (Math.abs(dX) >= Math.abs(dY)) {
            newH = newW / rs.aspectRatio;
            if (dir.includes('n')) newTop = rs.startMarginTop + (rs.startH - newH);
          } else {
            newW = newH * rs.aspectRatio;
            if (dir.includes('w')) newLeft = rs.startMarginLeft + (rs.startW - newW);
          }
        }

        // Min size clamp
        if (newW < 20) {
          if (dir.includes('w')) newLeft = rs.startMarginLeft + (rs.startW - 20);
          newW = 20;
          if (lock && dir.length === 2) {
            newH = 20 / rs.aspectRatio;
            if (dir.includes('n')) newTop = rs.startMarginTop + (rs.startH - newH);
          }
        }
        if (newH < 20) {
          if (dir.includes('n')) newTop = rs.startMarginTop + (rs.startH - 20);
          newH = 20;
          if (lock && dir.length === 2) {
            newW = 20 * rs.aspectRatio;
            if (dir.includes('w')) newLeft = rs.startMarginLeft + (rs.startW - newW);
          }
        }

        // Document bounds clamp
        newLeft = Math.max(0, newLeft);
        const maxW = editorRect.width;
        if (newW > maxW) newW = maxW;
        if (newLeft + newW > maxW) newW = maxW - newLeft;
        if (newTop < 0) newTop = 0;

        // ✅ Lock float during resize — only adjust the relevant margin
        let finalMarginLeft = Math.round(newLeft);
        let finalMarginRight = Math.round(Math.max(0, editorRect.width - newLeft - newW));

        if (currentFloat === 'right') {
          finalMarginRight = Math.round(Math.max(0, rs.startMarginRight - (newW - rs.startW)));
          finalMarginLeft = currentPadding;
        } else if (currentFloat === 'left') {
          finalMarginLeft = rs.startMarginLeft;
          finalMarginRight = Math.round(Math.max(0, editorRect.width - finalMarginLeft - newW));
        }

        updateAttributes({
          width: Math.round(newW),
          height: Math.round(newH),
          marginLeft: finalMarginLeft,
          marginRight: finalMarginRight,
          marginTop: Math.round(Math.max(0, newTop)),
          float: currentFloat, // ✅ Never change float during resize
        });
      };

      const onMouseUp = () => {
        resizeStateRef.current.active = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);

    } else {
      // ── DRAG ──
      e.preventDefault();
      e.stopPropagation();

      const editorView = editor.view;
      const nodeId = node.attrs.id;
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      const clickOffsetX = wrapperRect ? e.clientX - wrapperRect.left : 0;
      const clickOffsetY = wrapperRect ? e.clientY - wrapperRect.top : 0;

      const onMouseMove = (me: MouseEvent) => {
        let currentPos = -1;
        let currentNode: any = null;

        editorView.state.doc.descendants((n, pos) => {
          if (n.attrs.id === nodeId) { currentPos = pos; currentNode = n; return false; }
        });
        if (currentPos === -1 || !currentNode) return;

        const editorRect = editorView.dom.getBoundingClientRect();
        const currentX = (me.clientX - clickOffsetX) - editorRect.left + (currentNode.attrs.width / 2);
        const imageWidth = currentNode.attrs.width || 300;
        const currentWrapMode = currentNode.attrs.wrapMode;
        const currentPadding = currentNode.attrs.padding || 8;

        const posAtCoords = editorView.posAtCoords({
          left: editorRect.left + editorRect.width / 2,
          top: me.clientY - clickOffsetY,
        });
        const targetPos = posAtCoords ? posAtCoords.pos : currentPos;

        let newFloat = 'none', newMarginLeft = 0, newMarginRight = 0, newMarginTop = 0;
        const tr = editorView.state.tr;
        const $pos = tr.doc.resolve(targetPos);
        const insertPos = $pos.depth > 0 ? $pos.before() : targetPos;

        if (currentWrapMode === 'square') {
          if (imageWidth > editorRect.width - 100) {
            newFloat = 'none';
            newMarginLeft = Math.max(0, currentX - imageWidth / 2);
          } else if (currentX < editorRect.width / 2) {
            newFloat = 'left';
            newMarginLeft = Math.max(0, currentX - imageWidth / 2);
            newMarginRight = currentPadding;
          } else {
            newFloat = 'right';
            newMarginRight = Math.max(0, editorRect.width - (currentX + imageWidth / 2));
            newMarginLeft = currentPadding;
          }
          try {
            const coords = editorView.coordsAtPos(insertPos);
            newMarginTop = Math.max(0, (me.clientY - clickOffsetY) - coords.top);
          } catch { }
        } else {
          newMarginLeft = Math.max(0, currentX - imageWidth / 2);
          newMarginTop = currentPadding;
        }

        tr.setNodeMarkup(currentPos, undefined, {
          ...currentNode.attrs,
          float: newFloat,
          marginLeft: newMarginLeft,
          marginRight: newMarginRight,
          marginTop: newMarginTop,
          marginBottom: currentPadding,
        });

        if (insertPos !== currentPos && insertPos !== currentPos + 1) {
          const nodeCopy = editorView.state.schema.nodes.resizableImage.create(
            tr.doc.nodeAt(currentPos)!.attrs
          );
          tr.delete(currentPos, currentPos + currentNode.nodeSize);
          const adj = insertPos > currentPos ? insertPos - currentNode.nodeSize : insertPos;
          tr.insert(adj, nodeCopy);
        }

        if (tr.docChanged || tr.steps.length > 0) editorView.dispatch(tr);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  }, [selected, editor, node.attrs, updateAttributes]);

  // Container style
  let containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    zIndex: node.attrs.zIndex || 1,
    cursor,
  };

  if (wrapMode === 'square') {
    containerStyle.float = float as any;
    containerStyle.marginLeft = `${marginLeft}px`;
    containerStyle.marginRight = `${marginRight}px`;
    containerStyle.marginTop = `${marginTop}px`;
    containerStyle.marginBottom = `${marginBottom}px`;
  } else {
    containerStyle.display = 'block';
    containerStyle.marginLeft = `${marginLeft}px`;
    containerStyle.marginRight = 'auto';
    containerStyle.marginTop = `${marginTop}px`;
    containerStyle.marginBottom = `${marginBottom}px`;
  }

  return (
    <NodeViewWrapper
      style={containerStyle}
      className={`resizable-image-wrapper ${selected ? 'selected' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMoveOverImage}
    >
      <div className="resizable-image-container" ref={wrapperRef}>
        {selected && (
          <div
            className="image-toolbar"
            contentEditable={false}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={`image-toolbar-btn ${wrapMode === 'square' ? 'active' : ''}`}
              onClick={() => updateAttributes({ wrapMode: 'square' })}
              title="Square Wrap"
            >
              <Square size={14} />
            </button>
            <button
              type="button"
              className={`image-toolbar-btn ${wrapMode === 'top-bottom' ? 'active' : ''}`}
              onClick={() => updateAttributes({ wrapMode: 'top-bottom' })}
              title="Top & Bottom Wrap"
            >
              <ArrowDownUp size={14} />
            </button>
          </div>
        )}

        <img
          ref={imgRef}
          src={src}
          alt={alt}
          title={title}
          onLoad={handleImageLoad}
          style={{
            width: `${width}px`,
            height: height && height !== 'auto' ? `${height}px` : 'auto',
            display: 'block',
            maxWidth: '100%',
            borderRadius: '4px',
            pointerEvents: 'none',
            userSelect: 'none',
            outline: selected ? '2px solid var(--accent-primary)' : 'none',
          }}
          className="resizable-image"
          draggable={false}
        />
      </div>
    </NodeViewWrapper>
  );
};

export default ResizableImageComponent;