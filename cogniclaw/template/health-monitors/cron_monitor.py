#!/usr/bin/env python3
"""
Cron Monitor - Check for failed cron jobs
"""

import os
import json
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

# Config
STATE_FILE = "/home/ubuntu/health-monitors/state/cron_state.json"
LOG_FILE = "/home/ubuntu/health-monitors/logs/cron_monitor.log"
CRON_LOG = "/home/ubuntu/.openclaw/cron.log"

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

def get_cron_jobs():
    """Get list of configured cron jobs"""
    try:
        result = subprocess.run(
            ["openclaw", "cron", "list"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            # Parse cron list output
            jobs = []
            for line in result.stdout.strip().split("\n"):
                if line.strip() and not line.startswith("ID"):
                    parts = line.split()
                    if len(parts) >= 3:
                        jobs.append({
                            "id": parts[0],
                            "schedule": parts[1],
                            "command": " ".join(parts[2:])
                        })
            return jobs
    except Exception as e:
        log(f"Error getting cron jobs: {e}")
    return []

def check_cron_log():
    """Check recent cron execution results"""
    errors = []
    recent_runs = []
    
    try:
        if os.path.exists(CRON_LOG):
            with open(CRON_LOG, "r") as f:
                lines = f.readlines()
            
            # Check last 50 lines
            for line in lines[-50:]:
                if "error" in line.lower() or "fail" in line.lower():
                    errors.append(line.strip())
                if "executed" in line.lower() or "ran" in line.lower():
                    recent_runs.append(line.strip())
    except Exception as e:
        log(f"Error reading cron log: {e}")
    
    return {"errors": errors, "recent_runs": recent_runs}

def restart_cron():
    """Restart cron service"""
    try:
        log("Attempting to restart cron service...")
        result = subprocess.run(
            ["openclaw", "cron", "restart"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            log("Cron service restarted successfully")
            return True
        else:
            log(f"Cron restart failed: {result.stderr}")
            return False
    except Exception as e:
        log(f"Error restarting cron: {e}")
        return False

def check():
    """Main check function"""
    jobs = get_cron_jobs()
    log_check = check_cron_log()
    
    state = {
        "timestamp": datetime.now().isoformat(),
        "jobs_count": len(jobs),
        "jobs": jobs,
        "recent_errors": log_check["errors"],
        "recent_runs_count": len(log_check["recent_runs"]),
        "status": "healthy",
        "action": None
    }
    
    # Determine status
    if len(log_check["errors"]) > 5:
        state["status"] = "critical"
        state["action"] = "restart_triggered"
        if restart_cron():
            state["action_result"] = "success"
        else:
            state["action_result"] = "failed"
    elif len(log_check["errors"]) > 0:
        state["status"] = "warning"
    
    # Save state
    ensure_dirs()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)
    
    log(f"Cron jobs: {len(jobs)}, Errors: {len(log_check['errors'])} - Status: {state['status']}")
    return state

if __name__ == "__main__":
    check()
