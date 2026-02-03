/**
 * Security Service
 * Implements data sanitization and safe loading to prevent app crashes.
 * Optimized with throttled persistence for ultra-fast processing.
 */

const saveTimeouts: Record<string, any> = {};

export const secureSave = (key: string, data: any): void => {
  // Throttled save to prevent UI lag during heavy data entry
  if (saveTimeouts[key]) clearTimeout(saveTimeouts[key]);
  
  saveTimeouts[key] = setTimeout(() => {
    try {
      const jsonString = JSON.stringify(data);
      localStorage.setItem(key, jsonString);
      delete saveTimeouts[key];
    } catch (e) {
      console.error("Storage save error", e);
    }
  }, 1000); // 1 second buffer for heavy sync
};

export const secureLoad = (key: string): any | null => {
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error("Storage load error", e);
    return null;
  }
};

/**
 * Sanitizes input strings to prevent HTML injection
 */
export const sanitize = (str: string): string => {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m] || m);
};
