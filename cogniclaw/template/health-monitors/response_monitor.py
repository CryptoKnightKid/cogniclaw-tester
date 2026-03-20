#!/usr/bin/env python3
"""
Response Monitor - Track API response times
"""

import os
import json
import time
from datetime import datetime, timedelta
from pathlib import Path

# Config
STATE_FILE = "/home/ubuntu/health-monitors/state/response_state.json"
LOG_FILE = "/home/ubuntu/health-monitors/logs/response_monitor.log"
HISTORY_FILE = "/home/ubuntu/health-monitors/state/response_history.json"

# Thresholds (in milliseconds)
WARNING_MS = 5000   # 5 seconds
CRITICAL_MS = 10000  # 10 seconds

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

def load_history():
    """Load response time history"""
    try:
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, "r") as f:
                return json.load(f)
    except:
        pass
    return []

def save_history(history):
    """Save response time history (keep last 24 hours)"""
    try:
        # Keep only last 24 hours
        cutoff = (datetime.now() - timedelta(hours=24)).isoformat()
        history = [h for h in history if h.get("timestamp", "") > cutoff]
        with open(HISTORY_FILE, "w") as f:
            json.dump(history[-1000:], f, indent=2)  # Keep last 1000 entries
    except Exception as e:
        log(f"Error saving history: {e}")

def simulate_response_check():
    """Simulate checking API response time"""
    # In real implementation, this would make actual API calls
    # For now, we'll check OpenClaw status and measure
    import subprocess
    
    start = time.time()
    try:
        result = subprocess.run(
            ["openclaw", "status"],
            capture_output=True,
            text=True,
            timeout=10
        )
        elapsed_ms = (time.time() - start) * 1000
        return {
            "success": result.returncode == 0,
            "response_time_ms": elapsed_ms,
            "timestamp": datetime.now().isoformat()
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "response_time_ms": 10000,
            "error": "timeout",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "response_time_ms": 0,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

def check():
    """Main check function"""
    history = load_history()
    
    # Run response check
    check_result = simulate_response_check()
    history.append(check_result)
    save_history(history)
    
    response_ms = check_result.get("response_time_ms", 0)
    
    # Calculate averages
    recent = history[-10:] if len(history) >= 10 else history
    avg_ms = sum(h.get("response_time_ms", 0) for h in recent) / len(recent) if recent else 0
    
    state = {
        "timestamp": datetime.now().isoformat(),
        "current_response_ms": response_ms,
        "avg_response_ms": avg_ms,
        "history_count": len(history),
        "last_check": check_result,
        "status": "healthy"
    }
    
    if response_ms >= CRITICAL_MS or not check_result.get("success"):
        state["status"] = "critical"
    elif response_ms >= WARNING_MS:
        state["status"] = "warning"
    
    # Save state
    ensure_dirs()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)
    
    log(f"Response time: {response_ms:.0f}ms (avg: {avg_ms:.0f}ms) - Status: {state['status']}")
    return state

if __name__ == "__main__":
    check()
