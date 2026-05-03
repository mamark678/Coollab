/**
 * Consistent hashing for string to numeric ID
 */
export function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Generate a consistent HSL color from a project ID
 */
export function getProjectColor(projectId: string): string {
  const hue = hashCode(projectId) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

/**
 * Generate a slightly dimmer version of the project color for text
 */
export function getDimmerProjectColor(projectId: string): string {
  const hue = hashCode(projectId) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}

/**
 * Clean preview text by stripping markdown and other symbols
 */
export function cleanPreviewText(text: string): string {
  if (!text) return '';
  return text
    .replace(/^#{1,6}\s/gm, '')         // Markdown headings
    .replace(/\*{1,3}|_{1,3}/g, '')     // Bold/italic
    .replace(/\[\[(.+?)\]\]/g, '$1')    // WikiLinks
    .replace(/`{1,3}[^`]*`{1,3}/g, '')  // Code blocks
    .replace(/https?:\/\/\S+/g, '')     // URLs
    .replace(/\s+/g, ' ')              // Extra whitespace
    .trim();
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Format timestamp into relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(timestamp).toLocaleDateString();
}
