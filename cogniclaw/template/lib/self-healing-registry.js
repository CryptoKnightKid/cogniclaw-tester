/**
 * Self-Healing Tool Registry
 * Resilient tool execution with circuit breakers, fallback chains, and health monitoring
 */

const fs = require('fs');
const path = require('path');

class SelfHealingRegistry {
  constructor(configPath) {
    this.configPath = configPath || '/home/ubuntu/.openclaw/workspace/memory/tool-registry.json';
    this.healthLogPath = '/home/ubuntu/.openclaw/workspace/memory/tool-health.jsonl';
    this.tools = new Map();
    this.healthStatus = new Map();
    this.loadConfig();
  }

  loadConfig() {
    try {
      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      for (const [name, toolConfig] of Object.entries(config.tools || {})) {
        this.register(name, toolConfig);
      }
    } catch {
      this.initializeDefaultConfig();
    }
  }

  initializeDefaultConfig() {
    const defaultConfig = {
      version: '1.0.0',
      tools: {
        'web_search': {
          primary: { provider: 'brave', timeout: 30000 },
          fallback: { provider: 'duckduckgo', timeout: 45000 },
          degraded: { provider: 'local_rss', timeout: 10000 },
          circuitBreaker: { failureThreshold: 5, resetTimeout: 60000 }
        },
        'browser': {
          primary: { provider: 'camoufox', timeout: 60000 },
          fallback: { provider: 'chrome_relay', timeout: 45000 },
          degraded: { action: 'fetch_static', timeout: 15000 },
          circuitBreaker: { failureThreshold: 3, resetTimeout: 120000 }
        }
      }
    };
    fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
    this.tools = new Map(Object.entries(defaultConfig.tools));
  }

  register(name, config) {
    this.tools.set(name, {
      ...config,
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      failures: 0,
      lastFailure: null,
      lastSuccess: null
    });
  }

  async execute(toolName, params) {
    const tool = this.tools.get(toolName);
    if (!tool) throw new Error(`Tool not registered: ${toolName}`);

    // Check circuit breaker state
    if (tool.state === 'OPEN') {
      if (Date.now() - tool.lastFailure < tool.circuitBreaker.resetTimeout) {
        return this.executeFallback(tool, params);
      }
      tool.state = 'HALF_OPEN';
    }

    try {
      const result = await this.callProvider(tool.primary, params);
      this.recordSuccess(toolName);
      return { result, tier: 'primary', provider: tool.primary.provider };
    } catch (primaryError) {
      this.recordFailure(toolName, primaryError);
      
      try {
        const fallbackResult = await this.executeFallback(tool, params);
        return { ...fallbackResult, primaryError: primaryError.message };
      } catch (fallbackError) {
        return this.executeDegraded(tool, params, fallbackError);
      }
    }
  }

  async executeFallback(tool, params) {
    if (!tool.fallback) throw new Error('No fallback configured');
    const result = await this.callProvider(tool.fallback, params);
    return { result, tier: 'fallback', provider: tool.fallback.provider };
  }

  async executeDegraded(tool, params, error) {
    if (!tool.degraded) {
      throw new Error(`All tiers failed: ${error.message}`);
    }
    
    if (tool.degraded.action === 'return_stale') {
      const cached = this.getCachedResult(tool.name);
      if (cached) {
        return { result: cached, tier: 'degraded', mode: 'stale_cache', warning: 'Returning cached result' };
      }
    }
    
    throw new Error(`Service unavailable. Last error: ${error.message}`);
  }

  async callProvider(config, params) {
    // Simulate provider call - in real implementation, this calls actual tool
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate for demo
          resolve({ success: true, data: `Result from ${config.provider}` });
        } else {
          reject(new Error(`${config.provider} timeout`));
        }
      }, 100);
    });
  }

  recordSuccess(toolName) {
    const tool = this.tools.get(toolName);
    tool.lastSuccess = Date.now();
    if (tool.state === 'HALF_OPEN') {
      tool.state = 'CLOSED';
      tool.failures = 0;
    }
    this.logHealth(toolName, 'success');
  }

  recordFailure(toolName, error) {
    const tool = this.tools.get(toolName);
    tool.failures++;
    tool.lastFailure = Date.now();
    
    if (tool.failures >= tool.circuitBreaker.failureThreshold) {
      tool.state = 'OPEN';
    }
    
    this.logHealth(toolName, 'failure', error.message);
  }

  logHealth(toolName, status, error = null) {
    const entry = {
      ts: new Date().toISOString(),
      tool: toolName,
      status,
      state: this.tools.get(toolName)?.state,
      error,
      failures: this.tools.get(toolName)?.failures
    };
    fs.appendFileSync(this.healthLogPath, JSON.stringify(entry) + '\n');
  }

  getHealthReport() {
    const report = [];
    for (const [name, tool] of this.tools) {
      report.push({
        name,
        state: tool.state,
        failures: tool.failures,
        lastFailure: tool.lastFailure ? new Date(tool.lastFailure).toISOString() : null,
        lastSuccess: tool.lastSuccess ? new Date(tool.lastSuccess).toISOString() : null
      });
    }
    return report;
  }
}

module.exports = { SelfHealingRegistry };
