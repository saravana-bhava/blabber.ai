/**
 * Prepare message text for display in DMs (preserves line breaks).
 * Handles literal "\n" sequences from AI / upstream APIs as well as real newlines.
 */
export function formatMessageContentForDisplay(content: string): string {
  if (!content) return content;

  let text = content;
  if (text.startsWith('"') && text.endsWith('"')) {
    try {
      text = JSON.parse(text) as string;
    } catch {
      text = text.slice(1, -1);
    }
  }

  return text.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
}

/**
 * Single-line preview for conversation list (collapses line breaks).
 */
export function formatMessagePreview(content: string): string {
  return formatMessageContentForDisplay(content).replace(/\s+/g, ' ').trim();
}
