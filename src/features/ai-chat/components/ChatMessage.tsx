import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, User, Sparkles } from 'lucide-react'
import { Message } from '../types'
import { WebSearchUI } from './WebSearchUI'

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ChatMessageProps {
  message: Message
  onImageClick: (url: string) => void
  onOpenPreview?: (schema?: any) => void
  showPreviewBtn?: boolean
}

function parseUiSchema(content: string) {
  if (!content || typeof content !== 'string') return null
  let trimmed = content.trim()
  if (trimmed.includes('```')) {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (match && match[1]) trimmed = match[1].trim()
  }
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    trimmed = trimmed.substring(firstBrace, lastBrace + 1)
  }
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && parsed.root && parsed.elements) {
      return parsed
    }
  } catch {
    return null
  }
  return null
}

export function ChatMessage({
  message,
  onImageClick,
  onOpenPreview,
  showPreviewBtn = false,
}: ChatMessageProps) {
  const isUser = message.role === 'user'
  const detectedSchema = !isUser ? parseUiSchema(message.content) : null

  return (
    <div className='flex w-full gap-3 flex-row justify-start'>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full border shadow-sm ${
          isUser
            ? 'bg-primary text-primary-foreground border-primary/20'
            : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30'
        }`}
      >
        {isUser ? (
          <User className='w-4 h-4' />
        ) : (
          <Bot className='w-4 h-4' />
        )}
      </div>

      {/* Bubble Container */}
      <div className='flex flex-col max-w-[85%] sm:max-w-[78%] gap-1 items-start'>
        {/* Author Label */}
        <span className='text-[10px] font-bold text-muted-foreground/80 px-1 text-left'>
          {isUser ? 'You' : 'AI Assistant'}
        </span>

        {/* Text/Markdown Content */}
        <div className='px-1 py-0.5 text-sm sm:text-base text-foreground w-full'>
          {isUser ? (
            <div className='whitespace-pre-wrap leading-relaxed'>{message.content}</div>
          ) : detectedSchema ? (
            <div className='flex flex-col gap-3 rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3.5 dark:border-indigo-900/50 dark:bg-indigo-950/20 my-1'>
              <div className='flex items-center gap-2.5'>
                <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'>
                  <Sparkles className='h-4 w-4' />
                </span>
                <div>
                  <p className='text-xs font-semibold text-foreground leading-tight'>
                    🎨 UI Schema Generated Successfully
                  </p>
                  <p className='text-[11px] text-muted-foreground leading-tight mt-0.5'>
                    Live component preview ready
                  </p>
                </div>
              </div>
              {onOpenPreview && (
                <button
                  type='button'
                  onClick={() => onOpenPreview(detectedSchema)}
                  className='flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors cursor-pointer w-fit'
                >
                  <Sparkles className='h-3.5 w-3.5' />
                  <span>Open Live UI Preview</span>
                </button>
              )}
            </div>
          ) : (
            <div className='prose prose-sm dark:prose-invert max-w-none leading-relaxed break-words prose-p:leading-relaxed prose-pre:bg-muted/80 prose-pre:border prose-pre:border-border/50 prose-pre:rounded-xl prose-code:text-primary dark:prose-code:text-indigo-400 prose-code:font-mono prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none'>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Quick Generative UI Open Action Button for success message */}
          {!isUser && !detectedSchema && showPreviewBtn && onOpenPreview && (
            <div className='mt-3 flex justify-start'>
              <button
                type='button'
                onClick={() => onOpenPreview()}
                className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:shadow-sm transition-all duration-200 cursor-pointer'
              >
                <Sparkles className='h-3.5 w-3.5' />
                <span>Open Preview Panel</span>
              </button>
            </div>
          )}
        </div>

        {/* Resources attached to assistant message */}
        {!isUser && (message.sources?.length || message.images?.length) && (
          <WebSearchUI
            sources={message.sources || []}
            images={message.images || []}
            onImageClick={onImageClick}
          />
        )}
      </div>
    </div>
  )
}
