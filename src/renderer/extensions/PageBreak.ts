import { Node, mergeAttributes } from '@tiptap/core';

export interface PageBreakOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      /**
       * Insert a hard page break.
       * In the paged view, PageManager will force a split at this node.
       */
      setPageBreak: () => ReturnType;
    };
  }
}

/**
 * PageBreak — custom TipTap node that signals a forced page split.
 *
 * - Renders as a visible "--- Page Break ---" dashed line in the editor
 * - `atom: true` makes it selectable as a unit (click to select, Backspace to delete)
 * - Cannot be placed inside a table, list item, or code block (group: 'block')
 * - Keyboard shortcut: Ctrl+Enter
 */
export const PageBreak = Node.create<PageBreakOptions>({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'page-break-node',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="page-break"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'page-break',
        contenteditable: 'false',
      }),
      ['span', { class: 'page-break-node__label' }, 'Page Break'],
    ];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) => {
          return chain()
            .insertContent([
              { type: this.name },
              { type: 'paragraph' },
            ])
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.setPageBreak(),
    };
  },
});
