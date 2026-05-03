// ─── WikiLink TipTap Extension ─────────────────────────────────────────────
// Adds [[WikiLink]] support to the TipTap editor.
// Typing [[ opens autocomplete, selecting inserts a linked node.

import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, string>;
  onNavigate: (docId: string, title: string) => void;
  onSearch: (query: string) => Promise<Array<{ id: string; title: string; path?: string }>>;
  onCreate: (title: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLink: {
      insertWikiLink: (attrs: { documentId: string; title: string; resolved: boolean }) => ReturnType;
    };
  }
}

export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikiLink',

  group: 'inline',

  inline: true,

  selectable: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      onNavigate: () => {},
      onSearch: async () => [],
      onCreate: () => {},
    };
  },

  addAttributes() {
    return {
      documentId: {
        default: '',
      },
      title: {
        default: '',
      },
      resolved: {
        default: true,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wiki-link]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const resolved = HTMLAttributes.resolved !== 'false' && HTMLAttributes.resolved !== false;
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-wiki-link': '',
        class: resolved ? 'wiki-link wiki-link--resolved' : 'wiki-link wiki-link--unresolved',
        title: `Go to: ${HTMLAttributes.title || 'Untitled'}`,
      }),
      `[[${HTMLAttributes.title || 'Untitled'}]]`,
    ];
  },

  addCommands() {
    return {
      insertWikiLink:
        (attrs) =>
        ({ chain }) => {
          return chain().insertContent({ type: this.name, attrs }).run();
        },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: new PluginKey('wikiLinkAutocomplete'),

        props: {
          handleClick(view: EditorView, pos: number) {
            const node = view.state.doc.nodeAt(pos);
            if (node?.type.name === 'wikiLink') {
              const docId = node.attrs.documentId as string;
              const title = node.attrs.title as string;
              const resolved = node.attrs.resolved as boolean;

              if (resolved && docId) {
                extension.options.onNavigate(docId, title);
              } else {
                extension.options.onCreate(title);
              }
              return true;
            }
            return false;
          },

          handleKeyDown(view: EditorView, event: KeyboardEvent) {
            // Detect [[ trigger
            if (event.key === '[') {
              const { state } = view;
              const { from } = state.selection;
              const textBefore = state.doc.textBetween(Math.max(0, from - 1), from);

              if (textBefore === '[') {
                // Emit a custom event that React can listen to
                const customEvent = new CustomEvent('wiki-link-trigger', {
                  detail: {
                    from: from - 1,
                    view,
                  },
                });
                window.dispatchEvent(customEvent);
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
