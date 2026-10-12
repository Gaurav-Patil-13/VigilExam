/**
 * VigilExam - Central Security Policy & Process Rules
 * 
 * Contains immutable system process protection lists, categorized prohibited applications,
 * risk scoring metrics, and baseline configuration.
 */

// 1. Critical Windows System Processes (NEVER TERMINATE UNDER ANY CIRCUMSTANCE)
export const SYSTEM_PROTECTED_PROCESSES = new Set([
  'system',
  'system idle process',
  'registry',
  'smss.exe',
  'csrss.exe',
  'wininit.exe',
  'winlogon.exe',
  'services.exe',
  'lsass.exe',
  'svchost.exe',
  'fontdrvhost.exe',
  'dwm.exe',
  'explorer.exe',
  'sihost.exe',
  'taskhostw.exe',
  'spoolsv.exe',
  'audiodg.exe',
  'ctfmon.exe',
  'securityhealthservice.exe',
  'securityhealthsystray.exe',
  'smartscreen.exe',
  'msmpeng.exe',
  'nissrv.exe',
  'searchhost.exe',
  'startmenuexperiencehost.exe',
  'shellexperiencehost.exe',
  'runtimebroker.exe',
  'applicationframehost.exe',
  'wlanext.exe',
  'conhost.exe',
  'dashost.exe',
  'searchindexer.exe',
  'memory compression',
  'secure system',
  'mpcmdrun.exe',
  'trustedinstaller.exe'
]);

// 2. VigilExam & Runtime Protected Processes (NEVER TERMINATE)
export const VIGILEXAM_PROTECTED_PROCESSES = new Set([
  'vigilexam.exe',
  'electron.exe',
  'node.exe',
  'cmd.exe',
  'powershell.exe',
  'git.exe'
]);

// 3. Prohibited Applications by Category
export const PROHIBITED_PROCESSES_MAP = {
  // Remote Access & Screen Sharing
  'anydesk.exe': { name: 'AnyDesk', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'Remote desktop access software' },
  'teamviewer.exe': { name: 'TeamViewer', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'Remote desktop software' },
  'teamviewer_service.exe': { name: 'TeamViewer Service', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'Remote desktop background service' },
  'rustdesk.exe': { name: 'RustDesk', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'Open source remote desktop software' },
  'remotedesktop.exe': { name: 'Remote Desktop', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'Remote desktop tool' },
  'mstsc.exe': { name: 'Windows Remote Desktop (MSTSC)', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'Windows native remote desktop client' },
  'vnc.exe': { name: 'VNC', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'Virtual network computing viewer' },
  'vncviewer.exe': { name: 'VNC Viewer', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'VNC remote display client' },
  'tvnserver.exe': { name: 'TightVNC Server', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'VNC remote desktop server' },
  'parsec.exe': { name: 'Parsec', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'Low-latency remote desktop tool' },
  'splashtop.exe': { name: 'Splashtop', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'Remote access software' },
  'logmein.exe': { name: 'LogMeIn', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'Remote desktop application' },
  'ultraviewer.exe': { name: 'UltraViewer', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'Remote support software' },
  'ammyy.exe': { name: 'Ammyy Admin', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'Remote desktop software' },
  'supremo.exe': { name: 'Supremo', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'Remote control tool' },
  'remoting_host.exe': { name: 'Chrome Remote Desktop', category: 'REMOTE_ACCESS', severity: 'critical', reason: 'Chrome Remote Desktop host' },

  // Screen Recording & Broadcasting
  'obs64.exe': { name: 'OBS Studio (64-bit)', category: 'SCREEN_RECORDER', severity: 'high', reason: 'Screen recording / broadcasting tool' },
  'obs32.exe': { name: 'OBS Studio (32-bit)', category: 'SCREEN_RECORDER', severity: 'high', reason: 'Screen recording / broadcasting tool' },
  'obs.exe': { name: 'OBS Studio', category: 'SCREEN_RECORDER', severity: 'high', reason: 'Screen recording / broadcasting tool' },
  'streamlabs obs.exe': { name: 'Streamlabs OBS', category: 'SCREEN_RECORDER', severity: 'high', reason: 'Screen recording software' },
  'bandicam.exe': { name: 'Bandicam', category: 'SCREEN_RECORDER', severity: 'high', reason: 'Screen recorder application' },
  'camtasia.exe': { name: 'Camtasia Studio', category: 'SCREEN_RECORDER', severity: 'high', reason: 'Screen recording / video suite' },
  'camtasiastudio.exe': { name: 'Camtasia Studio', category: 'SCREEN_RECORDER', severity: 'high', reason: 'Screen recording / video suite' },
  'xsplit.broadcaster.exe': { name: 'XSplit Broadcaster', category: 'SCREEN_RECORDER', severity: 'high', reason: 'Screen broadcast application' },
  'fraps.exe': { name: 'Fraps', category: 'SCREEN_RECORDER', severity: 'high', reason: 'Video capture tool' },
  'action.exe': { name: 'Mirillis Action!', category: 'SCREEN_RECORDER', severity: 'high', reason: 'Screen recording software' },
  'snagit32.exe': { name: 'Snagit', category: 'SCREEN_RECORDER', severity: 'high', reason: 'Screen capture tool' },
  'snagit64.exe': { name: 'Snagit', category: 'SCREEN_RECORDER', severity: 'high', reason: 'Screen capture tool' },

  // Network Sniffing & Traffic Analysis
  'wireshark.exe': { name: 'Wireshark', category: 'NETWORK_ANALYSIS', severity: 'critical', reason: 'Packet analyzer and traffic monitor' },
  'fiddler.exe': { name: 'Fiddler Everywhere', category: 'NETWORK_ANALYSIS', severity: 'critical', reason: 'HTTP/HTTPS proxy debugging monitor' },
  'charles.exe': { name: 'Charles Proxy', category: 'NETWORK_ANALYSIS', severity: 'critical', reason: 'Web debugging proxy application' },
  'postman.exe': { name: 'Postman', category: 'NETWORK_ANALYSIS', severity: 'medium', reason: 'API testing platform' },

  // Virtualization & Sandboxes
  'virtualbox.exe': { name: 'VirtualBox', category: 'VIRTUALIZATION', severity: 'critical', reason: 'Virtual machine hypervisor' },
  'virtualboxvm.exe': { name: 'VirtualBox VM', category: 'VIRTUALIZATION', severity: 'critical', reason: 'Virtual machine instance' },
  'vboxservice.exe': { name: 'VirtualBox Guest Service', category: 'VIRTUALIZATION', severity: 'critical', reason: 'VM guest integration service' },
  'vboxtray.exe': { name: 'VirtualBox Tray', category: 'VIRTUALIZATION', severity: 'critical', reason: 'VM integration tray' },
  'vmware.exe': { name: 'VMware Workstation', category: 'VIRTUALIZATION', severity: 'critical', reason: 'Virtual machine hypervisor' },
  'vmware-tray.exe': { name: 'VMware Tray', category: 'VIRTUALIZATION', severity: 'critical', reason: 'VMware background tool' },
  'vmtoolsd.exe': { name: 'VMware Tools Daemon', category: 'VIRTUALIZATION', severity: 'critical', reason: 'Virtual machine guest daemon' },

  // Communication & Collaboration
  'discord.exe': { name: 'Discord', category: 'COMMUNICATION', severity: 'high', reason: 'VoIP and screen sharing communication client' },
  'slack.exe': { name: 'Slack', category: 'COMMUNICATION', severity: 'high', reason: 'Messaging and collaboration software' },
  'telegram.exe': { name: 'Telegram Desktop', category: 'COMMUNICATION', severity: 'high', reason: 'Messaging application' },
  'whatsapp.exe': { name: 'WhatsApp Desktop', category: 'COMMUNICATION', severity: 'high', reason: 'Messaging application' },
  'skype.exe': { name: 'Skype', category: 'COMMUNICATION', severity: 'high', reason: 'Video and audio call software' },
  'zoom.exe': { name: 'Zoom', category: 'COMMUNICATION', severity: 'high', reason: 'Video conferencing platform' },
  'teams.exe': { name: 'Microsoft Teams', category: 'COMMUNICATION', severity: 'high', reason: 'Video call and chat software' }
};

// 4. Non-Essential Desktop User Applications (Recommended to close before exam)
export const NON_ESSENTIAL_USER_APPS = new Set([
  'chrome.exe',
  'msedge.exe',
  'firefox.exe',
  'opera.exe',
  'brave.exe',
  'spotify.exe',
  'notepad.exe',
  'notepad++.exe',
  'code.exe',
  'steam.exe',
  'epicgameslauncher.exe',
  'vlc.exe',
  'wordpad.exe',
  'winword.exe',
  'excel.exe',
  'powerpnt.exe',
  'calculatorapp.exe',
  'calculator.exe',
  'thunderbird.exe',
  'outlook.exe'
]);

// 5. Human-Readable Friendly Names for System & Common Desktop Software
export const FRIENDLY_PROCESS_NAMES = {
  'system': 'Windows System Kernel',
  'system idle process': 'System Idle Process',
  'registry': 'Windows Registry Subsystem',
  'smss.exe': 'Session Manager Subsystem',
  'csrss.exe': 'Client Server Runtime Subsystem',
  'wininit.exe': 'Windows Initialization',
  'winlogon.exe': 'Windows Logon Process',
  'services.exe': 'Windows Services Controller',
  'lsass.exe': 'Local Security Authority Subsystem',
  'svchost.exe': 'Host Process for Windows Services',
  'fontdrvhost.exe': 'Usermode Font Driver Host',
  'dwm.exe': 'Desktop Window Manager',
  'explorer.exe': 'Windows Explorer Shell',
  'sihost.exe': 'Shell Infrastructure Host',
  'taskhostw.exe': 'Host Process for Windows Tasks',
  'spoolsv.exe': 'Print Spooler Service',
  'audiodg.exe': 'Windows Audio Device Graph',
  'ctfmon.exe': 'CTF Loader (Input Language)',
  'smartscreen.exe': 'Windows Defender SmartScreen',
  'msmpeng.exe': 'Microsoft Defender Antivirus',
  'searchhost.exe': 'Windows Search Host',
  'runtimebroker.exe': 'Runtime Broker',
  'conhost.exe': 'Console Window Host',
  'startmenuexperiencehost.exe': 'Start Menu Experience Host',
  'shellexperiencehost.exe': 'Windows Shell Experience Host',
  'textinputhost.exe': 'Windows Text Input Host',
  'wlanext.exe': 'Windows Wireless LAN Extensibility',
  'vigilexam.exe': 'VigilExam Secure Desktop',
  'electron.exe': 'Electron Desktop Runtime',
  'node.exe': 'Node.js Engine',
  'powershell.exe': 'Windows PowerShell',
  'cmd.exe': 'Command Prompt',
  'git.exe': 'Git Source Control',
  'chrome.exe': 'Google Chrome Browser',
  'msedge.exe': 'Microsoft Edge Browser',
  'firefox.exe': 'Mozilla Firefox Browser',
  'brave.exe': 'Brave Browser',
  'opera.exe': 'Opera Browser',
  'spotify.exe': 'Spotify Music Player',
  'code.exe': 'Visual Studio Code',
  'notepad.exe': 'Windows Notepad',
  'notepad++.exe': 'Notepad++',
  'steam.exe': 'Steam Client',
  'epicgameslauncher.exe': 'Epic Games Launcher',
  'vlc.exe': 'VLC Media Player',
  'winword.exe': 'Microsoft Word',
  'excel.exe': 'Microsoft Excel',
  'powerpnt.exe': 'Microsoft PowerPoint',
  'outlook.exe': 'Microsoft Outlook',
  'calculator.exe': 'Calculator',
  'calculatorapp.exe': 'Calculator',
  'whatsapp.exe': 'WhatsApp Desktop',
  'whatsapp.root.exe': 'WhatsApp Desktop',
  'telegram.exe': 'Telegram Desktop'
};

export function getProcessDisplayName(exeName, rawName = '') {
  const norm = (exeName || '').toLowerCase().trim();
  if (PROHIBITED_PROCESSES_MAP[norm]) {
    return PROHIBITED_PROCESSES_MAP[norm].name;
  }
  if (FRIENDLY_PROCESS_NAMES[norm]) {
    return FRIENDLY_PROCESS_NAMES[norm];
  }
  const clean = (rawName || norm).replace(/\.exe$/i, '').trim();
  // Capitalize words
  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
}

// 6. Default Security Policy
export const DEFAULT_EXAM_POLICY = {
  strict_kiosk: true,
  single_display_only: true,
  process_cleanup: true,
  continuous_process_monitoring: true,
  process_monitor_interval_ms: 1500,
  ai_camera_proctoring: true,
  ai_face_detection_required: true,
  single_face_mandatory: true,
  max_tab_switches: 2,
  auto_terminate_on_critical: false,
  clipboard: {
    copy: false,
    paste: false,
    cut: false,
    context_menu: false,
    drag_drop: false,
    clear_on_start: true,
    clear_on_end: true,
    log_attempts: true
  }
};
