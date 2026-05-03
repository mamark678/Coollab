import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ResizableImageComponent from './ResizableImageComponent.tsx';
import { Plugin, PluginKey } from 'prosemirror-state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      setImage: (options: { src: string, alt?: string, title?: string, width?: string, float?: string, align?: string }) => ReturnType,
    }
  }
}

export interface ResizableImageOptions {
  inline: boolean;
  allowBase64: boolean;
  HTMLAttributes: Record<string, any>;
}

export const ResizableImage = Node.create<ResizableImageOptions>({
  name: 'resizableImage',

  addOptions() {
    return {
      inline: false,
      allowBase64: true,
      HTMLAttributes: {},
    };
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? 'inline' : 'block';
  },

  draggable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => {
          if (!attributes.id) {
             return { 'data-id': crypto.randomUUID() };
          }
          return { 'data-id': attributes.id };
        },
      },
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: 300 },
      height: { default: 'auto' },
      wrapMode: { default: 'square' }, // 'square' | 'top-bottom'
      float: { default: 'none' },
      marginLeft: { default: 0 },
      marginRight: { default: 0 },
      marginTop: { default: 0 },
      marginBottom: { default: 8 },
      padding: { default: 8 },
      zIndex: { default: 1 },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (element) => {
          const img = element as HTMLImageElement;
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt'),
            title: img.getAttribute('title'),
            width: img.style.width || img.getAttribute('width') || null,
            height: img.style.height || img.getAttribute('height') || null,
            float: img.style.float || null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { float, width, height, marginLeft, marginRight, marginTop, marginBottom, wrapMode } = HTMLAttributes;
    let style = `width: ${width}px; height: ${height};`;
    
    if (wrapMode === 'square') {
       style += ` float: ${float};`;
       style += ` margin-left: ${marginLeft}px;`;
       style += ` margin-right: ${marginRight}px;`;
       style += ` margin-top: ${marginTop}px;`;
       style += ` margin-bottom: ${marginBottom}px;`;
    } else {
       style += ` display: block; margin: ${marginTop || 8}px auto ${marginBottom || 8}px auto;`;
    }
    
    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { style }),
    ];
  },

  addCommands() {
    return {
      setImage: (options) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        })
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('resizableImageDropHandler'),
        props: {
          handleDrop(view, event, slice, moved) {
            if (!event.dataTransfer || !event.dataTransfer.files || event.dataTransfer.files.length === 0) {
              return false;
            }

            const files = Array.from(event.dataTransfer.files);
            const images = files.filter(file => file.type.startsWith('image/'));

            if (images.length === 0) {
              return false;
            }

            event.preventDefault();

            const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
            const pos = coordinates ? coordinates.pos : view.state.selection.from; // Fallback to current selection

            images.forEach(image => {
              const reader = new FileReader();
              reader.onload = (readerEvent) => {
                const node = view.state.schema.nodes.resizableImage.create({
                  id: crypto.randomUUID(),
                  src: readerEvent.target?.result,
                  width: 300,
                  wrapMode: 'square',
                  float: 'none'
                });
                const transaction = view.state.tr.insert(pos, node);
                view.dispatch(transaction);
              };
              reader.readAsDataURL(image);
            });

            return true;
          },
          handlePaste(view, event, slice) {
            if (!event.clipboardData || !event.clipboardData.files || event.clipboardData.files.length === 0) {
              return false;
            }

            const files = Array.from(event.clipboardData.files);
            const images = files.filter(file => file.type.startsWith('image/'));

            if (images.length === 0) {
              return false;
            }

            event.preventDefault();

            images.forEach(image => {
              const reader = new FileReader();
              reader.onload = (readerEvent) => {
                const node = view.state.schema.nodes.resizableImage.create({
                  id: crypto.randomUUID(),
                  src: readerEvent.target?.result,
                  width: 300,
                  wrapMode: 'square',
                  float: 'none'
                });
                const transaction = view.state.tr.replaceSelectionWith(node);
                view.dispatch(transaction);
              };
              reader.readAsDataURL(image);
            });

            return true;
          }
        },
      }),
    ];
  },
});
