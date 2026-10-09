/**
 * VigilExam - System Diagnostics Service
 * 
 * Provides hardware, memory, and OS diagnostics for exam integrity.
 */

import os from 'os';

class SystemMonitor {
  getDiagnostics() {
    return {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      totalMemMB: Math.round(os.totalmem() / (1024 * 1024)),
      freeMemMB: Math.round(os.freemem() / (1024 * 1024)),
      cpus: os.cpus().length,
      uptimeSeconds: os.uptime(),
      timestamp: new Date().toISOString()
    };
  }
}

export const systemMonitor = new SystemMonitor();
