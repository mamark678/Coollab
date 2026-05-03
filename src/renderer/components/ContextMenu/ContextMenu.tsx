import React, { useEffect, useState, useCallback, useRef } from 'react'
import type { Editor } from '@tiptap/core'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link,
  MessageSquarePlus,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Highlighter
} from 'lucide-react'
import './ContextMenu.css'

interface ContextMenuProps {
  editor: Editor
}

type MenuType = 'general' | 'table' | 'image' | 'text'

export const ContextMenu: React.FC<ContextMenuProps> = ({ editor }) => {
  const [menuConfig, setMenuConfig] = useState<{
    visible: boolean
    x: number
    y: number
    type: MenuType
  }>({
    visible: false,
    x: 0,
    y: 0,
    type: 'text',
  })

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent): void => {
      const target = e.target as HTMLElement

      // Only trigger inside the page editor area
      const isInEditor = target.closest('.coollab-page__content') ||
                          target.closest('.coollab-document-editor') ||
                          target.closest('.collab-editor-content')
      if (!isInEditor) return

      e.preventDefault()

      let type: MenuType = 'text'

      if (target.nodeName === 'IMG') {
        type = 'image'
        // Select the image so actions apply to it
        const view = editor.view
        const pos = view.posAtDOM(target, 0)
        if (pos >= 0) {
          editor.commands.setNodeSelection(pos)
        }
      } else if (target.closest('table')) {
        type = 'table'
      }

      setMenuConfig({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        type,
      })
    }

    const handleClick = (e: MouseEvent): void => {
      // Don't close if clicking inside the context menu itself, unless it's a button
      const target = e.target as HTMLElement
      if (target.closest('.context-menu') && target.tagName !== 'BUTTON') return
      
      // Close on any click outside
      setMenuConfig((prev) => ({ ...prev, visible: false }))
    }

    const handleScroll = (): void => {
      setMenuConfig((prev) => ({ ...prev, visible: false }))
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        setMenuConfig((prev) => ({ ...prev, visible: false }))
      }
    }

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('scroll', handleScroll, true)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('scroll', handleScroll, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor])

  const handleAction = useCallback((action: () => void) => {
    action()
    // Don't automatically close for formatting commands so they can toggle multiple things
    // setMenuConfig((prev) => ({ ...prev, visible: false }))
  }, [])

  if (!menuConfig.visible) return null

  // Ensure menu doesn't overflow viewport
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  // Dimensions for the horizontal text menu
  const menuWidth = menuConfig.type === 'text' ? 440 : 200
  const menuHeight = menuConfig.type === 'text' ? 50 : 250

  let x = menuConfig.x
  let y = menuConfig.y

  if (x + menuWidth > viewportWidth) x = viewportWidth - menuWidth - 8
  
  // Try to place it above the cursor if it's the horizontal menu
  if (menuConfig.type === 'text') {
    y -= 60 // Place above cursor
  }
  
  if (y + menuHeight > viewportHeight) y = viewportHeight - menuHeight - 8
  if (y < 8) y = menuConfig.y + 16 // Fallback to below cursor if hits top

  const style: React.CSSProperties = {
    position: 'fixed',
    top: y,
    left: x,
    zIndex: 9999,
  }

  return (
    <div className={`context-menu context-menu--${menuConfig.type}`} style={style}>
      {menuConfig.type === 'text' && (
        <div className="context-menu__bubble-row">
          <button
            className={`context-menu__bubble-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); handleAction(() => editor.chain().focus().toggleBold().run()) }}
            title="Bold"
          >
            <Bold size={16} />
          </button>
          <button
            className={`context-menu__bubble-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); handleAction(() => editor.chain().focus().toggleItalic().run()) }}
            title="Italic"
          >
            <Italic size={16} />
          </button>
          <button
            className={`context-menu__bubble-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); handleAction(() => editor.chain().focus().toggleUnderline().run()) }}
            title="Underline"
          >
            <Underline size={16} />
          </button>
          <button
            className={`context-menu__bubble-btn ${editor.isActive('strike') ? 'is-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); handleAction(() => editor.chain().focus().toggleStrike().run()) }}
            title="Strikethrough"
          >
            <Strikethrough size={16} />
          </button>

          <div className="context-menu__bubble-divider" />

          {/* Color pickers - Simplified for context menu */}
          <button
            className="context-menu__bubble-btn"
            onMouseDown={(e) => { e.preventDefault(); handleAction(() => editor.chain().focus().setColor('#89b4fa').run()) }}
            title="Text Color (Blue)"
          >
            <Palette size={16} />
          </button>
          <button
            className="context-menu__bubble-btn"
            onMouseDown={(e) => { e.preventDefault(); handleAction(() => editor.chain().focus().toggleHighlight({ color: 'rgba(249, 226, 175, 0.4)' }).run()) }}
            title="Highlight"
          >
            <Highlighter size={16} />
          </button>

          <div className="context-menu__bubble-divider" />

          <button
            className={`context-menu__bubble-btn ${editor.isActive('link') ? 'is-active' : ''}`}
            onMouseDown={(e) => { 
              e.preventDefault(); 
              if (editor.isActive('link')) {
                handleAction(() => editor.chain().focus().unsetLink().run())
              } else {
                const url = window.prompt('URL:')
                if (url) {
                  handleAction(() => editor.chain().focus().setLink({ href: url }).run())
                }
              }
            }}
            title="Link"
          >
            <Link size={16} />
          </button>

          <div className="context-menu__bubble-divider" />

          <button
            className={`context-menu__bubble-btn ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); handleAction(() => editor.chain().focus().toggleHeading({ level: 1 }).run()) }}
            title="Heading 1"
          >
            H1
          </button>
          <button
            className={`context-menu__bubble-btn ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); handleAction(() => editor.chain().focus().toggleHeading({ level: 2 }).run()) }}
            title="Heading 2"
          >
            H2
          </button>
          <button
            className={`context-menu__bubble-btn ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); handleAction(() => editor.chain().focus().toggleHeading({ level: 3 }).run()) }}
            title="Heading 3"
          >
            H3
          </button>

          <div className="context-menu__bubble-divider" />

          <button
            className={`context-menu__bubble-btn ${editor.isActive('comment') ? 'is-active' : ''}`}
            onMouseDown={(e) => { 
                e.preventDefault(); 
                handleAction(() => {
                  const selection = editor.state.selection
                  if (selection.empty) {
                    alert('Select text to add a comment.')
                    return
                  }
                  const commentId = `comment-${window.crypto.randomUUID()}`
                  editor.chain().focus().setComment(commentId).run()
                }) 
            }}
            title="Comment"
          >
            <MessageSquarePlus size={16} />
          </button>
        </div>
      )}

      {menuConfig.type === 'table' && (
        <div className="context-menu__vertical">
          <button className="context-menu__item" onMouseDown={(e) => { e.preventDefault(); handleAction(() => { editor.chain().focus().addRowBefore().run(); setMenuConfig(p => ({...p, visible: false})) }) }}>
            <span className="context-menu__item-label">Add Row Above</span>
          </button>
          <button className="context-menu__item" onMouseDown={(e) => { e.preventDefault(); handleAction(() => { editor.chain().focus().addRowAfter().run(); setMenuConfig(p => ({...p, visible: false})) }) }}>
            <span className="context-menu__item-label">Add Row Below</span>
          </button>
          <button className="context-menu__item" onMouseDown={(e) => { e.preventDefault(); handleAction(() => { editor.chain().focus().addColumnBefore().run(); setMenuConfig(p => ({...p, visible: false})) }) }}>
            <span className="context-menu__item-label">Add Column Left</span>
          </button>
          <button className="context-menu__item" onMouseDown={(e) => { e.preventDefault(); handleAction(() => { editor.chain().focus().addColumnAfter().run(); setMenuConfig(p => ({...p, visible: false})) }) }}>
            <span className="context-menu__item-label">Add Column Right</span>
          </button>
          <div className="context-menu__divider" />
          <button className="context-menu__item" onMouseDown={(e) => { e.preventDefault(); handleAction(() => { editor.chain().focus().deleteRow().run(); setMenuConfig(p => ({...p, visible: false})) }) }}>
            <span className="context-menu__item-label">Delete Row</span>
          </button>
          <button className="context-menu__item" onMouseDown={(e) => { e.preventDefault(); handleAction(() => { editor.chain().focus().deleteColumn().run(); setMenuConfig(p => ({...p, visible: false})) }) }}>
            <span className="context-menu__item-label">Delete Column</span>
          </button>
          <button className="context-menu__item context-menu__item--danger" onMouseDown={(e) => { e.preventDefault(); handleAction(() => { editor.chain().focus().deleteTable().run(); setMenuConfig(p => ({...p, visible: false})) }) }}>
            <span className="context-menu__item-label">Delete Table</span>
          </button>
        </div>
      )}

      {menuConfig.type === 'image' && (
        <div className="context-menu__vertical">
          <button className="context-menu__item" onMouseDown={(e) => { e.preventDefault(); handleAction(() => { editor.chain().focus().setTextAlign('left').run(); setMenuConfig(p => ({...p, visible: false})) }) }}>
            <span className="context-menu__item-label">Align Left</span>
          </button>
          <button className="context-menu__item" onMouseDown={(e) => { e.preventDefault(); handleAction(() => { editor.chain().focus().setTextAlign('center').run(); setMenuConfig(p => ({...p, visible: false})) }) }}>
            <span className="context-menu__item-label">Align Center</span>
          </button>
          <button className="context-menu__item" onMouseDown={(e) => { e.preventDefault(); handleAction(() => { editor.chain().focus().setTextAlign('right').run(); setMenuConfig(p => ({...p, visible: false})) }) }}>
            <span className="context-menu__item-label">Align Right</span>
          </button>
          <div className="context-menu__divider" />
          <button className="context-menu__item context-menu__item--danger" onMouseDown={(e) => { e.preventDefault(); handleAction(() => { editor.commands.deleteSelection(); setMenuConfig(p => ({...p, visible: false})) }) }}>
            <span className="context-menu__item-label">Delete Image</span>
          </button>
        </div>
      )}
    </div>
  )
}
