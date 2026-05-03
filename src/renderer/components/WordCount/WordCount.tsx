import React, { useCallback, useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { X } from 'lucide-react'
import './WordCount.css'

interface WordCountProps {
  editor: Editor
}

interface DocStats {
  words: number
  characters: number
  charactersNoSpaces: number
  readingTime: number
  lines: number
  paragraphs: number
  sentences: number
  avgWordLength: number
}

function computeStats(text: string, doc: ReturnType<Editor['state']['doc']['toJSON']>): DocStats {
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const wordCount = words.length
  const characters = text.length
  const charactersNoSpaces = text.replace(/\s/g, '').length
  const readingTime = Math.max(1, Math.round(wordCount / 200))
  const lines = text.split('\n').length
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length
  const totalWordChars = words.reduce((sum, w) => sum + w.length, 0)
  const avgWordLength = wordCount > 0 ? Math.round((totalWordChars / wordCount) * 10) / 10 : 0

  return {
    words: wordCount,
    characters,
    charactersNoSpaces,
    readingTime,
    lines,
    paragraphs,
    sentences,
    avgWordLength,
  }
}

export const WordCountBar: React.FC<WordCountProps> = ({ editor }) => {
  const [stats, setStats] = useState<DocStats>({
    words: 0,
    characters: 0,
    charactersNoSpaces: 0,
    readingTime: 0,
    lines: 0,
    paragraphs: 0,
    sentences: 0,
    avgWordLength: 0,
  })
  const [selectionStats, setSelectionStats] = useState<DocStats | null>(null)
  const [showModal, setShowModal] = useState(false)

  const updateStats = useCallback(() => {
    const text = editor.getText()
    const newStats = computeStats(text, editor.state.doc.toJSON())
    setStats(newStats)

    // Check for selection
    const { from, to } = editor.state.selection
    if (from !== to) {
      const selectedText = editor.state.doc.textBetween(from, to, '\n')
      const selStats = computeStats(selectedText, editor.state.doc.toJSON())
      setSelectionStats(selStats)
    } else {
      setSelectionStats(null)
    }
  }, [editor])

  useEffect(() => {
    updateStats()
    editor.on('update', updateStats)
    editor.on('selectionUpdate', updateStats)
    return () => {
      editor.off('update', updateStats)
      editor.off('selectionUpdate', updateStats)
    }
  }, [editor, updateStats])

  const displayStats = selectionStats ?? stats
  const isSelection = selectionStats !== null

  return (
    <>
      <div className="word-count-bar" id="word-count-bar">
        <button
          className="word-count-bar__item word-count-bar__clickable"
          onClick={() => setShowModal(true)}
          title="Click for detailed stats"
          type="button"
        >
          {isSelection ? `${displayStats.words} words selected` : `${displayStats.words} words`}
        </button>
        <span className="word-count-bar__item">
          {displayStats.characters} chars
        </span>
        <span className="word-count-bar__item">
          {displayStats.charactersNoSpaces} chars (no spaces)
        </span>
        <span className="word-count-bar__item">
          ~{displayStats.readingTime} min read
        </span>
        <span className="word-count-bar__item">
          {displayStats.lines} lines
        </span>
      </div>

      {showModal && (
        <div className="word-count-modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="word-count-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="word-count-modal__header">
              <h3>Document Statistics</h3>
              <button
                className="word-count-modal__close"
                onClick={() => setShowModal(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
            <div className="word-count-modal__body">
              <div className="word-count-modal__row">
                <span>Words</span>
                <span>{stats.words}</span>
              </div>
              <div className="word-count-modal__row">
                <span>Characters</span>
                <span>{stats.characters}</span>
              </div>
              <div className="word-count-modal__row">
                <span>Characters (no spaces)</span>
                <span>{stats.charactersNoSpaces}</span>
              </div>
              <div className="word-count-modal__row">
                <span>Paragraphs</span>
                <span>{stats.paragraphs}</span>
              </div>
              <div className="word-count-modal__row">
                <span>Sentences</span>
                <span>{stats.sentences}</span>
              </div>
              <div className="word-count-modal__row">
                <span>Lines</span>
                <span>{stats.lines}</span>
              </div>
              <div className="word-count-modal__row">
                <span>Average Word Length</span>
                <span>{stats.avgWordLength}</span>
              </div>
              <div className="word-count-modal__row word-count-modal__row--highlight">
                <span>Reading Time</span>
                <span>~{stats.readingTime} min</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
