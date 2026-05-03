import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Quote,
  Code2,
  List,
  ListOrdered,
  ListChecks,
  Table,
  Image,
  Minus,
  Link,
  Columns2,
} from 'lucide-react'
import './SlashCommand.css'

interface SlashCommandProps {
  editor: Editor
}

interface CommandItem {
  group: string
  icon: React.ReactNode
  name: string
  description: string
  action: (editor: Editor) => void
}

const COMMANDS: CommandItem[] = [
  // Text
  {
    group: 'Text',
    icon: <Type size={18} />,
    name: 'Paragraph',
    description: 'Plain text block',
    action: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    group: 'Text',
    icon: <Heading1 size={18} />,
    name: 'Heading 1',
    description: 'Large section heading',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    group: 'Text',
    icon: <Heading2 size={18} />,
    name: 'Heading 2',
    description: 'Medium section heading',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    group: 'Text',
    icon: <Heading3 size={18} />,
    name: 'Heading 3',
    description: 'Small section heading',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    group: 'Text',
    icon: <Heading4 size={18} />,
    name: 'Heading 4',
    description: 'Subsection heading',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 4 }).run(),
  },
  {
    group: 'Text',
    icon: <Quote size={18} />,
    name: 'Quote',
    description: 'Block quotation',
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    group: 'Text',
    icon: <Code2 size={18} />,
    name: 'Code Block',
    description: 'Syntax highlighted code',
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  // Lists
  {
    group: 'Lists',
    icon: <List size={18} />,
    name: 'Bullet List',
    description: 'Unordered list',
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    group: 'Lists',
    icon: <ListOrdered size={18} />,
    name: 'Numbered List',
    description: 'Ordered list',
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    group: 'Lists',
    icon: <ListChecks size={18} />,
    name: 'Task List',
    description: 'Checklist with checkboxes',
    action: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  // Insert
  {
    group: 'Insert',
    icon: <Table size={18} />,
    name: 'Table',
    description: 'Insert a table',
    action: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    group: 'Insert',
    icon: <Image size={18} />,
    name: 'Image',
    description: 'Upload an image',
    action: (editor) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result
          if (typeof result === 'string') {
            // NOTE: Base64 for prototype. Use S3/Firebase Storage in production.
            editor.chain().focus().setImage({ src: result }).run()
          }
        }
        reader.readAsDataURL(file)
      }
      input.click()
    },
  },
  {
    group: 'Insert',
    icon: <Minus size={18} />,
    name: 'Divider',
    description: 'Horizontal separator',
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    group: 'Insert',
    icon: <Link size={18} />,
    name: 'Link',
    description: 'Insert a hyperlink',
    action: (editor) => {
      const url = window.prompt('Enter URL:')
      if (url) {
        editor.chain().focus().setLink({ href: url, target: '_blank' }).run()
      }
    },
  },
  // Layout
  {
    group: 'Layout',
    icon: <Columns2 size={18} />,
    name: '2-Column Layout',
    description: 'Side-by-side columns',
    action: (editor) => {
      // Insert a simple 2-column table as layout
      editor
        .chain()
        .focus()
        .insertTable({ rows: 1, cols: 2, withHeaderRow: false })
        .run()
    },
  },
]

export const SlashCommand: React.FC<SlashCommandProps> = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  // Filter commands based on query
  const filteredCommands = COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(query.toLowerCase()) ||
      cmd.group.toLowerCase().includes(query.toLowerCase())
  )

  // Group filtered commands
  const groupedCommands = filteredCommands.reduce<Record<string, CommandItem[]>>(
    (acc, cmd) => {
      if (!acc[cmd.group]) acc[cmd.group] = []
      acc[cmd.group].push(cmd)
      return acc
    },
    {}
  )

  const executeCommand = useCallback(
    (index: number) => {
      const cmd = filteredCommands[index]
      if (!cmd) return

      // Delete the slash and query text
      const { from } = editor.state.selection
      const textBefore = editor.state.doc.textBetween(
        Math.max(0, from - query.length - 1),
        from,
        '\n'
      )
      const slashPos = textBefore.lastIndexOf('/')
      if (slashPos >= 0) {
        const deleteFrom = from - query.length - 1
        editor
          .chain()
          .focus()
          .deleteRange({ from: deleteFrom, to: from })
          .run()
      }

      cmd.action(editor)
      setIsOpen(false)
      setQuery('')
    },
    [editor, filteredCommands, query]
  )

  // Listen for slash key
  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isOpen) {
        // Check if / is typed on an empty line or at start
        if (event.key === '/') {
          const { $from } = editor.state.selection
          const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
          if (textBefore.trim() === '') {
            // Get cursor position for menu placement
            const coords = editor.view.coordsAtPos(editor.state.selection.from)
            setPosition({
              top: coords.bottom + 4,
              left: coords.left,
            })
            setIsOpen(true)
            setQuery('')
            setSelectedIndex(0)
          }
        }
        return
      }

      // Handle navigation in open state
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        executeCommand(selectedIndex)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
        setQuery('')
      } else if (event.key === 'Backspace') {
        if (query.length === 0) {
          setIsOpen(false)
        } else {
          setQuery((prev) => prev.slice(0, -1))
          setSelectedIndex(0)
        }
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        setQuery((prev) => prev + event.key)
        setSelectedIndex(0)
      }
    }

    // We need to listen on the editor's DOM to capture keys before ProseMirror
    const editorElement = editor.view.dom
    editorElement.addEventListener('keydown', handleKeyDown)
    return () => editorElement.removeEventListener('keydown', handleKeyDown)
  }, [editor, isOpen, query, selectedIndex, filteredCommands.length, executeCommand])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Scroll selected item into view
  useEffect(() => {
    if (!menuRef.current) return
    const selected = menuRef.current.querySelector('.slash-item--selected')
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!isOpen || filteredCommands.length === 0) return null

  let flatIndex = 0

  return (
    <div
      ref={menuRef}
      className="slash-menu"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
      }}
    >
      {query && (
        <div className="slash-query">
          <span className="slash-query__slash">/</span>
          {query}
        </div>
      )}
      {Object.entries(groupedCommands).map(([group, items]) => (
        <div key={group} className="slash-group">
          <div className="slash-group__label">{group}</div>
          {items.map((cmd) => {
            const idx = flatIndex++
            return (
              <button
                key={cmd.name}
                className={`slash-item ${idx === selectedIndex ? 'slash-item--selected' : ''}`}
                onClick={() => executeCommand(idx)}
                onMouseEnter={() => setSelectedIndex(idx)}
                type="button"
              >
                <span className="slash-item__icon">{cmd.icon}</span>
                <div className="slash-item__text">
                  <span className="slash-item__name">{cmd.name}</span>
                  <span className="slash-item__desc">{cmd.description}</span>
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
