import { Mark, mergeAttributes } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

export interface CommentMarkOptions {
  HTMLAttributes: Record<string, string>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentMark: {
      setComment: (commentId: string) => ReturnType
      updateCommentStatus: (commentId: string, status: string) => ReturnType
      removeCommentMark: (commentId: string) => ReturnType
      unsetComment: () => ReturnType
    }
  }
}

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: 'commentMark',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-comment-id'),
        renderHTML: (attributes: Record<string, string | null>) => {
          if (!attributes.commentId) return {}
          return { 'data-comment-id': attributes.commentId }
        },
      },
      status: {
        default: 'active', // active, unread, resolved
        parseHTML: (element: HTMLElement) => element.getAttribute('data-status'),
        renderHTML: (attributes: Record<string, string | null>) => {
          return { 'data-status': attributes.status || 'active' }
        },
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-comment-id]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'comment-highlight',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setComment:
        (commentId: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { commentId, status: 'active' })
        },
      updateCommentStatus:
        (commentId: string, status: string) =>
        ({ tr, state, dispatch }) => {
          let found = false
          
          state.doc.descendants((node, pos) => {
            node.marks.forEach(mark => {
              if (mark.type.name === this.name && mark.attrs.commentId === commentId) {
                if (dispatch) {
                  tr.addMark(pos, pos + node.nodeSize, this.type.create({ ...mark.attrs, status }))
                }
                found = true
              }
            })
          })
          
          return found
        },
      removeCommentMark:
        (commentId: string) =>
        ({ tr, state, dispatch }) => {
          let found = false
          state.doc.descendants((node, pos) => {
            node.marks.forEach(mark => {
              if (mark.type.name === this.name && mark.attrs.commentId === commentId) {
                if (dispatch) {
                  tr.removeMark(pos, pos + node.nodeSize, this.type)
                }
                found = true
              }
            })
          })
          return found
        },
      unsetComment:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },

  addProseMirrorPlugins() {
    let tooltip: HTMLElement | null = null;

    return [
      new Plugin({
        props: {
          handleClick(view, pos) {
            const mark = view.state.doc.resolve(pos).marks().find(m => m.type.name === 'commentMark')
            
            if (mark) {
              const commentId = mark.attrs.commentId
              window.dispatchEvent(new CustomEvent('coollab-focus-comment', { 
                detail: { commentId } 
              }))
              return true
            }
            return false
          },
          handleDOMEvents: {
            mouseover: (view, event) => {
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
              if (!pos) return false
              
              const mark = view.state.doc.resolve(pos.pos).marks().find(m => m.type.name === 'commentMark')
              if (mark) {
                if (!tooltip) {
                  tooltip = document.createElement('div')
                  tooltip.className = 'comment-tooltip'
                  document.body.appendChild(tooltip)
                }
                
                tooltip.textContent = 'Click to view comment'
                tooltip.style.display = 'block'
                tooltip.style.position = 'fixed'
                tooltip.style.left = `${event.clientX + 10}px`
                tooltip.style.top = `${event.clientY + 10}px`
                tooltip.style.zIndex = '10000'
                tooltip.style.background = '#1a1a26'
                tooltip.style.color = 'white'
                tooltip.style.padding = '4px 8px'
                tooltip.style.borderRadius = '4px'
                tooltip.style.fontSize = '12px'
                tooltip.style.border = '1px solid rgba(255,255,255,0.1)'
                tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)'
                return true
              }
              return false
            },
            mouseout: () => {
              if (tooltip) {
                tooltip.style.display = 'none'
              }
              return false
            }
          }
        },
      }),
    ]
  },
})
