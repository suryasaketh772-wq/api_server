import os
import time
import logging
import psutil
from typing import Dict, Any

logger = logging.getLogger("api_server.monitoring.system")

# Class-level cache variables to compute bandwidth rates over time
_prev_net_io = None
_prev_calc_time = time.time()
_bytes_sent_sec = 0.0
_bytes_recv_sec = 0.0

def get_system_metrics(start_time: float) -> Dict[str, Any]:
    """
    Leverages psutil to gather live system parameters.
    Returns resource usages, memory structures, network bandwidth differentials, and process diagnostics.
    """
    global _prev_net_io, _prev_calc_time, _bytes_sent_sec, _bytes_recv_sec
    
    now = time.time()
    
    # 1. CPU Usage
    try:
        # Non-blocking CPU measurement (uses cached intervals)
        cpu_percent = psutil.cpu_percent(interval=None)
    except Exception:
        cpu_percent = 0.0
        
    # 2. Memory Usage (RAM)
    try:
        mem = psutil.virtual_memory()
        ram_total = mem.total
        ram_used = mem.used
        ram_percent = mem.percent
    except Exception:
        ram_total = 0
        ram_used = 0
        ram_percent = 0.0
        
    # 3. Disk Usage
    try:
        disk = psutil.disk_usage('/')
        disk_total = disk.total
        disk_used = disk.used
        disk_percent = disk.percent
    except Exception:
        disk_total = 0
        disk_used = 0
        disk_percent = 0.0
        
    # 4. Network Bandwidth Rates (Bytes/sec)
    try:
        net_io = psutil.net_io_counters()
        elapsed = now - _prev_calc_time
        
        if _prev_net_io and elapsed >= 0.9:
            sent_diff = max(0, net_io.bytes_sent - _prev_net_io.bytes_sent)
            recv_diff = max(0, net_io.bytes_recv - _prev_net_io.bytes_recv)
            
            _bytes_sent_sec = round(sent_diff / elapsed, 1)
            _bytes_recv_sec = round(recv_diff / elapsed, 1)
            
        _prev_net_io = net_io
        _prev_calc_time = now
    except Exception:
        # Bandwidth parsing is ignored if network metrics are locked
        pass

    # 5. Process Memory Size (RSS bytes)
    try:
        process = psutil.Process(os.getpid())
        process_memory_bytes = process.memory_info().rss
    except Exception:
        process_memory_bytes = 0

    return {
        "cpu_percent": cpu_percent,
        "ram": {
            "total_bytes": ram_total,
            "used_bytes": ram_used,
            "percent": ram_percent
        },
        "disk": {
            "total_bytes": disk_total,
            "used_bytes": disk_used,
            "percent": disk_percent
        },
        "network": {
            "bytes_sent_per_sec": _bytes_sent_sec,
            "bytes_received_per_sec": _bytes_recv_sec
        },
        "process": {
            "pid": os.getpid(),
            "memory_bytes": process_memory_bytes
        },
        "uptime_seconds": round(now - start_time, 2)
    }
