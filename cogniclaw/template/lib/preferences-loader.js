/**
 * Preferences Loader
 * Loads Easy's preferences from Mission Control dashboard
 */

const fs = require('fs');
const path = require('path');

const PREFS_FILE = path.join(__dirname, '..', 'mission-control-v5', 'dist', 'config', 'preferences.json');
const NOTIFICATION_FILE = path.join(__dirname, '..', 'memory', 'preferences-update.json');

let cachedPrefs = null;
let lastLoadTime = 0;
const CACHE_TTL = 60000; // 1 minute cache

function loadPreferences() {
  // Check if there's a pending update notification
  let hasUpdate = false;
  if (fs.existsSync(NOTIFICATION_FILE)) {
    try {
      const notification = JSON.parse(fs.readFileSync(NOTIFICATION_FILE, 'utf8'));
      if (notification.preferencesUpdated) {
        hasUpdate = true;
        // Clear the notification after reading
        fs.unlinkSync(NOTIFICATION_FILE);
      }
    } catch (e) {
      // Ignore errors
    }
  }

  // Use cache if fresh and no update pending
  const now = Date.now();
  if (cachedPrefs && !hasUpdate && (now - lastLoadTime) < CACHE_TTL) {
    return cachedPrefs;
  }

  // Load fresh from disk
  if (!fs.existsSync(PREFS_FILE)) {
    return null;
  }

  try {
    cachedPrefs = JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8'));
    lastLoadTime = now;
    return cachedPrefs;
  } catch (error) {
    console.error('Failed to load preferences:', error);
    return cachedPrefs; // Return stale cache on error
  }
}

function getActiveRules() {
  const prefs = loadPreferences();
  if (!prefs || !prefs.preferences) return [];
  
  return prefs.preferences
    .filter(p => p.value === true)
    .map(p => ({
      rule: p.rule,
      category: p.category,
      context: p.context,
      example: p.example
    }));
}

function formatAccordingToPrefs(text) {
  const prefs = loadPreferences();
  if (!prefs) return text;

  let formatted = text;

  // Apply formatting rules
  const rules = prefs.preferences || [];
  
  // NO EM DASHES
  if (rules.find(r => r.id === 'fmt-no-emdash')?.value) {
    formatted = formatted.replace(/—/g, ': ').replace(/--/g, ': ');
  }

  // K/M/B for numbers (basic implementation)
  if (rules.find(r => r.id === 'fmt-numbers')?.value) {
    formatted = formatted.replace(/(\d{1,3}),(\d{3}),(\d{3})/g, '$1.$2B');
    formatted = formatted.replace(/(\d{1,3}),(\d{3})/g, '$1.$2K');
  }

  return formatted;
}

module.exports = {
  loadPreferences,
  getActiveRules,
  formatAccordingToPrefs
};
