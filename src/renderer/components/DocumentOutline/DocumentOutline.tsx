import React, { useCallback, useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { FileText } from 'lucide-react'
import './DocumentOutline.css'

interface DocumentOutlineProps {
  editor: Editor
}

interface HeadingItem {
  id: string
  text: string
  level: number
  pos: number
}

export const DocumentOutline: React.FC<DocumentOutlineProps> = ({ editor }) => {
  const [headings, setHeadings] = useState<HeadingItem[]>([])
  const [activeId, setActiveId] = useState<string>('')

  // Extract headings from the document
  const extractHeadings = useCallback(() => {
    const doc = editor.state.doc
    const items: HeadingItem[] = []
    let index = 0

    doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const level = node.attrs.level as number
        const text = node.textContent
        if (text.trim()) {
          items.push({
            id: `heading-${index++}`,
            text,
            level,
            pos,
          })
        }
      }
    })

    setHeadings(items)
  }, [editor])

  // Update headings on doc changes
  useEffect(() => {
    extractHeadings()

    const handleUpdate = (): void => {
      extractHeadings()
    }

    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, extractHeadings])

  // Track scroll position to highlight current heading
  useEffect(() => {
    const editorElement = editor.view.dom.closest('.app-editor-area')
    if (!editorElement) return

    const handleScroll = (): void => {
      // Find which heading is currently visible
      const scrollTop = editorElement.scrollTop
      let currentHeading = ''

      for (const heading of headings) {
        try {
          const coords = editor.view.coordsAtPos(heading.pos)
          const editorRect = editorElement.getBoundingClientRect()
          const relativeTop = coords.top - editorRect.top + scrollTop

          if (relativeTop <= scrollTop + 100) {
            currentHeading = heading.id
          }
        } catch {
          // Position may be invalid
        }
      }

      if (currentHeading) {
        setActiveId(currentHeading)
      }
    }

    editorElement.addEventListener('scroll', handleScroll)
    handleScroll() // Initial check
    return () => editorElement.removeEventListener('scroll', handleScroll)
  }, [editor, headings])

  const scrollToHeading = useCallback(
    (pos: number) => {
      editor.chain().focus().setTextSelection(pos).scrollIntoView().run()
    },
    [editor]
  )

  if (headings.length === 0) {
    return (
      <div className="doc-outline">
        <h3 className="doc-outline__header">
          <FileText size={14} />
          Document Outline
        </h3>
        <p className="doc-outline__empty">
          Add headings to your document to see an outline here.
        </p>
      </div>
    )
  }

  return (
    <div className="doc-outline">
      <h3 className="doc-outline__header">
        <FileText size={14} />
        Document Outline
      </h3>
      <nav className="doc-outline__list">
        {headings.map((heading) => (
          <button
            key={heading.id}
            className={`doc-outline__item doc-outline__item--h${heading.level} ${
              activeId === heading.id ? 'doc-outline__item--active' : ''
            }`}
            onClick={() => scrollToHeading(heading.pos)}
            title={heading.text}
            type="button"
          >
            <span className="doc-outline__level">H{heading.level}</span>
            <span className="doc-outline__text">{heading.text}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
