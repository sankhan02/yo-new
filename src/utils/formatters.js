/**
 * Format a number with commas as thousands separators
 * @param {number} num - The number to format
 * @param {number} maxDecimals - Maximum number of decimal places to show
 * @returns {string} Formatted number string
 */
export function formatNumber(num, maxDecimals = 2) {
  if (num === null || num === undefined) return '0';
  
  // Handle non-numeric inputs
  if (typeof num !== 'number') {
    num = parseFloat(num);
    if (isNaN(num)) return '0';
  }
  
  // Format with appropriate decimal places
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: 0
  }).format(num);
}

/**
 * Format currency values
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency = 'USD') {
  if (amount === null || amount === undefined) return '$0';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Format a time duration in milliseconds to a human-readable string
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted time string
 */
export function formatDuration(ms) {
  if (!ms) return '0s';
  
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && days === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

/**
 * Truncate wallet address or other long string
 * @param {string} str - String to truncate
 * @param {number} startChars - Number of characters to show at the start
 * @param {number} endChars - Number of characters to show at the end
 * @returns {string} Truncated string
 */
export function truncateAddress(str, startChars = 4, endChars = 4) {
  if (!str) return '';
  if (str.length <= startChars + endChars) return str;
  
  return `${str.substring(0, startChars)}...${str.substring(str.length - endChars)}`;
}

/**
 * Format date to a human-readable string
 * @param {Date|number|string} date - Date to format
 * @param {boolean} includeTime - Whether to include time in the output
 * @returns {string} Formatted date string
 */
export function formatDate(date, includeTime = false) {
  if (!date) return '';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
  };
  
  return dateObj.toLocaleDateString('en-US', options);
} 