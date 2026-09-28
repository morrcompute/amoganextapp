import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'

export const UI_RENDER_SYSTEM_PROMPT = `
You are a UI Schema Generator. Your task is to generate a valid UI schema in JSON format based on the user's request.
You MUST output ONLY valid JSON. Do not write any explanations, do not wrap it in markdown code blocks, do not write anything else.

If the user provides an OCR text extraction payload (containing fields like invoice, date, total, business details, customer name, lines, etc.), you MUST analyze the text, extract the key values, and construct an editable Form containing corresponding inputs (e.g. Input with defaultValue, Textarea) so the user can verify, edit, and submit the extracted details.

The schema MUST follow this exact TypeScript interface:
interface UiSchema {
  root: string; // The ID of the root element (usually "root")
  elements: {
    [elementId: string]: {
      type: 'Stack' | 'Card' | 'Form' | 'Input' | 'Textarea' | 'Button' | 'Checkbox' | 'Badge' | 'Alert' | 'Separator' | 'Progress' | 'Heading' | 'Text' | 'Price' | 'FeatureList' | 'Tabs' | 'Calendar' | 'Switch' | 'RadioGroup' | 'PremiumStats';
      props?: Record<string, any>;
      children?: string[]; // Array of element IDs that are children of this element
    }
  }
}

Common Components & Props:
1. Stack: props: { direction: 'vertical' | 'horizontal', gap: 'xs' | 'sm' | 'md' | 'lg' | 'xl', align: 'start' | 'center' | 'end' }
2. Form: props: { onSubmit?: string }
3. Card: props: { title?: string, description?: string, className?: string, maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full', centered?: boolean }
4. Input: props: { label?: string, name?: string, placeholder?: string, required?: boolean, type?: string, defaultValue?: any }
5. Textarea: props: { label?: string, name?: string, placeholder?: string, required?: boolean, defaultValue?: any }
6. Button: props: { label: string, type?: 'button' | 'submit', variant?: 'default' | 'outline' | 'destructive' | 'ghost', className?: string }
7. Heading: props: { level: '1' | '2' | '3' | '4' | '5' | '6', children: string }
8. Text: props: { children: string, size?: 'sm' | 'base' | 'lg' | 'xl', className?: string }
`

export async function handleChatPost(request: NextRequest) {
  try {
    const { message, model, tool, apiKey } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const openRouterApiKey = apiKey?.trim() || process.env.OPENROUTER_API_KEY
    if (!openRouterApiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key is not configured. Please add your key in App Settings -> AI API.' },
        { status: 500 }
      )
    }

    const openrouter = createOpenRouter({
      apiKey: openRouterApiKey,
    })

    const isUiRender = tool === 'ui-render'

    const { text } = await generateText({
      model: openrouter.chat(model || 'google/gemini-2.5-flash'),
      system: isUiRender ? UI_RENDER_SYSTEM_PROMPT : undefined,
      prompt: message,
    })

    return NextResponse.json({ text })
  } catch (error: any) {
    console.error('Error in handleChatPost:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to generate response' },
      { status: 500 }
    )
  }
}
