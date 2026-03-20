#!/usr/bin/env python3
"""
Session Monitor - Watches sessions.json size and auto-cleanup at 10MB
"""

import os
import json
import time
from datetime import datetime, timedelta
from pathlib import Path

# Config
SESSIONS_FILE = "/home/ubuntu/.openclaw/sessions.json"
SIZE_THRESHOLD_MB = 10
SIZE_THRESHOLD_BYTES = SIZE_THRESHOLD_MB * 1024 * 1024
STATE_FILE = "/home/ubuntu/health-monitors/state/session_state.json"
LOG_FILE = "/home/ubuntu/health-monitors/logs/session_monitor.log"
BACKUP_DIR = "/home/ubuntu/.openclaw/backups/sessions"

def ensure_dirs():
    Path(STATE_FILE).parent.mkdir(parents=True, exist_ok=True)
    Path(LOG_FILE).parent.mkdir(parents=True, exist_ok=True)
    Path(BACKUP_DIR).mkdir(parents=True, exist_ok=True)

def log(msg):
    ensure_dirs()
    timestamp = datetime.now().isoformat()
    entry = f"[{timestamp}] {msg}"
    print(entry)
    with open(LOG_FILE, "a") as f:
        f.write(entry + "\n")

def get_sessions_size():
    """Get current sessions.json size"""
    try:
        if os.path.exists(SESSIONS_FILE):
            size = os.path.getsize(SESSIONS_FILE)
            return {
                "bytes": size,
                "mb": size / (1024 * 1024),
                "exists": True
            }
        return {"bytes": 0, "mb": 0, "exists": False}
    except Exception as e:
        log(f"Error getting sessions size: {e}")
        return {"bytes": 0, "mb": 0, "error": str(e)}

def backup_and_cleanup():
    """Backup old sessions and clean up"""
    try:
        if not os.path.exists(SESSIONS_FILE):
            return {"backed_up": 0, "cleaned": 0}
        
        # Load sessions
        with open(SESSIONS_FILE, "r") as f:
            sessions = json.load(f)
        
        original_count = len(sessions)
        
        # Backup before cleanup
        backup_file = os.path.join(BACKUP_DIR, f"sessions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        with open(backup_file, "w") as f:
            json.dump(sessions, f, indent=2)
        
        # Clean old sessions (older than 7 days)
        cutoff = datetime.now() - timedelta(days=7)
        cleaned = []
        removed = []
        
        for session in sessions:
            # Check last activity
            last_activity = session.get("lastActivity", session.get("created", "2000-01-01"))
            try:
                last_dt = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
                if last_dt > cutoff:
                    cleaned.append(session)
                else:
                    removed.append(session)
            except:
                # Keep if we can't parse date
                cleaned.append(session)
        
        # Write cleaned sessions
        with open(SESSIONS_FILE, "w") as f:
            json.dump(cleaned, f, indent=2)
        
        removed_count = original_count - len(cleaned)
        log(f"Cleaned {removed_count} old sessions, backed up to {backup_file}")
        
        return {
            "backed_up": original_count,
            "cleaned": removed_count,
            "remaining": len(cleaned),
            "backup_file": backup_file
        }
    except Exception as e:
        log(f"Error during cleanup: {e}")
        return {"error": str(e)}

def check():
    """Main check function"""
    size_info = get_sessions_size()
    size_mb = size_info.get("mb", 0)
    
    state = {
        "timestamp": datetime.now().isoformat(),
        "size": size_info,
        "status": "healthy",
        "action": None
    }
    
    if size_mb >= SIZE_THRESHOLD_MB * 1.5:  # 15MB - critical
        state["status"] = "critical"
        state["action"] = "cleanup_triggered"
        result = backup_and_cleanup()
        state["action_result"] = result
    elif size_mb >= SIZE_THRESHOLD_MB:  # 10MB - warning
        state["status"] = "warning"
        state["action"] = "cleanup_triggered"
        result = backup_and_cleanup()
        state["action_result"] = result
    
    # Save state
    ensure_dirs()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)
    
    log(f"Sessions size: {size_mb:.2f}MB - Status: {state['status']}")
    return state

if __name__ == "__main__":
    check()
