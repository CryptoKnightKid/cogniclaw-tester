/**
 * Learning Engine - Pattern Analyzer
 * 
 * Reads experience logs and produces insights using:
 * - Recency-weighted aggregation (exponential decay)
 * - Pattern recognition across task types and approaches
 * - Weekly summary generation
 * 
 * Data structures per ARCHITECTURE.md section 3.1
 */

const fs = require('fs');
const path = require('path');

const EXPERIENCES_DIR = path.join(__dirname, '..', 'memory', 'experiences');
const WEEKLY_REVIEWS_DIR = path.join(__dirname, '..', 'memory', 'weekly-reviews');

// Default half-life in days for recency weighting
const DEFAULT_HALF_LIFE = 7;

// Ensure directories exist
if (!fs.existsSync(EXPERIENCES_DIR)) {
  fs.mkdirSync(EXPERIENCES_DIR, { recursive: true });
}
if (!fs.existsSync(WEEKLY_REVIEWS_DIR)) {
  fs.mkdirSync(WEEKLY_REVIEWS_DIR, { recursive: true });
}

/**
 * Calculate recency weight using exponential decay
 * weight = exp(-age_days / half_life)
 * 
 * @param {string} timestamp - ISO timestamp of the experience
 * @param {number} halfLife - Half-life in days (default: 7)
 * @returns {number} Weight between 0 and 1
 */
function calculateRecencyWeight(timestamp, halfLife = DEFAULT_HALF_LIFE) {
  const experienceDate = new Date(timestamp);
  const now = new Date();
  const ageMs = now - experienceDate;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.exp(-ageDays / halfLife);
}

/**
 * Load all experiences from memory/experiences/*.jsonl
 * @param {number} maxAgeDays - Maximum age in days (null for all)
 * @returns {Array} Array of experience objects
 */
function loadExperiences(maxAgeDays = null) {
  const experiences = [];
  
  if (!fs.existsSync(EXPERIENCES_DIR)) {
    return experiences;
  }
  
  const files = fs.readdirSync(EXPERIENCES_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .sort();
  
  const cutoffDate = maxAgeDays 
    ? new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
    : null;
  
  for (const file of files) {
    // Check if file is within age limit based on filename (YYYY-MM-DD.jsonl)
    if (cutoffDate) {
      const fileDateStr = file.replace('.jsonl', '');
      const fileDate = new Date(fileDateStr);
      if (fileDate < cutoffDate) continue;
    }
    
    const filePath = path.join(EXPERIENCES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    for (const line of lines) {
      try {
        const exp = JSON.parse(line);
        // Normalize field names (handle both snake_case and camelCase)
        exp.task_type = exp.task_type || exp.taskType;
        exp.approach_id = exp.approach_id || exp.approach;
        experiences.push(exp);
      } catch (e) {
        // Skip malformed lines
      }
    }
  }
  
  return experiences;
}

/**
 * Analyze patterns across experiences
 * Aggregates by task_type + approach_id with recency weighting
 * 
 * @param {Object} options
 * @param {number} options.maxAgeDays - Maximum age in days
 * @param {number} options.halfLife - Half-life for recency weighting
 * @returns {Object} Pattern analysis results
 */
function analyzePatterns(options = {}) {
  const { maxAgeDays = 30, halfLife = DEFAULT_HALF_LIFE } = options;
  
  const experiences = loadExperiences(maxAgeDays);
  
  if (experiences.length === 0) {
    return {
      totalExperiences: 0,
      patterns: {},
      taskTypeStats: {},
      approachStats: {},
      insights: []
    };
  }
  
  // Aggregate by task_type + approach_id
  const patterns = {};
  const taskTypeStats = {};
  const approachStats = {};
  
  for (const exp of experiences) {
    const taskType = exp.task_type || 'unknown';
    const approach = exp.approach_id || 'unknown';
    const key = `${taskType}::${approach}`;
    
    const weight = calculateRecencyWeight(exp.timestamp, halfLife);
    const isSuccess = exp.outcome === 'success';
    const tokenEstimate = exp.tokenEstimate || exp.tokens || 0;
    const duration = exp.durationMinutes || 0;
    
    // Initialize pattern entry
    if (!patterns[key]) {
      patterns[key] = {
        task_type: taskType,
        approach_id: approach,
        count: 0,
        weightedCount: 0,
        successes: 0,
        weightedSuccesses: 0,
        totalTokens: 0,
        weightedTokens: 0,
        totalDuration: 0,
        weightedDuration: 0,
        recencyScores: []
      };
    }
    
    // Update pattern stats
    patterns[key].count++;
    patterns[key].weightedCount += weight;
    patterns[key].totalTokens += tokenEstimate;
    patterns[key].weightedTokens += tokenEstimate * weight;
    patterns[key].totalDuration += duration;
    patterns[key].weightedDuration += duration * weight;
    patterns[key].recencyScores.push(weight);
    
    if (isSuccess) {
      patterns[key].successes++;
      patterns[key].weightedSuccesses += weight;
    }
    
    // Update task type stats
    if (!taskTypeStats[taskType]) {
      taskTypeStats[taskType] = {
        count: 0,
        weightedCount: 0,
        approaches: new Set()
      };
    }
    taskTypeStats[taskType].count++;
    taskTypeStats[taskType].weightedCount += weight;
    taskTypeStats[taskType].approaches.add(approach);
    
    // Update approach stats
    if (!approachStats[approach]) {
      approachStats[approach] = {
        count: 0,
        weightedCount: 0,
        taskTypes: new Set()
      };
    }
    approachStats[approach].count++;
    approachStats[approach].weightedCount += weight;
    approachStats[approach].taskTypes.add(taskType);
  }
  
  // Calculate derived metrics for patterns
  for (const key in patterns) {
    const p = patterns[key];
    p.successRate = p.count > 0 ? (p.successes / p.count) : 0;
    p.weightedSuccessRate = p.weightedCount > 0 
      ? (p.weightedSuccesses / p.weightedCount) 
      : 0;
    p.avgTokens = p.count > 0 ? (p.totalTokens / p.count) : 0;
    p.weightedAvgTokens = p.weightedCount > 0 
      ? (p.weightedTokens / p.weightedCount) 
      : 0;
    p.avgDuration = p.count > 0 ? (p.totalDuration / p.count) : 0;
    p.weightedAvgDuration = p.weightedCount > 0 
      ? (p.weightedDuration / p.weightedCount) 
      : 0;
    p.avgRecency = p.recencyScores.length > 0
      ? (p.recencyScores.reduce((a, b) => a + b, 0) / p.recencyScores.length)
      : 0;
    
    // Convert Set to Array for JSON serialization
    p.recencyScores = p.recencyScores.slice(-10); // Keep last 10
  }
  
  // Convert Sets to Arrays in stats
  for (const taskType in taskTypeStats) {
    taskTypeStats[taskType].approaches = Array.from(taskTypeStats[taskType].approaches);
  }
  for (const approach in approachStats) {
    approachStats[approach].taskTypes = Array.from(approachStats[approach].taskTypes);
  }
  
  // Generate insights
  const insights = generateInsights(patterns, taskTypeStats, approachStats);
  
  return {
    totalExperiences: experiences.length,
    analysisWindowDays: maxAgeDays,
    halfLife,
    patterns,
    taskTypeStats,
    approachStats,
    insights
  };
}

/**
 * Generate insights from pattern analysis
 * @private
 */
function generateInsights(patterns, taskTypeStats, approachStats) {
  const insights = [];
  
  // Find best approach per task type
  for (const taskType in taskTypeStats) {
    const approaches = taskTypeStats[taskType].approaches;
    let bestApproach = null;
    let bestScore = -1;
    
    for (const approach of approaches) {
      const key = `${taskType}::${approach}`;
      const p = patterns[key];
      if (p && p.weightedCount >= 2) { // Need at least 2 samples
        const score = p.weightedSuccessRate * p.avgRecency; // Success * recency
        if (score > bestScore) {
          bestScore = score;
          bestApproach = { approach, ...p };
        }
      }
    }
    
    if (bestApproach) {
      insights.push({
        type: 'best_approach',
        task_type: taskType,
        approach_id: bestApproach.approach,
        confidence: Math.min(0.95, bestApproach.weightedSuccessRate),
        evidence: `${bestApproach.count} attempts, ${(bestApproach.successRate * 100).toFixed(1)}% success`
      });
    }
  }
  
  // Find underperforming approaches
  for (const key in patterns) {
    const p = patterns[key];
    if (p.count >= 3 && p.successRate < 0.5) {
      insights.push({
        type: 'underperforming',
        task_type: p.task_type,
        approach_id: p.approach_id,
        confidence: 1 - p.successRate,
        evidence: `${p.count} attempts, only ${(p.successRate * 100).toFixed(1)}% success`
      });
    }
  }
  
  // Find most efficient approaches (low tokens + high success)
  for (const key in patterns) {
    const p = patterns[key];
    if (p.count >= 2 && p.successRate >= 0.8 && p.avgTokens > 0) {
      insights.push({
        type: 'efficient',
        task_type: p.task_type,
        approach_id: p.approach_id,
        confidence: p.successRate,
        evidence: `${(p.successRate * 100).toFixed(0)}% success, ~${Math.round(p.avgTokens)} tokens avg`
      });
    }
  }
  
  return insights;
}

/**
 * Recommend the best approach for a given task type
 * 
 * @param {string} taskType - The type of task
 * @param {Object} options
 * @param {number} options.minConfidence - Minimum confidence threshold (0-1)
 * @param {number} options.maxAgeDays - Maximum age of experiences to consider
 * @returns {Object} Recommendation with confidence score
 */
function recommendApproach(taskType, options = {}) {
  const { minConfidence = 0.5, maxAgeDays = 30 } = options;
  
  const analysis = analyzePatterns({ maxAgeDays });
  const candidates = [];
  
  // Find all patterns matching this task type
  for (const key in analysis.patterns) {
    const p = analysis.patterns[key];
    if (p.task_type === taskType && p.count >= 2) {
      // Calculate confidence based on success rate and sample size
      const sampleSizeBonus = Math.min(0.2, (p.count - 2) * 0.05); // Up to 0.2 bonus for more samples
      const confidence = (p.weightedSuccessRate * 0.8 + p.avgRecency * 0.2) + sampleSizeBonus;
      
      candidates.push({
        approach_id: p.approach_id,
        confidence: Math.min(0.99, confidence),
        successRate: p.successRate,
        weightedSuccessRate: p.weightedSuccessRate,
        sampleSize: p.count,
        avgTokens: p.avgTokens,
        avgDuration: p.avgDuration,
        recency: p.avgRecency
      });
    }
  }
  
  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);
  
  if (candidates.length === 0) {
    return {
      task_type: taskType,
      recommendation: null,
      confidence: 0,
      reason: 'Insufficient data - need at least 2 experiences',
      alternatives: []
    };
  }
  
  const top = candidates[0];
  
  if (top.confidence < minConfidence) {
    return {
      task_type: taskType,
      recommendation: top.approach_id,
      confidence: top.confidence,
      reason: `Below confidence threshold (${minConfidence})`,
      alternatives: candidates.slice(1),
      details: top
    };
  }
  
  return {
    task_type: taskType,
    recommendation: top.approach_id,
    confidence: top.confidence,
    reason: `Best historical performance: ${(top.successRate * 100).toFixed(1)}% success`,
    alternatives: candidates.slice(1),
    details: top
  };
}

/**
 * Generate weekly insights report
 * Creates a summary of the week's learning
 * 
 * @param {Object} options
 * @param {Date} options.weekEnding - End date for the week (default: today)
 * @param {number} options.halfLife - Half-life for weighting
 * @returns {Object} Weekly insights report
 */
function generateWeeklyInsights(options = {}) {
  const { weekEnding = new Date(), halfLife = DEFAULT_HALF_LIFE } = options;
  
  const weekStart = new Date(weekEnding);
  weekStart.setDate(weekStart.getDate() - 7);
  
  const analysis = analyzePatterns({ maxAgeDays: 14, halfLife });
  
  // Filter to this week's experiences
  const weekExperiences = loadExperiences(7).filter(exp => {
    const expDate = new Date(exp.timestamp);
    return expDate <= weekEnding && expDate >= weekStart;
  });
  
  // Calculate week-over-week changes
  const prevWeekExperiences = loadExperiences(14).filter(exp => {
    const expDate = new Date(exp.timestamp);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    return expDate < weekStart && expDate >= prevWeekStart;
  });
  
  const weekSuccesses = weekExperiences.filter(e => e.outcome === 'success').length;
  const weekTotal = weekExperiences.length;
  const weekSuccessRate = weekTotal > 0 ? (weekSuccesses / weekTotal) : 0;
  
  const prevSuccesses = prevWeekExperiences.filter(e => e.outcome === 'success').length;
  const prevTotal = prevWeekExperiences.length;
  const prevSuccessRate = prevTotal > 0 ? (prevSuccesses / prevTotal) : 0;
  
  // Collect all lessons from the week
  const allLessons = weekExperiences
    .filter(e => e.lessons && Array.isArray(e.lessons))
    .flatMap(e => e.lessons);
  
  // Count unique lessons
  const lessonCounts = {};
  for (const lesson of allLessons) {
    lessonCounts[lesson] = (lessonCounts[lesson] || 0) + 1;
  }
  
  // Get top lessons (appearing multiple times or high impact)
  const topLessons = Object.entries(lessonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([lesson, count]) => ({ lesson, frequency: count }));
  
  // Generate recommendations based on patterns
  const recommendations = [];
  
  for (const insight of analysis.insights) {
    if (insight.type === 'best_approach' && insight.confidence >= 0.7) {
      recommendations.push({
        type: 'continue',
        message: `Continue using '${insight.approach_id}' for ${insight.task_type} tasks`,
        confidence: insight.confidence
      });
    } else if (insight.type === 'underperforming') {
      recommendations.push({
        type: 'avoid',
        message: `Consider alternative approaches for ${insight.task_type} (current: ${insight.approach_id})`,
        confidence: insight.confidence
      });
    }
  }
  
  const report = {
    weekEnding: weekEnding.toISOString().split('T')[0],
    weekStarting: weekStart.toISOString().split('T')[0],
    summary: {
      totalTasks: weekTotal,
      successfulTasks: weekSuccesses,
      successRate: weekSuccessRate,
      previousWeekSuccessRate: prevSuccessRate,
      improvement: weekSuccessRate - prevSuccessRate,
      totalTokens: weekExperiences.reduce((sum, e) => sum + (e.tokenEstimate || 0), 0),
      totalDuration: weekExperiences.reduce((sum, e) => sum + (e.durationMinutes || 0), 0)
    },
    approachEffectiveness: analysis.patterns,
    topLessons,
    insights: analysis.insights,
    recommendations,
    generatedAt: new Date().toISOString()
  };
  
  // Save to weekly-reviews directory
  const reportPath = path.join(WEEKLY_REVIEWS_DIR, `${report.weekEnding}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  return report;
}

/**
 * Get learning statistics for a specific time period
 * 
 * @param {number} days - Number of days to analyze
 * @returns {Object} Statistics summary
 */
function getLearningStats(days = 30) {
  const analysis = analyzePatterns({ maxAgeDays: days });
  
  const experiences = loadExperiences(days);
  const totalTokens = experiences.reduce((sum, e) => sum + (e.tokenEstimate || 0), 0);
  const totalDuration = experiences.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
  
  // Get approach distribution
  const approachDistribution = {};
  for (const exp of experiences) {
    const approach = exp.approach_id || exp.approach || 'unknown';
    approachDistribution[approach] = (approachDistribution[approach] || 0) + 1;
  }
  
  // Get task type distribution
  const taskTypeDistribution = {};
  for (const exp of experiences) {
    const taskType = exp.task_type || exp.taskType || 'unknown';
    taskTypeDistribution[taskType] = (taskTypeDistribution[taskType] || 0) + 1;
  }
  
  return {
    period: `${days} days`,
    totalExperiences: experiences.length,
    totalTokens,
    totalDurationMinutes: totalDuration,
    avgTokensPerTask: experiences.length > 0 ? Math.round(totalTokens / experiences.length) : 0,
    avgDurationPerTask: experiences.length > 0 ? Math.round(totalDuration / experiences.length) : 0,
    approachDistribution,
    taskTypeDistribution,
    uniquePatterns: Object.keys(analysis.patterns).length,
    insights: analysis.insights.length
  };
}

/**
 * Export all raw data for external analysis
 * @returns {Array} All experiences
 */
function exportRawData() {
  return loadExperiences();
}

/**
 * Clear old experience data (use with caution)
 * @param {number} keepDays - Number of days to keep
 * @returns {number} Number of files deleted
 */
function clearOldExperiences(keepDays = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);
  
  let deleted = 0;
  const files = fs.readdirSync(EXPERIENCES_DIR).filter(f => f.endsWith('.jsonl'));
  
  for (const file of files) {
    const fileDate = new Date(file.replace('.jsonl', ''));
    if (fileDate < cutoff) {
      fs.unlinkSync(path.join(EXPERIENCES_DIR, file));
      deleted++;
    }
  }
  
  return deleted;
}

module.exports = {
  // Core analysis functions
  analyzePatterns,
  recommendApproach,
  generateWeeklyInsights,
  
  // Utility functions
  calculateRecencyWeight,
  loadExperiences,
  getLearningStats,
  exportRawData,
  clearOldExperiences,
  
  // Constants
  DEFAULT_HALF_LIFE
};