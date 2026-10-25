/**
 * Format timestamps according to Section 7.1 specification:
 * - If today: "Today, 10:42 PM"
 * - If yesterday: "Yesterday, 4:15 PM"
 * - Older dates: "Oct 21, 2026"
 */
export function formatMessageTimestamp(dateInput) {
  if (!dateInput) return 'Just now';

  const date = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput)
    : dateInput;

  if (isNaN(date.getTime())) {
    return 'Just now';
  }

  const now = new Date();
  
  // Format time portion: "10:42 PM"
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Calculate day difference by calendar day
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfGiven = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfGiven) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today, ${timeStr}`;
  } else if (diffDays === 1) {
    return `Yesterday, ${timeStr}`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
