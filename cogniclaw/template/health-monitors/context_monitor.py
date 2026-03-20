#!/usr/bin/env python3
"""
Context Monitor - Watches OpenClaw context usage and auto-compacts at 80%
"""

import os
import json
import time
import subprocess
from datetime import datetime
from pathlib import Path

# Config
CONTEXT_THRESHOLD = 0.80  # 80% threshold
MAX_CONTEXT_TOKENS = 1000000  # 1M tokens
STATE_FILE = "/home/ubuntu/health-monitors/state/context_state.json"
LOG_FILE = "/home/ubuntu/health-monitors/logs/context_monitor.log"

def ensure_dirs():
    Path(STATE_FILE).parent.mkdir(parents=True, exist_ok=True)
    Path(LOG_FILE).parent.mkdir(parents=True, exist_ok=True)

def log(msg):
    ensure_dirs()
    timestamp = datetime.now().isoformat()
    entry = f"[{timestamp}] {msg}"
    print(entry)
    with open(LOG_FILE, "a") as f:
        f.write(entry + "\n")

def get_context_usage():
    """Get current context usage from session status"""
    try:
        # Try to read from OpenClaw session info
        result = subprocess.run(
            ["openclaw", "session", "status", "--json"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return {
                "used": data.get("contextUsed", 0),
                "total": data.get("contextMax", MAX_CONTEXT_TOKENS),
                "percentage": data.get("contextUsed", 0) / data.get("contextMax", MAX_CONTEXT_TOKENS) * 100
            }
    except Exception as e:
        log(f"Error getting context usage: {e}")
    
    # Fallback: estimate based on recent log size
    try:
        workspace = "/home/ubuntu/.openclaw/workspace"
        # Rough estimation
        return {"used": 0, "total": MAX_CONTEXT_TOKENS, "percentage": 0, "estimated": True}
    except:
        return {"used": 0, "total": MAX_CONTEXT_TOKENS, "percentage": 0, "error": True}

def trigger_compaction():
    """Trigger context compaction"""
    try:
        log("Triggering context compaction...")
        result = subprocess.run(
            ["openclaw", "session", "compact"],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            log("Context compaction completed successfully")
            return True
        else:
            log(f"Context compaction failed: {result.stderr}")
            return False
    except Exception as e:
        log(f"Error triggering compaction: {e}")
        return False

def check():
    """Main check function"""
    usage = get_context_usage()
    percentage = usage.get("percentage", 0)
    
    state = {
        "timestamp": datetime.now().isoformat(),
        "usage": usage,
        "status": "healthy",
        "action": None
    }
    
    if percentage >= 90:
        state["status"] = "critical"
        state["action"] = "compaction_triggered"
        if trigger_compaction():
            state["action_result"] = "success"
        else:
            state["action_result"] = "failed"
    elif percentage >= CONTEXT_THRESHOLD * 100:
        state["status"] = "warning"
        state["action"] = "compaction_triggered"
        if trigger_compaction():
            state["action_result"] = "success"
        else:
            state["action_result"] = "failed"
    
    # Save state
    ensure_dirs()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)
    
    log(f"Context usage: {percentage:.1f}% - Status: {state['status']}")
    return state

if __name__ == "__main__":
    check()
