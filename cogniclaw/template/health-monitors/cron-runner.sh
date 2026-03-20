#!/bin/bash
# Health Monitors Runner - Called by cron every 5 minutes

cd /home/ubuntu/health-monitors
/usr/bin/python3 /home/ubuntu/health-monitors/run_all.py > /dev/null 2>&1
