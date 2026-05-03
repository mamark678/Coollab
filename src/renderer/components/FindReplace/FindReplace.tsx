import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { X, ChevronUp, ChevronDown, CaseSensitive, WholeWord, Replace } from 'lucide-react'
import './FindReplace.css'

interface FindReplaceProps {
  editor: Editor
  isOpen: boolean
  onClose: () => void
  showReplace?: boolean
}

interface Match {
  from: number
  to: number
}

export const FindReplace: React.FC<FindReplaceProps> = ({
  editor,
  isOpen,
  onClose,
  showReplace: initialShowReplace = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [replaceTerm, setReplaceTerm] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [matchCase, setMatchCase] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [showReplace, setShowReplace] = useState(initialShowReplace)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const decorationsApplied = useRef(false)

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
      searchInputRef.current.select()
    }
  }, [isOpen])

  useEffect(() => {
    setShowReplace(initialShowReplace)
  }, [initialShowReplace])

  // Find all matches in the document
  const findMatches = useCallback(() => {
    if (!searchTerm.trim()) {
      setMatches([])
      setCurrentMatchIndex(0)
      clearHighlights()
      return
    }

    const doc = editor.state.doc
    const foundMatches: Match[] = []
    const text = doc.textContent
    let searchStr = searchTerm

    // Build regex
    let flags = 'g'
    if (!matchCase) flags += 'i'

    let pattern: string
    if (wholeWord) {
      pattern = `\\b${searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`
    } else {
      pattern = searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    try {
      const regex = new RegExp(pattern, flags)
      let match: RegExpExecArray | null

      // We need to map text positions to doc positions  
      // Walk through the doc to build a position map
      let textOffset = 0
      doc.descendants((node, pos) => {
        if (node.isText && node.text) {
          const nodeText = node.text
          // Check for matches within this text node
          const localRegex = new RegExp(pattern, flags)
          let localMatch: RegExpExecArray | null
          while ((localMatch = localRegex.exec(nodeText)) !== null) {
            foundMatches.push({
              from: pos + localMatch.index,
              to: pos + localMatch.index + localMatch[0].length,
            })
          }
        }
      })
    } catch {
      // Invalid regex — silently ignore
    }

    setMatches(foundMatches)
    if (foundMatches.length > 0) {
      setCurrentMatchIndex(0)
      applyHighlights(foundMatches, 0)
    } else {
      clearHighlights()
    }
  }, [editor, searchTerm, matchCase, wholeWord])

  // Run find on changes
  useEffect(() => {
    findMatches()
  }, [findMatches])

  // Apply CSS highlights via decorations (using DOM manipulation for simplicity)
  const applyHighlights = useCallback(
    (foundMatches: Match[], activeIndex: number) => {
      // Remove existing highlights
      clearHighlights()

      const editorDom = editor.view.dom as HTMLElement

      foundMatches.forEach((match, idx) => {
        try {
          const from = match.from
          const to = match.to

          // Use ProseMirror coordsAtPos for positioning info
          // For now, we use a simpler approach with decorations via custom class
        } catch {
          // Position may be invalid
        }
      })

      // Use editor's transaction to add search decorations
      // For a simpler approach, we add/remove a CSS class on the editor element
      editorDom.setAttribute('data-search-active', 'true')
      decorationsApplied.current = true
    },
    [editor]
  )

  const clearHighlights = useCallback(() => {
    const editorDom = editor.view.dom as HTMLElement
    editorDom.removeAttribute('data-search-active')
    decorationsApplied.current = false
  }, [editor])

  // Navigate to match
  const goToMatch = useCallback(
    (index: number) => {
      if (matches.length === 0) return
      const wrappedIndex = ((index % matches.length) + matches.length) % matches.length
      setCurrentMatchIndex(wrappedIndex)
      const match = matches[wrappedIndex]
      if (match) {
        editor
          .chain()
          .focus()
          .setTextSelection({ from: match.from, to: match.to })
          .scrollIntoView()
          .run()
      }
    },
    [editor, matches]
  )

  const handleNext = useCallback(() => {
    goToMatch(currentMatchIndex + 1)
  }, [currentMatchIndex, goToMatch])

  const handlePrevious = useCallback(() => {
    goToMatch(currentMatchIndex - 1)
  }, [currentMatchIndex, goToMatch])

  // Replace current match
  const handleReplace = useCallback(() => {
    if (matches.length === 0) return
    const match = matches[currentMatchIndex]
    if (!match) return

    editor
      .chain()
      .focus()
      .setTextSelection({ from: match.from, to: match.to })
      .insertContent(replaceTerm)
      .run()

    // Re-run find after replacement
    setTimeout(findMatches, 50)
  }, [editor, matches, currentMatchIndex, replaceTerm, findMatches])

  // Replace all
  const handleReplaceAll = useCallback(() => {
    if (matches.length === 0) return

    // Replace from last to first to preserve positions
    const sortedMatches = [...matches].sort((a, b) => b.from - a.from)

    editor.chain().focus().command(({ tr }) => {
      sortedMatches.forEach((match) => {
        tr.replaceWith(
          match.from,
          match.to,
          editor.state.schema.text(replaceTerm)
        )
      })
      return true
    }).run()

    setTimeout(findMatches, 50)
  }, [editor, matches, replaceTerm, findMatches])

  // Close handler
  const handleClose = useCallback(() => {
    clearHighlights()
    setSearchTerm('')
    setReplaceTerm('')
    setMatches([])
    onClose()
  }, [clearHighlights, onClose])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleNext()
      }
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault()
        handlePrevious()
      }
    },
    [handleClose, handleNext, handlePrevious]
  )

  if (!isOpen) return null

  return (
    <div className="find-replace" onKeyDown={handleKeyDown}>
      <div className="find-replace__row">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Find…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="find-replace__input"
          id="find-input"
        />
        <span className="find-replace__count">
          {matches.length > 0
            ? `${currentMatchIndex + 1} of ${matches.length}`
            : searchTerm
            ? 'No results'
            : ''}
        </span>
        <button
          className={`find-replace__toggle ${matchCase ? 'find-replace__toggle--active' : ''}`}
          onClick={() => setMatchCase(!matchCase)}
          title="Match Case"
          type="button"
        >
          <CaseSensitive size={16} />
        </button>
        <button
          className={`find-replace__toggle ${wholeWord ? 'find-replace__toggle--active' : ''}`}
          onClick={() => setWholeWord(!wholeWord)}
          title="Whole Word"
          type="button"
        >
          <WholeWord size={16} />
        </button>
        <button className="find-replace__nav" onClick={handlePrevious} title="Previous Match" type="button">
          <ChevronUp size={16} />
        </button>
        <button className="find-replace__nav" onClick={handleNext} title="Next Match" type="button">
          <ChevronDown size={16} />
        </button>
        <button
          className={`find-replace__toggle ${showReplace ? 'find-replace__toggle--active' : ''}`}
          onClick={() => setShowReplace(!showReplace)}
          title="Toggle Replace (Ctrl+H)"
          type="button"
        >
          <Replace size={16} />
        </button>
        <button className="find-replace__close" onClick={handleClose} title="Close (Esc)" type="button">
          <X size={16} />
        </button>
      </div>
      {showReplace && (
        <div className="find-replace__row">
          <input
            type="text"
            placeholder="Replace…"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            className="find-replace__input"
            id="replace-input"
          />
          <button className="find-replace__action" onClick={handleReplace} title="Replace" type="button">
            Replace
          </button>
          <button className="find-replace__action" onClick={handleReplaceAll} title="Replace All" type="button">
            All
          </button>
        </div>
      )}
    </div>
  )
}
