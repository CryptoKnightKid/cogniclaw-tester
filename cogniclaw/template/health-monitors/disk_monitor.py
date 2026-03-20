#!/usr/bin/env python3
"""
Disk Monitor - Monitor disk usage and auto-archive old logs
"""

import os
import json
import shutil
from datetime import datetime, timedelta
from pathlib import Path

# Config
STATE_FILE = "/home/ubuntu/health-monitors/state/disk_state.json"
LOG_FILE = "/home/ubuntu/health-monitors/logs/disk_monitor.log"
ARCHIVE_DIR = "/home/ubuntu/.openclaw/archives"

# Thresholds
WARNING_PERCENT = 80
CRITICAL_PERCENT = 90

def ensure_dirs():
    Path(STATE_FILE).parent.mkdir(parents=True, exist_ok=True)
    Path(LOG_FILE).parent.mkdir(parents=True, exist_ok=True)
    Path(ARCHIVE_DIR).mkdir(parents=True, exist_ok=True)

def log(msg):
    ensure_dirs()
    timestamp = datetime.now().isoformat()
    entry = f"[{timestamp}] {msg}"
    print(entry)
    with open(LOG_FILE, "a") as f:
        f.write(entry + "\n")

def get_disk_usage():
    """Get disk usage for /home/ubuntu"""
    try:
        stat = shutil.disk_usage("/home/ubuntu")
        total = stat.total
        used = stat.used
        free = stat.free
        percent = (used / total) * 100
        
        return {
            "total_gb": total / (1024**3),
            "used_gb": used / (1024**3),
            "free_gb": free / (1024**3),
            "percent": percent
        }
    except Exception as e:
        log(f"Error getting disk usage: {e}")
        return {"total_gb": 0, "used_gb": 0, "free_gb": 0, "percent": 0, "error": str(e)}

def archive_old_logs():
    """Archive logs older than 30 days"""
    archived = []
    errors = []
    
    log_dirs = [
        "/home/ubuntu/.openclaw/workspace/logs",
        "/home/ubuntu/health-monitors/logs"
    ]
    
    cutoff = datetime.now() - timedelta(days=30)
    
    for log_dir in log_dirs:
        if not os.path.exists(log_dir):
            continue
        
        for filename in os.listdir(log_dir):
            filepath = os.path.join(log_dir, filename)
            if not os.path.isfile(filepath):
                continue
            
            try:
                mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
                if mtime < cutoff:
                    # Archive the file
                    archive_name = f"{mtime.strftime('%Y%m%d')}_{filename}"
                    archive_path = os.path.join(ARCHIVE_DIR, archive_name)
                    
                    shutil.move(filepath, archive_path)
                    archived.append({
                        "original": filepath,
                        "archived": archive_path,
                        "date": mtime.isoformat()
                    })
            except Exception as e:
                errors.append({"file": filepath, "error": str(e)})
    
    log(f"Archived {len(archived)} old log files")
    return {"archived": archived, "errors": errors}

def cleanup_archives():
    """Remove archives older than 90 days"""
    removed = []
    
    if not os.path.exists(ARCHIVE_DIR):
        return removed
    
    cutoff = datetime.now() - timedelta(days=90)
    
    for filename in os.listdir(ARCHIVE_DIR):
        filepath = os.path.join(ARCHIVE_DIR, filename)
        if not os.path.isfile(filepath):
            continue
        
        try:
            mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
            if mtime < cutoff:
                os.remove(filepath)
                removed.append(filepath)
        except Exception as e:
            log(f"Error removing old archive {filepath}: {e}")
    
    if removed:
        log(f"Removed {len(removed)} old archives")
    
    return removed

def check():
    """Main check function"""
    usage = get_disk_usage()
    percent = usage.get("percent", 0)
    
    state = {
        "timestamp": datetime.now().isoformat(),
        "usage": usage,
        "status": "healthy",
        "action": None
    }
    
    if percent >= CRITICAL_PERCENT:
        state["status"] = "critical"
        state["action"] = "archive_triggered"
        archive_result = archive_old_logs()
        cleanup_result = cleanup_archives()
        state["action_result"] = {
            "archived": archive_result,
            "cleaned": cleanup_result
        }
    elif percent >= WARNING_PERCENT:
        state["status"] = "warning"
        state["action"] = "archive_triggered"
        archive_result = archive_old_logs()
        state["action_result"] = {"archived": archive_result}
    else:
        # Still cleanup very old archives
        cleanup_archives()
    
    # Save state
    ensure_dirs()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)
    
    log(f"Disk usage: {percent:.1f}% - Status: {state['status']}")
    return state

if __name__ == "__main__":
    check()
