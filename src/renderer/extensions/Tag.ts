// ─── Tag TipTap Extension ──────────────────────────────────────────────────
// Adds #tag inline node support to the TipTap editor.
// Typing # followed by text creates a tag pill.

import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

export interface TagOptions {
  HTMLAttributes: Record<string, string>;
  onTagClick: (tag: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tag: {
      insertTag: (attrs: { tag: string }) => ReturnType;
    };
  }
}

export const Tag = Node.create<TagOptions>({
  name: 'tag',

  group: 'inline',

  inline: true,

  selectable: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      onTagClick: () => {},
    };
  },

  addAttributes() {
    return {
      tag: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-tag]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-tag': HTMLAttributes.tag || '',
        class: 'editor-tag',
        title: `Tag: #${HTMLAttributes.tag || ''}`,
      }),
      `#${HTMLAttributes.tag || ''}`,
    ];
  },

  addCommands() {
    return {
      insertTag:
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
        key: new PluginKey('tagPlugin'),

        props: {
          handleClick(view: EditorView, pos: number) {
            const node = view.state.doc.nodeAt(pos);
            if (node?.type.name === 'tag') {
              extension.options.onTagClick(node.attrs.tag as string);
              return true;
            }
            return false;
          },

          handleTextInput(view: EditorView, from: number, to: number, text: string) {
            // Detect # trigger at the start of a word
            if (text === ' ' || text === '\n') {
              const doc = view.state.doc;
              const before = doc.textBetween(Math.max(0, from - 30), from);
              const tagMatch = before.match(/#([a-zA-Z0-9_-]+)$/);

              if (tagMatch) {
                const tagText = tagMatch[1];
                const tagStart = from - tagMatch[0].length;

                // Delete the typed text and insert a tag node
                const tr = view.state.tr;
                tr.delete(tagStart, from);
                tr.insert(
                  tagStart,
                  view.state.schema.nodes.tag.create({ tag: tagText })
                );
                // Add the space/newline after
                tr.insertText(text, tagStart + 1);
                view.dispatch(tr);
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
