import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ListChecks,
  Indent,
  Outdent,
  Table,
  Image,
  Minus,
  Quote,
  Code2,
  Link,
  SpellCheck,
  Hash,
  FileText,
  Maximize,
  Palette,
  Highlighter,
  ChevronDown,
  ChevronUp,
  Layout,
  Plus,
  Eye,
  Type,
} from 'lucide-react'
import './EditorToolbar.css'

// ─── Types ───────────────────────────────────────────────────────────────────

interface EditorToolbarProps {
  editor: Editor | null
  onToggleWordCount?: () => void
  onToggleOutline?: () => void
  onToggleDistractionFree?: () => void
  showWordCount?: boolean
  showOutline?: boolean
  isDistractionFree?: boolean
  paperSize?: 'a4' | 'letter' | 'legal'
  onPaperSizeChange?: (size: 'a4' | 'letter' | 'legal') => void
}

interface ToolbarButtonProps {
  icon: React.ReactNode
  label: string
  shortcut?: string
  isActive?: boolean
  isDisabled?: boolean
  onClick: () => void
  id: string
  showLabel?: boolean
}

// ─── Preset colors for highlight ─────────────────────────────────────────────

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Orange', value: '#fed7aa' },
  { name: 'Purple', value: '#e9d5ff' },
  { name: 'None', value: '' },
]

const PAPER_SIZES = [
  { name: 'A4', value: 'a4', label: 'A4 (210 x 297 mm)' },
  { name: 'Letter', value: 'letter', label: 'Letter (8.5 x 11 in)' },
  { name: 'Legal', value: 'legal', label: 'Legal (8.5 x 14 in)' },
]

// ─── ToolbarButton ───────────────────────────────────────────────────────────

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon,
  label,
  shortcut,
  isActive = false,
  isDisabled = false,
  onClick,
  id,
  showLabel = false,
}) => {
  const tooltipText = shortcut ? `${label} (${shortcut})` : label

  return (
    <button
      id={id}
      className={`toolbar-btn ${isActive ? 'toolbar-btn--active' : ''} ${showLabel ? 'toolbar-btn--with-label' : ''}`}
      onClick={onClick}
      disabled={isDisabled}
      title={showLabel ? '' : tooltipText}
      aria-label={tooltipText}
      type="button"
    >
      {icon}
      {showLabel && <span className="toolbar-btn__text">{label}</span>}
    </button>
  )
}

const MemoToolbarButton = memo(ToolbarButton)

// ─── Generic Dropdown Component ──────────────────────────────────────────────

interface DropdownItem {
  id: string
  label: string
  icon: React.ReactNode
  isActive?: boolean
  isDisabled?: boolean
  onClick: () => void
  shortcut?: string
}

const GenericDropdown: React.FC<{
  label: string
  icon: React.ReactNode
  items: DropdownItem[]
  id: string
}> = ({ label, icon, items, id }) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="toolbar-dropdown" ref={ref}>
      <button
        id={id}
        className={`toolbar-dropdown__trigger ${isOpen ? 'toolbar-dropdown__trigger--active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={label}
        type="button"
      >
        {icon}
        <span className="toolbar-dropdown__label">{label}</span>
        <ChevronDown size={12} className={`dropdown-chevron ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="toolbar-dropdown__menu">
          {items.map((item) => (
            <button
              key={item.id}
              className={`toolbar-dropdown__item ${item.isActive ? 'toolbar-dropdown__item--active' : ''}`}
              onClick={() => {
                item.onClick()
                setIsOpen(false)
              }}
              disabled={item.isDisabled}
              type="button"
            >
              <div className="toolbar-dropdown__item-content">
                {item.icon}
                <span className="toolbar-dropdown__item-label">{item.label}</span>
                {item.shortcut && <span className="toolbar-dropdown__item-shortcut">{item.shortcut}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Font Size Input ─────────────────────────────────────────────────────────

const FontSizeInput: React.FC<{ editor: Editor }> = ({ editor }) => {
  const currentSizeAttr = editor.getAttributes('textStyle')?.fontSize
  const numericSize = currentSizeAttr ? parseInt(currentSizeAttr, 10) : 16
  const [localValue, setLocalValue] = useState(String(numericSize))

  useEffect(() => {
    const size = editor.getAttributes('textStyle')?.fontSize
    setLocalValue(size ? String(parseInt(size, 10)) : '16')
  }, [editor.state.selection]) // eslint-disable-line react-hooks/exhaustive-deps

  const applySize = useCallback(
    (size: number) => {
      const clamped = Math.max(8, Math.min(96, size))
      setLocalValue(String(clamped))
      editor.chain().focus().setFontSize(`${clamped}px`).run()
    },
    [editor]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      const val = parseInt(localValue, 10)
      if (!isNaN(val)) applySize(val)
      ;(e.target as HTMLInputElement).blur()
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      applySize(numericSize + 1)
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      applySize(numericSize - 1)
    }
  }

  return (
    <div className="toolbar-fontsize" title="Font Size (8–96)">
      <button
        className="toolbar-fontsize__btn"
        onClick={() => applySize(numericSize - 1)}
        type="button"
        aria-label="Decrease font size"
      >
        <ChevronDown size={12} />
      </button>
      <input
        id="toolbar-font-size"
        className="toolbar-fontsize__input"
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          const val = parseInt(localValue, 10)
          if (!isNaN(val)) applySize(val)
        }}
      />
      <button
        className="toolbar-fontsize__btn"
        onClick={() => applySize(numericSize + 1)}
        type="button"
        aria-label="Increase font size"
      >
        <ChevronUp size={12} />
      </button>
    </div>
  )
}

// ─── Paper Size Dropdown ───────────────────────────────────────────────────

const PaperSizeDropdown: React.FC<{
  currentSize: string
  onChange: (size: any) => void
}> = ({ currentSize, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const activeSize = PAPER_SIZES.find((s) => s.value === currentSize) || PAPER_SIZES[0]

  const toggleOpen = (): void => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 4, left: rect.left })
    }
    setIsOpen(!isOpen)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="toolbar-dropdown">
      <button
        ref={triggerRef}
        className="toolbar-dropdown__trigger"
        onClick={toggleOpen}
        title="Paper Size"
        type="button"
        id="toolbar-paper-size"
      >
        <Maximize size={14} className="rotate-45" />
        <span className="toolbar-dropdown__label">{activeSize.name}</span>
        <ChevronDown size={12} />
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          className="toolbar-dropdown__menu toolbar-dropdown__menu--paper-size"
          style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
          }}
        >
          {PAPER_SIZES.map((size) => (
            <button
              key={size.value}
              className={`toolbar-dropdown__item ${
                currentSize === size.value ? 'toolbar-dropdown__item--active' : ''
              }`}
              onClick={() => {
                onChange(size.value)
                setIsOpen(false)
              }}
              type="button"
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                <span style={{ fontWeight: 500 }}>{size.name}</span>
                <span style={{ fontSize: '10px', opacity: 0.6, textTransform: 'uppercase' as const }}>{size.label}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


const TextColorPicker: React.FC<{ editor: Editor }> = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const currentColor = editor.getAttributes('textStyle')?.color ?? '#cdd6f4'

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="toolbar-color-picker" ref={ref}>
      <button
        className="toolbar-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Text Color"
        type="button"
        id="toolbar-text-color"
      >
        <Palette size={16} />
        <span
          className="toolbar-color-indicator"
          style={{ backgroundColor: currentColor }}
        />
      </button>
      {isOpen && (
        <div className="toolbar-color-picker__popup">
          <label className="toolbar-color-picker__label">Text Color</label>
          <input
            type="color"
            value={currentColor}
            onChange={(e) => {
              editor.chain().focus().setColor(e.target.value).run()
            }}
            className="toolbar-color-picker__input"
          />
          <button
            className="toolbar-color-picker__reset"
            onClick={() => {
              editor.chain().focus().unsetColor().run()
              setIsOpen(false)
            }}
            type="button"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  )
}

const HighlightColorPicker: React.FC<{ editor: Editor }> = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="toolbar-color-picker" ref={ref}>
      <button
        className="toolbar-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Highlight Color"
        type="button"
        id="toolbar-highlight-color"
      >
        <Highlighter size={16} />
      </button>
      {isOpen && (
        <div className="toolbar-color-picker__popup">
          <label className="toolbar-color-picker__label">Highlight</label>
          <div className="toolbar-highlight-swatches">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.name}
                className={`toolbar-highlight-swatch ${
                  c.value === '' ? 'toolbar-highlight-swatch--none' : ''
                }`}
                style={c.value ? { backgroundColor: c.value } : undefined}
                onClick={() => {
                  if (c.value === '') {
                    editor.chain().focus().unsetHighlight().run()
                  } else {
                    editor
                      .chain()
                      .focus()
                      .toggleHighlight({ color: c.value })
                      .run()
                  }
                  setIsOpen(false)
                }}
                title={c.name}
                type="button"
              >
                {c.value === '' && '✕'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main EditorToolbar ──────────────────────────────────────────────────────

export const EditorToolbarInner: React.FC<EditorToolbarProps> = ({
  editor,
  onToggleWordCount,
  onToggleOutline,
  onToggleDistractionFree,
  showWordCount = false,
  showOutline = false,
  isDistractionFree = false,
  paperSize = 'a4',
  onPaperSizeChange,
}) => {
  const [spellCheck, setSpellCheck] = useState(true)

  if (!editor) {
    return <div className="editor-toolbar editor-toolbar--empty" />
  }

  const toggleSpellCheck = (): void => {
    const newVal = !spellCheck
    setSpellCheck(newVal)
    document.querySelectorAll('.collab-editor-content, .coollab-page-editor').forEach((el) => {
      el.setAttribute('spellcheck', String(newVal))
    })
  }

  // ── Dropdown Item Groups ──────────────────────────────────────────────────

  const layoutItems: DropdownItem[] = [
    {
      id: 'align-left',
      label: 'Align Left',
      icon: <AlignLeft size={16} />,
      isActive: editor.isActive({ textAlign: 'left' }),
      onClick: () => editor.chain().focus().setTextAlign('left').run(),
    },
    {
      id: 'align-center',
      label: 'Align Center',
      icon: <AlignCenter size={16} />,
      isActive: editor.isActive({ textAlign: 'center' }),
      onClick: () => editor.chain().focus().setTextAlign('center').run(),
    },
    {
      id: 'align-right',
      label: 'Align Right',
      icon: <AlignRight size={16} />,
      isActive: editor.isActive({ textAlign: 'right' }),
      onClick: () => editor.chain().focus().setTextAlign('right').run(),
    },
    {
      id: 'align-justify',
      label: 'Justify',
      icon: <AlignJustify size={16} />,
      isActive: editor.isActive({ textAlign: 'justify' }),
      onClick: () => editor.chain().focus().setTextAlign('justify').run(),
    },
  ]

  const listItems: DropdownItem[] = [
    {
      id: 'bullet-list',
      label: 'Bullet List',
      icon: <List size={16} />,
      shortcut: 'Ctrl+Shift+8',
      isActive: editor.isActive('bulletList'),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: 'ordered-list',
      label: 'Numbered List',
      icon: <ListOrdered size={16} />,
      shortcut: 'Ctrl+Shift+9',
      isActive: editor.isActive('orderedList'),
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      id: 'task-list',
      label: 'Task List',
      icon: <ListChecks size={16} />,
      isActive: editor.isActive('taskList'),
      onClick: () => editor.chain().focus().toggleTaskList().run(),
    },
    {
      id: 'indent',
      label: 'Indent',
      icon: <Indent size={16} />,
      shortcut: 'Tab',
      onClick: () => editor.chain().focus().sinkListItem('listItem').run(),
      isDisabled: !editor.can().sinkListItem('listItem'),
    },
    {
      id: 'outdent',
      label: 'Outdent',
      icon: <Outdent size={16} />,
      shortcut: 'Shift+Tab',
      onClick: () => editor.chain().focus().liftListItem('listItem').run(),
      isDisabled: !editor.can().liftListItem('listItem'),
    },
  ]

  const insertItems: DropdownItem[] = [
    {
      id: 'insert-table',
      label: 'Table',
      icon: <Table size={16} />,
      onClick: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: 'insert-image',
      label: 'Image',
      icon: <Image size={16} />,
      onClick: () => {
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
              editor.chain().focus().setImage({ src: result }).run()
            }
          }
          reader.readAsDataURL(file)
        }
        input.click()
      },
    },
    {
      id: 'insert-link',
      label: 'Link',
      icon: <Link size={16} />,
      shortcut: 'Ctrl+K',
      isActive: editor.isActive('link'),
      onClick: () => {
        if (editor.isActive('link')) {
          editor.chain().focus().unsetLink().run()
          return
        }
        const url = window.prompt('Enter URL:')
        if (url) {
          editor.chain().focus().setLink({ href: url, target: '_blank' }).run()
        }
      },
    },
    {
      id: 'insert-hr',
      label: 'Horizontal Rule',
      icon: <Minus size={16} />,
      onClick: () => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      id: 'insert-blockquote',
      label: 'Blockquote',
      icon: <Quote size={16} />,
      isActive: editor.isActive('blockquote'),
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      id: 'insert-code-block',
      label: 'Code Block',
      icon: <Code2 size={16} />,
      isActive: editor.isActive('codeBlock'),
      onClick: () => editor.chain().focus().toggleCodeBlock().run(),
    },
  ]

  const viewItems: DropdownItem[] = [
    {
      id: 'spellcheck',
      label: 'Spell Check',
      icon: <SpellCheck size={16} />,
      isActive: spellCheck,
      onClick: toggleSpellCheck,
    },
    {
      id: 'word-count',
      label: 'Word Count',
      icon: <Hash size={16} />,
      isActive: showWordCount,
      onClick: () => onToggleWordCount?.(),
    },
    {
      id: 'outline',
      label: 'Outline',
      icon: <FileText size={16} />,
      isActive: showOutline,
      onClick: () => onToggleOutline?.(),
    },
    {
      id: 'distraction-free',
      label: 'Fullscreen Focus',
      icon: <Maximize size={16} />,
      shortcut: 'Ctrl+Shift+F',
      isActive: isDistractionFree,
      onClick: () => onToggleDistractionFree?.(),
    },
  ]

  const styleItems: DropdownItem[] = [
    {
        id: 'strikethrough',
        label: 'Strikethrough',
        icon: <Strikethrough size={16} />,
        shortcut: 'Ctrl+Shift+X',
        isActive: editor.isActive('strike'),
        onClick: () => editor.chain().focus().toggleStrike().run(),
      },
      {
        id: 'subscript',
        label: 'Subscript',
        icon: <Subscript size={16} />,
        isActive: editor.isActive('subscript'),
        onClick: () => editor.chain().focus().toggleSubscript().run(),
      },
      {
        id: 'superscript',
        label: 'Superscript',
        icon: <Superscript size={16} />,
        isActive: editor.isActive('superscript'),
        onClick: () => editor.chain().focus().toggleSuperscript().run(),
      },
  ]

  return (
    <div className="editor-toolbar" id="editor-toolbar">
      {/* Group 1 — History (High priority, stay visible) */}
      <div className="toolbar-group">
        <MemoToolbarButton
          id="toolbar-undo"
          icon={<Undo2 size={16} />}
          label="Undo"
          shortcut="Ctrl+Z"
          onClick={() => editor.chain().focus().undo().run()}
          isDisabled={!editor.can().undo()}
        />
        <MemoToolbarButton
          id="toolbar-redo"
          icon={<Redo2 size={16} />}
          label="Redo"
          shortcut="Ctrl+Shift+Z"
          onClick={() => editor.chain().focus().redo().run()}
          isDisabled={!editor.can().redo()}
        />
      </div>

      <div className="toolbar-divider" />

      {/* Group 2 — Font Settings */}
      <div className="toolbar-group">
        <FontSizeInput editor={editor} />
      </div>

      <div className="toolbar-divider" />

      {/* Group 3 — Primary Styling (Visible) */}
      <div className="toolbar-group">
        <MemoToolbarButton
          id="toolbar-bold"
          icon={<Bold size={16} />}
          label="Bold"
          shortcut="Ctrl+B"
          isActive={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <MemoToolbarButton
          id="toolbar-italic"
          icon={<Italic size={16} />}
          label="Italic"
          shortcut="Ctrl+I"
          isActive={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <MemoToolbarButton
          id="toolbar-underline"
          icon={<Underline size={16} />}
          label="Underline"
          shortcut="Ctrl+U"
          isActive={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <GenericDropdown
            id="toolbar-more-styles"
            label="Styles"
            icon={<Type size={16} />}
            items={styleItems}
        />
      </div>

      <div className="toolbar-divider" />

      {/* Group 4 — Color */}
      <div className="toolbar-group">
        <TextColorPicker editor={editor} />
        <HighlightColorPicker editor={editor} />
      </div>

      <div className="toolbar-divider" />

      {/* Group 5 — Grouped Dropdowns (HCI simplification) */}
      <div className="toolbar-group">
        <GenericDropdown
          id="toolbar-layout"
          label="Layout"
          icon={<Layout size={16} />}
          items={layoutItems}
        />
        <GenericDropdown
          id="toolbar-lists"
          label="Lists"
          icon={<List size={16} />}
          items={listItems}
        />
        <GenericDropdown
          id="toolbar-insert"
          label="Insert"
          icon={<Plus size={16} />}
          items={insertItems}
        />
      </div>

      <div className="toolbar-divider" />

      {/* Group 6 — View Settings */}
      <div className="toolbar-group">
        <GenericDropdown
            id="toolbar-view"
            label="View"
            icon={<Eye size={16} />}
            items={viewItems}
        />
      </div>
    </div>
  )
}

export const EditorToolbar = memo(EditorToolbarInner)
