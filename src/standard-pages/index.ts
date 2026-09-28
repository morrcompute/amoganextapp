/**
 * Amoga Design System — Standard Pages Barrel Export
 *
 * Exposes the 6 core standard pages for use across the platform and consuming applications:
 * 1. Message / ChatTemplate
 * 2. AI Chat
 * 3. AI Search
 * 4. Vouchers & Invoice Maker
 * 5. Link Maker / Bio Links
 * 6. Map Templates & Location Sharing
 */

export * from './message'
export * from './ai-chat'
export * from './ai-search'
export * from './vouchers'
export * from './link-maker'
export * from './map'
export { default as EmailSettingsFeature } from '@/features/email-settings'
