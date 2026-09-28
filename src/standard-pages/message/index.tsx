'use client'

import React from 'react'
import MessageFeature from '@/features/Message'
import { ChatTemplate } from '@/features/chattemplate'

export function MessagePage() {
  return <MessageFeature />
}

export function ChatTemplatePage() {
  return <ChatTemplate />
}

export { MessageFeature, ChatTemplate }
export default MessagePage
