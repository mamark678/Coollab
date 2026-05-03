import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Download, FileText, FileCode, FileType, Copy, ChevronDown } from 'lucide-react'
import './ExportMenu.css'

interface ExportMenuProps {
  editor: Editor
}

// Simple HTML-to-Markdown converter (lightweight, no external dep needed at runtime)
function htmlToMarkdown(html: string): string {
  let md = html
  // Headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
  // Bold, Italic, Strikethrough
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
  md = md.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
  md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, '$1')
  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
  // Images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')
  // Code blocks
  md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n\n')
  // Inline code
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
  // Blockquote
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) => {
    return content
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1')
      .split('\n')
      .map((line: string) => `> ${line}`)
      .join('\n') + '\n\n'
  })
  // Horizontal rule
  md = md.replace(/<hr[^>]*\/?>/gi, '---\n\n')
  // List items
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
  // Paragraphs
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '')
  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n').trim()
  // Decode HTML entities
  md = md.replace(/&amp;/g, '&')
  md = md.replace(/&lt;/g, '<')
  md = md.replace(/&gt;/g, '>')
  md = md.replace(/&quot;/g, '"')
  md = md.replace(/&#39;/g, "'")

  return md
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const ExportMenu: React.FC<ExportMenuProps> = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getMarkdown = useCallback((): string => {
    const html = editor.getHTML()
    return htmlToMarkdown(html)
  }, [editor])

  const exportMarkdown = useCallback(() => {
    const md = getMarkdown()
    downloadFile(md, 'document.md', 'text/markdown')
    setIsOpen(false)
  }, [getMarkdown])

  const exportPlainText = useCallback(() => {
    const text = editor.getText()
    downloadFile(text, 'document.txt', 'text/plain')
    setIsOpen(false)
  }, [editor])

  const exportPdf = useCallback(() => {
    // Use browser print to PDF as fallback.
    // In Electron, we'd use webContents.printToPDF()
    window.print()
    setIsOpen(false)
  }, [])

  const copyAsMarkdown = useCallback(async () => {
    const md = getMarkdown()
    try {
      await navigator.clipboard.writeText(md)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = md
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setIsOpen(false)
  }, [getMarkdown])

  return (
    <div className="export-menu" ref={menuRef}>
      <button
        className="export-menu__trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Export"
        type="button"
        id="export-menu-btn"
      >
        <Download size={14} />
        <span>Export</span>
        <ChevronDown size={12} />
      </button>
      {isOpen && (
        <div className="export-menu__dropdown">
          <button
            className="export-menu__item"
            onClick={exportMarkdown}
            type="button"
          >
            <FileCode size={16} />
            <div className="export-menu__item-text">
              <span>Export as Markdown</span>
              <span className="export-menu__item-ext">.md</span>
            </div>
          </button>
          <button
            className="export-menu__item"
            onClick={exportPdf}
            type="button"
          >
            <FileText size={16} />
            <div className="export-menu__item-text">
              <span>Export as PDF</span>
              <span className="export-menu__item-ext">.pdf</span>
            </div>
          </button>
          <button
            className="export-menu__item"
            onClick={exportPlainText}
            type="button"
          >
            <FileType size={16} />
            <div className="export-menu__item-text">
              <span>Export as Plain Text</span>
              <span className="export-menu__item-ext">.txt</span>
            </div>
          </button>
          <div className="export-menu__divider" />
          <button
            className="export-menu__item"
            onClick={copyAsMarkdown}
            type="button"
          >
            <Copy size={16} />
            <div className="export-menu__item-text">
              <span>Copy as Markdown</span>
              <span className="export-menu__item-ext">Ctrl+Shift+C</span>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
