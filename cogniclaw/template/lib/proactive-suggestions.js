/**
 * Proactive Suggestions Module
 * 
 * Analyzes daily/weekly patterns to suggest tasks during heartbeats.
 * Learns from user behavior and generates contextual suggestions.
 */

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const SUGGESTIONS_FILE = path.join(MEMORY_DIR, 'suggestions.md');
const EXPERIENCES_DIR = path.join(MEMORY_DIR, 'experiences');

/**
 * Task pattern definitions
 */
const TASK_PATTERNS = {
  daily: {
    'morning-routine': {
      keywords: ['check email', 'calendar', 'morning', 'start day'],
      timeWindow: { start: 7, end: 10 },
      description: 'Morning routine: Check email and calendar'
    },
    'evening-wrap': {
      keywords: ['summary', 'wrap up', 'end day', 'tomorrow'],
      timeWindow: { start: 17, end: 22 },
      description: 'Evening wrap-up: Summarize day and plan tomorrow'
    }
  },
  weekly: {
    'weekly-review': {
      keywords: ['weekly review', 'week summary', 'sunday'],
      dayOfWeek: 0, // Sunday
      description: 'Weekly review and planning'
    },
    'planning': {
      keywords: ['plan', 'schedule', 'week ahead', 'monday'],
      dayOfWeek: 1, // Monday
      description: 'Weekly planning and goal setting'
    }
  },
  recurring: {
    'content-creation': {
      keywords: ['write', 'blog', 'post', 'content', 'article'],
      frequency: 'weekly',
      description: 'Content creation task'
    },
    'code-review': {
      keywords: ['review', 'code', 'pr', 'pull request'],
      frequency: 'daily',
      description: 'Code review pending items'
    },
    'learning': {
      keywords: ['learn', 'study', 'read', 'tutorial', 'course'],
      frequency: 'weekly',
      description: 'Learning and skill development'
    }
  }
};

/**
 * Parse daily memory files to extract task patterns
 * @param {number} daysBack - How many days to analyze
 * @returns {Object} Pattern analysis results
 */
function analyzeTaskPatterns(daysBack = 14) {
  const patterns = {
    dailyTasks: {},
    hourlyDistribution: new Array(24).fill(0),
    dayOfWeekDistribution: new Array(7).fill(0),
    commonKeywords: {},
    taskTypes: {}
  };
  
  const today = new Date();
  
  for (let i = 0; i < daysBack; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const filePath = path.join(MEMORY_DIR, `${dateStr}.md`);
    
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract tasks (lines starting with - [ ] or - [x])
      const taskMatches = content.matchAll(/^- \[([ x])\] (.+)$/gm);
      for (const match of taskMatches) {
        const isDone = match[1] === 'x';
        const taskText = match[2].toLowerCase();
        
        // Track task types
        for (const [type, config] of Object.entries(TASK_PATTERNS.recurring)) {
          if (config.keywords.some(kw => taskText.includes(kw))) {
            if (!patterns.taskTypes[type]) {
              patterns.taskTypes[type] = { count: 0, completed: 0 };
            }
            patterns.taskTypes[type].count++;
            if (isDone) patterns.taskTypes[type].completed++;
          }
        }
        
        // Track keywords
        const words = taskText.split(/\s+/);
        for (const word of words) {
          if (word.length > 4) {
            patterns.commonKeywords[word] = (patterns.commonKeywords[word] || 0) + 1;
          }
        }
      }
      
      // Track day of week activity
      patterns.dayOfWeekDistribution[date.getDay()]++;
    }
  }
  
  return patterns;
}

/**
 * Analyze experience logs for patterns
 * @param {number} daysBack - How many days to analyze
 * @returns {Object} Experience patterns
 */
function analyzeExperiencePatterns(daysBack = 7) {
  const patterns = {
    commonTasks: {},
    peakHours: new Array(24).fill(0),
    successRates: {},
    preferredApproaches: {}
  };
  
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  
  if (!fs.existsSync(EXPERIENCES_DIR)) return patterns;
  
  const files = fs.readdirSync(EXPERIENCES_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .sort()
    .reverse();
  
  for (const file of files) {
    const fileDate = file.replace('.jsonl', '');
    if (new Date(fileDate) < cutoff) break;
    
    const content = fs.readFileSync(path.join(EXPERIENCES_DIR, file), 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    for (const line of lines) {
      try {
        const exp = JSON.parse(line);
        
        // Track task types
        const taskType = exp.taskType || 'unknown';
        if (!patterns.commonTasks[taskType]) {
          patterns.commonTasks[taskType] = { count: 0, success: 0 };
        }
        patterns.commonTasks[taskType].count++;
        if (exp.outcome === 'success') {
          patterns.commonTasks[taskType].success++;
        }
        
        // Track preferred approaches
        if (exp.approach) {
          patterns.preferredApproaches[exp.approach] = 
            (patterns.preferredApproaches[exp.approach] || 0) + 1;
        }
        
        // Track hour of day
        if (exp.timestamp) {
          const hour = new Date(exp.timestamp).getHours();
          patterns.peakHours[hour]++;
        }
      } catch (e) {
        // Skip malformed lines
      }
    }
  }
  
  // Calculate success rates
  for (const [task, data] of Object.entries(patterns.commonTasks)) {
    patterns.successRates[task] = data.count > 0 
      ? (data.success / data.count * 100).toFixed(1)
      : 0;
  }
  
  return patterns;
}

/**
 * Generate suggestions based on patterns
 * @returns {Array<Object>} Generated suggestions
 */
function generateSuggestions() {
  const suggestions = [];
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  
  const taskPatterns = analyzeTaskPatterns(14);
  const expPatterns = analyzeExperiencePatterns(7);
  
  // Check for missed recurring tasks
  for (const [type, config] of Object.entries(TASK_PATTERNS.recurring)) {
    const pattern = taskPatterns.taskTypes[type];
    if (pattern) {
      const completionRate = pattern.count > 0 
        ? pattern.completed / pattern.count 
        : 0;
      
      if (completionRate < 0.7) {
        suggestions.push({
          type: 'recurring',
          priority: 'medium',
          title: `Catch up on ${config.description}`,
          reason: `Completion rate is ${(completionRate * 100).toFixed(0)}% (target: 70%+)`,
          action: `Review and complete pending ${type} tasks`
        });
      }
    }
  }
  
  // Time-based suggestions
  if (hour >= 7 && hour <= 10) {
    suggestions.push({
      type: 'time-based',
      priority: 'high',
      title: 'Morning routine',
      reason: 'Optimal time for daily planning',
      action: 'Check email, calendar, and set daily priorities'
    });
  }
  
  if (hour >= 17 && hour <= 20) {
    suggestions.push({
      type: 'time-based',
      priority: 'medium',
      title: 'End-of-day wrap up',
      reason: 'Good time to summarize and plan tomorrow',
      action: 'Review completed tasks and create tomorrow\'s list'
    });
  }
  
  // Day-of-week suggestions
  if (dayOfWeek === 0) { // Sunday
    suggestions.push({
      type: 'weekly',
      priority: 'high',
      title: 'Weekly review',
      reason: 'Sunday is ideal for weekly reflection',
      action: 'Review the week, update MEMORY.md, plan next week'
    });
  }
  
  if (dayOfWeek === 1) { // Monday
    suggestions.push({
      type: 'weekly',
      priority: 'high',
      title: 'Weekly planning',
      reason: 'Start the week with clear goals',
      action: 'Set weekly objectives and prioritize tasks'
    });
  }
  
  // Experience-based suggestions
  const topTasks = Object.entries(expPatterns.commonTasks)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3);
  
  for (const [taskType, data] of topTasks) {
    const successRate = expPatterns.successRates[taskType];
    if (successRate && successRate < 80) {
      suggestions.push({
        type: 'improvement',
        priority: 'medium',
        title: `Improve ${taskType} workflow`,
        reason: `Success rate is ${successRate}% (target: 80%+)`,
        action: 'Review recent attempts and identify improvement areas'
      });
    }
  }
  
  // Pending tasks check
  const pendingTasks = getPendingTasks();
  if (pendingTasks.length > 0) {
    const urgentTasks = pendingTasks.filter(t => t.urgent);
    if (urgentTasks.length > 0) {
      suggestions.push({
        type: 'pending',
        priority: 'high',
        title: `Complete ${urgentTasks.length} urgent pending tasks`,
        reason: 'Tasks marked as urgent need attention',
        action: urgentTasks.slice(0, 3).map(t => `- ${t.text}`).join('\n')
      });
    } else if (pendingTasks.length > 5) {
      suggestions.push({
        type: 'pending',
        priority: 'medium',
        title: `Clear ${pendingTasks.length} pending tasks`,
        reason: 'Backlog is building up',
        action: 'Spend 30 minutes clearing pending items'
      });
    }
  }
  
  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return suggestions.slice(0, 5); // Top 5 suggestions
}

/**
 * Get pending tasks from recent memory files
 * @returns {Array<{text: string, urgent: boolean}>} Pending tasks
 */
function getPendingTasks() {
  const pending = [];
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const filePath = path.join(MEMORY_DIR, `${dateStr}.md`);
    
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const pendingMatches = content.matchAll(/^- \[ \] (.+)$/gm);
      
      for (const match of pendingMatches) {
        const taskText = match[1];
        const isUrgent = /urgent|asap|important|critical/i.test(taskText);
        pending.push({
          text: taskText,
          urgent: isUrgent,
          date: dateStr
        });
      }
    }
  }
  
  return pending;
}

/**
 * Save suggestions to file
 * @param {Array<Object>} suggestions - Suggestions to save
 */
function saveSuggestions(suggestions) {
  const now = new Date().toISOString();

  let currentSection = `# Proactive Suggestions\n\n`;
  currentSection += `*Generated: ${now}*\n\n`;

  if (suggestions.length === 0) {
    currentSection += 'No suggestions at this time. You\'re all caught up! 🎉\n';
  } else {
    currentSection += `## Today's Suggestions (${suggestions.length})\n\n`;

    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      const priorityEmoji = s.priority === 'high' ? '🔴' : s.priority === 'medium' ? '🟡' : '🟢';

      currentSection += `### ${i + 1}. ${priorityEmoji} ${s.title}\n`;
      currentSection += `- **Type:** ${s.type}\n`;
      currentSection += `- **Priority:** ${s.priority}\n`;
      currentSection += `- **Why:** ${s.reason}\n`;
      currentSection += `- **Action:** ${s.action}\n\n`;
    }
  }

  const normalizeSection = (section) => section
    .replace(/\*Generated:.*\*\n\n?/g, '')
    .trim();

  const maxSections = 20;
  let sections = [currentSection.trim()];

  if (fs.existsSync(SUGGESTIONS_FILE)) {
    const existing = fs.readFileSync(SUGGESTIONS_FILE, 'utf8');
    const historicalSections = existing.match(/# Proactive Suggestions[\s\S]*?(?=\n---\n|$)/g) || [];

    if (historicalSections.length > 0) {
      const latestExisting = historicalSections[0].trim();
      if (normalizeSection(latestExisting) === normalizeSection(currentSection)) {
        sections = [currentSection.trim(), ...historicalSections.slice(1).map((s) => s.trim())];
      } else {
        sections = [currentSection.trim(), ...historicalSections.map((s) => s.trim())];
      }
    }
  }

  const content = sections.slice(0, maxSections).join('\n\n---\n\n') + '\n';
  fs.writeFileSync(SUGGESTIONS_FILE, content);
}

/**
 * Run during heartbeat to generate and save suggestions
 * @returns {Array<Object>} Generated suggestions
 */
function runHeartbeatSuggestions() {
  const suggestions = generateSuggestions();
  saveSuggestions(suggestions);
  return suggestions;
}

/**
 * Get current suggestions without regenerating
 * @returns {Array<Object>} Current suggestions
 */
function getCurrentSuggestions() {
  if (!fs.existsSync(SUGGESTIONS_FILE)) {
    return runHeartbeatSuggestions();
  }
  
  // Parse current suggestions from file
  const content = fs.readFileSync(SUGGESTIONS_FILE, 'utf8');
  const suggestions = [];
  
  const suggestionMatches = content.matchAll(/### \d+\. .+?\n- \*\*Type:\*\* (.+?)\n- \*\*Priority:\*\* (.+?)\n- \*\*Why:\*\* (.+?)\n- \*\*Action:\*\* (.+?)(?:\n\n|$)/g);
  
  for (const match of suggestionMatches) {
    suggestions.push({
      type: match[1],
      priority: match[2],
      reason: match[3],
      action: match[4]
    });
  }
  
  return suggestions;
}

/**
 * Format suggestions for display
 * @param {Array<Object>} suggestions - Suggestions to format
 * @returns {string} Formatted string
 */
function formatSuggestions(suggestions) {
  if (!suggestions.length) {
    return 'No suggestions at this time. You\'re all caught up! 🎉';
  }
  
  let output = '## 🤔 Suggestions for You\n\n';
  
  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    const priorityEmoji = s.priority === 'high' ? '🔴' : s.priority === 'medium' ? '🟡' : '🟢';
    
    output += `${i + 1}. ${priorityEmoji} **${s.title}**\n`;
    output += `   ${s.reason}\n`;
    output += `   💡 *${s.action}*\n\n`;
  }
  
  return output;
}

module.exports = {
  analyzeTaskPatterns,
  analyzeExperiencePatterns,
  generateSuggestions,
  saveSuggestions,
  runHeartbeatSuggestions,
  getCurrentSuggestions,
  formatSuggestions,
  getPendingTasks,
  TASK_PATTERNS
};
