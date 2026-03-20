/**
 * Skill Matcher
 * 
 * Matches user requests to relevant skills from the Skills library.
 * Example: "I want to build a mobile app" → [mobile-app-development, react-native, flutter]
 */

const fs = require('fs');
const path = require('path');

// Auto-detect Skills directory (works from template/lib/ or lib/)
const SKILLS_DIR = (() => {
  const candidates = [
    path.join(__dirname, '..', 'Skills'),          // lib/../Skills
    path.join(__dirname, '..', '..', 'Skills'),     // template/lib/../../Skills
    path.join(process.cwd(), 'Skills'),             // cwd/Skills
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return path.join(__dirname, '..', 'Skills'); // fallback
})();
const SKILL_CATALOG_PATH = path.join(__dirname, '..', 'SKILL_CATALOG.md');

/**
 * Load all skills with their metadata
 */
function loadAllSkills() {
  const skills = [];
  
  if (!fs.existsSync(SKILLS_DIR)) {
    return skills;
  }
  
  const entries = fs.readdirSync(SKILLS_DIR);
  
  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'README.md') continue;
    
    const skillPath = path.join(SKILLS_DIR, entry);
    const stat = fs.statSync(skillPath);
    
    if (stat.isDirectory()) {
      const skill = loadSkillFromDir(entry, skillPath);
      if (skill) skills.push(skill);
    }
  }
  
  return skills;
}

/**
 * Load a single skill from its directory
 */
function loadSkillFromDir(id, dirPath) {
  const skillMdPath = path.join(dirPath, 'SKILL.md');
  
  if (!fs.existsSync(skillMdPath)) {
    return null;
  }
  
  const content = fs.readFileSync(skillMdPath, 'utf8');
  
  // Extract metadata from SKILL.md
  const name = extractField(content, 'name') || id;
  const description = extractField(content, 'description') || '';
  const category = extractField(content, 'category') || 'Other';
  const tags = extractTags(content);
  
  return {
    id,
    name,
    description,
    category,
    tags,
    path: dirPath,
    content: content.slice(0, 500) // First 500 chars for matching
  };
}

/**
 * Extract a field from SKILL.md frontmatter or content
 */
function extractField(content, field) {
  // Try frontmatter format: field: value
  const match = content.match(new RegExp(`${field}:\\s*(.+?)(?:\n|$)`, 'i'));
  if (match) return match[1].trim();
  
  // Try markdown format: **field:** value
  const boldMatch = content.match(new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+?)(?:\n|$)`, 'i'));
  if (boldMatch) return boldMatch[1].trim();
  
  return null;
}

/**
 * Return YAML frontmatter block if present.
 */
function extractFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  return match ? match[1] : '';
}

/**
 * Normalize raw tag text into stable searchable terms.
 */
function normalizeTag(tag) {
  return String(tag || '')
    .replace(/^['"]|['"]$/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 50);
}

/**
 * Extract tags/keywords from skill content
 */
function extractTags(content) {
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) return [];

  const tags = [];

  const pushToken = (token) => {
    const normalized = normalizeTag(token);
    if (normalized && normalized.length >= 2) {
      tags.push(normalized);
    }
  };

  const lines = frontmatter.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const keyMatch = line.match(/^\s*(tags|keywords)\s*:\s*(.*)$/i);
    if (!keyMatch) continue;

    const value = keyMatch[2].trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      value
        .slice(1, -1)
        .split(',')
        .forEach(pushToken);
      continue;
    }

    if (value) {
      pushToken(value);
      continue;
    }

    let j = i + 1;
    while (j < lines.length) {
      const listMatch = lines[j].match(/^\s*-\s+(.+)$/);
      if (!listMatch) break;
      pushToken(listMatch[1]);
      j++;
    }
    i = j - 1;
  }

  return [...new Set(tags)];
}

/**
 * Calculate match score between request and skill
 */
// Common request keywords mapped to skill-relevant terms
const KEYWORD_EXPANSIONS = {
  'mobile': ['ios', 'android', 'react-native', 'flutter', 'swift', 'kotlin', 'app'],
  'web': ['frontend', 'backend', 'react', 'vue', 'html', 'css', 'javascript', 'website'],
  'api': ['rest', 'graphql', 'endpoint', 'server', 'backend', 'express'],
  'bot': ['discord', 'telegram', 'slack', 'automation', 'chatbot'],
  'trading': ['crypto', 'finance', 'market', 'exchange', 'defi', 'bot'],
  'database': ['sql', 'postgres', 'mongo', 'prisma', 'schema', 'data'],
  'deploy': ['docker', 'aws', 'ci', 'cd', 'kubernetes', 'vercel', 'server'],
  'security': ['auth', 'pentest', 'vulnerability', 'encryption', 'hack'],
  'ai': ['machine-learning', 'model', 'openai', 'agent', 'llm', 'rag'],
  'design': ['ui', 'ux', 'figma', 'tailwind', 'css', 'responsive'],
  'test': ['jest', 'vitest', 'playwright', 'e2e', 'unit', 'tdd'],
  'seo': ['search', 'ranking', 'google', 'meta', 'sitemap'],
  'game': ['unity', 'godot', 'canvas', 'physics', 'sprite'],
  'scrape': ['crawl', 'playwright', 'puppeteer', 'browser', 'automation'],
  'email': ['smtp', 'newsletter', 'mailgun', 'sendgrid'],
  'payment': ['stripe', 'billing', 'subscription', 'checkout'],
  'auth': ['login', 'oauth', 'jwt', 'session', 'clerk', 'password'],
};

function calculateMatchScore(request, skill) {
  const requestLower = request.toLowerCase();
  // Expand request with synonyms
  let expandedWords = requestLower.split(/\s+/).filter(w => w.length > 2);
  const extraWords = [];
  for (const word of expandedWords) {
    if (KEYWORD_EXPANSIONS[word]) {
      extraWords.push(...KEYWORD_EXPANSIONS[word]);
    }
  }
  const requestWords = [...new Set([...expandedWords, ...extraWords])];
  
  let score = 0;
  
  // Check skill name match (also split by hyphens)
  const skillIdLower = skill.id.toLowerCase();
  const skillIdWords = skillIdLower.split('-');
  if (requestLower.includes(skillIdLower)) {
    score += 10;
  }
  // Partial id word match (e.g. "mobile" matches "mobile-app-builder")
  for (const word of requestWords) {
    if (skillIdWords.includes(word)) score += 4;
  }
  if (skill.name && requestLower.includes(skill.name.toLowerCase())) {
    score += 8;
  }
  
  // Check description match
  if (skill.description) {
    const descLower = skill.description.toLowerCase();
    for (const word of requestWords) {
      if (descLower.includes(word)) score += 2;
    }
  }
  
  // Check tags match
  for (const tag of skill.tags) {
    const tagLower = tag.toLowerCase();
    if (requestLower.includes(tagLower)) {
      score += 5;
    }
    // Partial tag match
    for (const word of requestWords) {
      if (tagLower.includes(word) || word.includes(tagLower)) {
        score += 2;
      }
    }
  }
  
  // Check category match
  if (skill.category) {
    const catLower = skill.category.toLowerCase();
    for (const word of requestWords) {
      if (catLower.includes(word)) score += 3;
    }
  }
  
  // Boost for exact phrase in content
  if (skill.content.toLowerCase().includes(requestLower)) {
    score += 3;
  }
  
  return score;
}

/**
 * Match a user request to relevant skills
 * @param {string} request - User's request (e.g., "I want to build a mobile app")
 * @param {Object} options
 * @param {number} options.limit - Max number of skills to return (default: 5)
 * @param {number} options.minScore - Minimum match score (default: 5)
 * @returns {Array} Matched skills with scores
 */
function matchSkills(request, options = {}) {
  const { limit = 5, minScore = 5 } = options;
  
  const skills = loadAllSkills();
  
  // Calculate scores for all skills
  const scoredSkills = skills.map(skill => ({
    ...skill,
    matchScore: calculateMatchScore(request, skill)
  }));
  
  // Filter and sort
  const matches = scoredSkills
    .filter(s => s.matchScore >= minScore)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
  
  return matches;
}

/**
 * Get skill recommendations for a task type
 */
function getSkillsForTaskType(taskType) {
  const taskKeywords = {
    'mobile-app': ['mobile', 'app', 'ios', 'android', 'react-native', 'flutter', 'swift', 'kotlin'],
    'web-app': ['web', 'frontend', 'backend', 'react', 'vue', 'angular', 'node', 'express'],
    'api': ['api', 'rest', 'graphql', 'backend', 'server'],
    'bot': ['bot', 'automation', 'discord', 'telegram', 'slack'],
    'data': ['data', 'analytics', 'database', 'sql', 'visualization'],
    'ai': ['ai', 'ml', 'model', 'training', 'inference', 'openai'],
    'security': ['security', 'auth', 'encryption', 'pentest', 'audit'],
    'devops': ['deploy', 'docker', 'ci/cd', 'aws', 'kubernetes', 'pipeline']
  };
  
  const keywords = taskKeywords[taskType.toLowerCase()] || [taskType];
  const request = keywords.join(' ');
  
  return matchSkills(request, { limit: 10, minScore: 3 });
}

/**
 * Format skill matches for display
 */
function formatSkillMatches(matches) {
  if (matches.length === 0) {
    return 'No matching skills found for this request.';
  }
  
  return matches.map((m, i) => 
    `${i + 1}. **${m.name}** (${m.category}) - Score: ${m.matchScore}\n` +
    `   ${m.description || 'No description'}\n` +
    `   Tags: ${m.tags.join(', ') || 'none'}`
  ).join('\n\n');
}

module.exports = {
  matchSkills,
  getSkillsForTaskType,
  formatSkillMatches,
  loadAllSkills
};

// CLI usage
if (require.main === module) {
  const request = process.argv[2] || 'I want to build a mobile app';
  console.log(`Matching skills for: "${request}"\n`);
  
  const matches = matchSkills(request, { limit: 5 });
  console.log(formatSkillMatches(matches));
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Built with \u2764\uFE0F  by Easy');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
