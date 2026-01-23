/**
 * Prompt for generating conversation titles
 */
export function getConversationTitlePrompt(message: string): string {
  return `Generate a short title (max 50 characters) for this conversation: "${message}"`
}
