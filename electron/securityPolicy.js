/**
 * VigilExam - Central Security Policy & Process Rules
 * 
 * Contains immutable system process protection lists, categorized prohibited applications,
 * environment-aware development exceptions, path/metadata classifiers, and baseline exam rules.
 */

// ==============================================================================
// 1. CONFIGURABLE ENVIRONMENT POLICIES & DEVELOPMENT EXCEPTION FLAGS
// ==============================================================================

/**
 * When enabled, Visual Studio Code (Code.exe) is explicitly classified as an allowed
 * development tool and will not block exam entry or be terminated.
 * Configurable via process.env.ALLOW_VSCODE_DURING_DEVELOPMENT.
 */
export const ALLOW_VSCODE_DURING_DEVELOPMENT = (process.env.ALLOW_VSCODE_DURING_DEVELOPMENT !== 'false');

/**
 * When enabled, general background processes and non-essential applications
 * are permitted to run and will not block exam entry or be forcefully terminated.
 * Configurable via process.env.ALLOW_BACKGROUND_PROCESSES.
 */
export const ALLOW_BACKGROUND_PROCESSES = (process.env.ALLOW_BACKGROUND_PROCESSES !== 'false');

export const SECURITY_ENVIRONMENT_CONFIG = {
  development: {
    allowVSCode: true,
    allowedSupportProcesses: [
      'code.exe',
      'node.exe',
      'npm.exe',
      'electron.exe',
      'git.exe',
      'powershell.exe',
      'cmd.exe'
    ]
  },
  production: {
    allowVSCode: false,
    allowedSupportProcesses: [
      'vigilexam.exe'
    ]
  }
};

/**
 * Browser Policy configuration for strict exams.
 * Note: A native OS process scanner enumerating Chrome, Edge, or Firefox cannot
 * identify specific web domains or visited AI websites (such as ChatGPT, Claude, or Gemini).
 * Website restriction is enforced via Kiosk URL lockdown & network policies.
 */
export const BROWSER_POLICY_OPTIONS = {
  ALLOW: 'allow',
  WARN: 'warn',
  PROHIBIT: 'prohibit'
};

// ==============================================================================
// 2. CRITICAL WINDOWS SYSTEM PROCESSES (NEVER TERMINATE UNDER ANY CIRCUMSTANCE)
// ==============================================================================
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

// ==============================================================================
// 3. VIGILEXAM & RUNTIME PROTECTED PROCESSES (NEVER TERMINATE)
// ==============================================================================
export const VIGILEXAM_PROTECTED_PROCESSES = new Set([
  'vigilexam.exe',
  'electron.exe',
  'node.exe',
  'cmd.exe',
  'powershell.exe',
  'git.exe'
]);

// ==============================================================================
// 4. PROHIBITED APPLICATIONS BY CATEGORY & KNOWN ALIASES
// ==============================================================================
export const PROHIBITED_PROCESSES_MAP = {
  // --- A. Remote Access & Screen Sharing ---
  'anydesk.exe': { name: 'AnyDesk', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote desktop access software' },
  'teamviewer.exe': { name: 'TeamViewer', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote desktop software' },
  'teamviewer_service.exe': { name: 'TeamViewer Service', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote desktop background service' },
  'tv_w32.exe': { name: 'TeamViewer 32-bit Host', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote desktop support host' },
  'tv_x64.exe': { name: 'TeamViewer 64-bit Host', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote desktop support host' },
  
  // UltraViewer aliases
  'ultraviewer.exe': { name: 'UltraViewer', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote desktop support software' },
  'ultraviewer_desktop.exe': { name: 'UltraViewer Desktop', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote desktop support client' },
  'ultraviewer_service.exe': { name: 'UltraViewer Service', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote desktop background service' },
  'ultraviewservice.exe': { name: 'UltraViewer Service', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote desktop background service' },
  
  // RustDesk & Open-Source Remote Tools
  'rustdesk.exe': { name: 'RustDesk', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Open source remote desktop software' },
  'remotedesktop.exe': { name: 'Remote Desktop', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote desktop client' },
  'mstsc.exe': { name: 'Windows Remote Desktop (MSTSC)', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Windows native remote desktop client' },
  'msra.exe': { name: 'Windows Remote Assistance', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Windows remote assistance tool' },
  'rdpclip.exe': { name: 'RDP Clipboard Monitor', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote desktop clipboard synchronizer' },
  
  // VNC Family
  'vnc.exe': { name: 'VNC', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Virtual Network Computing viewer' },
  'vncviewer.exe': { name: 'VNC Viewer', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'VNC remote display client' },
  'tightvnc.exe': { name: 'TightVNC', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'TightVNC remote control tool' },
  'tvnserver.exe': { name: 'TightVNC Server', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'VNC remote desktop server' },
  'tvnviewer.exe': { name: 'TightVNC Viewer', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'TightVNC remote client' },
  'winvnc.exe': { name: 'WinVNC', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'VNC remote desktop server' },
  'vncserver.exe': { name: 'VNC Server', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'VNC remote desktop server' },
  
  // Splashtop, LogMeIn, Parsec, Ammyy, Supremo, Chrome Remote Desktop
  'splashtop.exe': { name: 'Splashtop', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote access software' },
  'srfeature.exe': { name: 'Splashtop Feature Service', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Splashtop remote access service' },
  'strwinclt.exe': { name: 'Splashtop Client', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Splashtop remote client' },
  'logmein.exe': { name: 'LogMeIn', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote desktop application' },
  'lmirfsclientnp.exe': { name: 'LogMeIn Client', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'LogMeIn remote connection' },
  'lmiguardiansvc.exe': { name: 'LogMeIn Guardian Service', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'LogMeIn background service' },
  'parsec.exe': { name: 'Parsec', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Low-latency remote desktop tool' },
  'parsecd.exe': { name: 'Parsec Daemon', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Parsec remote daemon' },
  'ammyy.exe': { name: 'Ammyy Admin', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote desktop software' },
  'supremo.exe': { name: 'Supremo', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote control tool' },
  'remoting_host.exe': { name: 'Chrome Remote Desktop', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Chrome Remote Desktop host' },
  'remoting_me2me_host.exe': { name: 'Chrome Remote Desktop Host', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Chrome Remote Desktop service' },
  'remoting_native_messaging_host.exe': { name: 'Chrome Remote Messaging Host', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Chrome Remote Desktop helper' },
  'aeroadmin.exe': { name: 'AeroAdmin', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote desktop software' },
  'screenconnect.client.exe': { name: 'ConnectWise ScreenConnect', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote support software' },
  'dwagent.exe': { name: 'DWAgent', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'Remote control application' },

  // --- B. Screen Recording & Broadcasting ---
  'obs64.exe': { name: 'OBS Studio (64-bit)', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen recording / broadcasting tool' },
  'obs32.exe': { name: 'OBS Studio (32-bit)', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen recording / broadcasting tool' },
  'obs.exe': { name: 'OBS Studio', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen recording / broadcasting tool' },
  'streamlabs obs.exe': { name: 'Streamlabs OBS', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen recording software' },
  'streamlabs desktop.exe': { name: 'Streamlabs Desktop', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen broadcast application' },
  'streamlabs.exe': { name: 'Streamlabs', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen recording application' },
  'bandicam.exe': { name: 'Bandicam', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen recorder application' },
  'bdcam.exe': { name: 'Bandicam', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen recorder application' },
  'camtasia.exe': { name: 'Camtasia Studio', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen recording / video suite' },
  'camtasiastudio.exe': { name: 'Camtasia Studio', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen recording / video suite' },
  'camtasiarecorder.exe': { name: 'Camtasia Recorder', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen capture tool' },
  'xsplit.broadcaster.exe': { name: 'XSplit Broadcaster', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen broadcast application' },
  'xsplit.gamecaster.exe': { name: 'XSplit Gamecaster', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen capture application' },
  'xsplit.exe': { name: 'XSplit', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen broadcast software' },
  'fraps.exe': { name: 'Fraps', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Video capture tool' },
  'action.exe': { name: 'Mirillis Action!', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen recording software' },
  'snagit32.exe': { name: 'Snagit', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen capture tool' },
  'snagit64.exe': { name: 'Snagit', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen capture tool' },
  'snagit.exe': { name: 'Snagit', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen capture tool' },
  'snagiteditor.exe': { name: 'Snagit Editor', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen capture suite' },
  'sharex.exe': { name: 'ShareX', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen capture and sharing tool' },
  'loom.exe': { name: 'Loom', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen recording software' },
  'debut.exe': { name: 'Debut Video Capture', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Video recording software' },
  'lightshot.exe': { name: 'Lightshot', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen capture utility' },
  'gyazo.exe': { name: 'Gyazo', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Screen capture tool' },

  // --- C. Generative AI Applications & Desktop Clients ---
  'chatgpt.exe': { name: 'ChatGPT Desktop', category: 'GENERATIVE_AI', categoryLabel: 'Generative AI', severity: 'critical', reason: 'ChatGPT AI desktop application client' },
  'chatgpt desktop.exe': { name: 'ChatGPT Desktop', category: 'GENERATIVE_AI', categoryLabel: 'Generative AI', severity: 'critical', reason: 'ChatGPT AI desktop application client' },
  'openai-chatgpt.exe': { name: 'OpenAI ChatGPT', category: 'GENERATIVE_AI', categoryLabel: 'Generative AI', severity: 'critical', reason: 'OpenAI ChatGPT desktop application' },
  'claude.exe': { name: 'Claude Desktop', category: 'GENERATIVE_AI', categoryLabel: 'Generative AI', severity: 'critical', reason: 'Claude AI desktop application client' },
  'claude desktop.exe': { name: 'Claude Desktop', category: 'GENERATIVE_AI', categoryLabel: 'Generative AI', severity: 'critical', reason: 'Claude AI desktop application client' },
  'anthropic-claude.exe': { name: 'Anthropic Claude', category: 'GENERATIVE_AI', categoryLabel: 'Generative AI', severity: 'critical', reason: 'Anthropic Claude desktop client' },
  'gemini.exe': { name: 'Gemini Desktop', category: 'GENERATIVE_AI', categoryLabel: 'Generative AI', severity: 'critical', reason: 'Google Gemini AI desktop application' },
  'google-gemini.exe': { name: 'Google Gemini', category: 'GENERATIVE_AI', categoryLabel: 'Generative AI', severity: 'critical', reason: 'Google Gemini AI application client' },
  'copilot.exe': { name: 'Microsoft Copilot', category: 'GENERATIVE_AI', categoryLabel: 'Generative AI', severity: 'critical', reason: 'Copilot AI assistant desktop application' },
  'microsoftcopilot.exe': { name: 'Microsoft Copilot', category: 'GENERATIVE_AI', categoryLabel: 'Generative AI', severity: 'critical', reason: 'Microsoft Copilot client' },
  'cursor.exe': { name: 'Cursor AI Editor', category: 'GENERATIVE_AI', categoryLabel: 'Generative AI', severity: 'high', reason: 'AI-assisted code development editor' },

  // --- D. AI Assistants, Communication & Collaboration ---
  'discord.exe': { name: 'Discord', category: 'COMMUNICATION', categoryLabel: 'Communication', severity: 'high', reason: 'VoIP and screen sharing communication client' },
  'discordcanary.exe': { name: 'Discord Canary', category: 'COMMUNICATION', categoryLabel: 'Communication', severity: 'high', reason: 'Discord canary communication build' },
  'discordptb.exe': { name: 'Discord PTB', category: 'COMMUNICATION', categoryLabel: 'Communication', severity: 'high', reason: 'Discord public test build' },
  'telegram.exe': { name: 'Telegram Desktop', category: 'COMMUNICATION', categoryLabel: 'Communication', severity: 'high', reason: 'Messaging and file sharing application' },
  'whatsapp.exe': { name: 'WhatsApp Desktop', category: 'COMMUNICATION', categoryLabel: 'Communication', severity: 'high', reason: 'Messaging application' },
  'whatsapp.root.exe': { name: 'WhatsApp Desktop', category: 'COMMUNICATION', categoryLabel: 'Communication', severity: 'high', reason: 'Messaging application' },
  'slack.exe': { name: 'Slack', category: 'COMMUNICATION', categoryLabel: 'Communication', severity: 'high', reason: 'Messaging and collaboration software' },
  'skype.exe': { name: 'Skype', category: 'COMMUNICATION', categoryLabel: 'Communication', severity: 'high', reason: 'Video and audio call software' },
  'zoom.exe': { name: 'Zoom', category: 'COMMUNICATION', categoryLabel: 'Communication', severity: 'high', reason: 'Video conferencing platform' },
  'cptemp.exe': { name: 'Zoom Meeting Helper', category: 'COMMUNICATION', categoryLabel: 'Communication', severity: 'high', reason: 'Zoom meeting helper component' },
  'teams.exe': { name: 'Microsoft Teams', category: 'COMMUNICATION', categoryLabel: 'Communication', severity: 'high', reason: 'Video call and chat software' },
  'msteams.exe': { name: 'Microsoft Teams (New)', category: 'COMMUNICATION', categoryLabel: 'Communication', severity: 'high', reason: 'Microsoft Teams collaboration client' },

  // --- E. Network Sniffing & Traffic Analysis ---
  'wireshark.exe': { name: 'Wireshark', category: 'NETWORK_ANALYSIS', categoryLabel: 'Network Analysis', severity: 'critical', reason: 'Packet analyzer and traffic monitor' },
  'fiddler.exe': { name: 'Fiddler Everywhere', category: 'NETWORK_ANALYSIS', categoryLabel: 'Network Analysis', severity: 'critical', reason: 'HTTP/HTTPS proxy debugging monitor' },
  'charles.exe': { name: 'Charles Proxy', category: 'NETWORK_ANALYSIS', categoryLabel: 'Network Analysis', severity: 'critical', reason: 'Web debugging proxy application' },
  'postman.exe': { name: 'Postman', category: 'NETWORK_ANALYSIS', categoryLabel: 'Network Analysis', severity: 'medium', reason: 'API testing platform' },

  // --- F. Virtualization & Sandboxes ---
  'virtualbox.exe': { name: 'VirtualBox', category: 'VIRTUALIZATION', categoryLabel: 'Virtual Machine', severity: 'critical', reason: 'Virtual machine hypervisor' },
  'virtualboxvm.exe': { name: 'VirtualBox VM', category: 'VIRTUALIZATION', categoryLabel: 'Virtual Machine', severity: 'critical', reason: 'Virtual machine instance' },
  'vboxservice.exe': { name: 'VirtualBox Guest Service', category: 'VIRTUALIZATION', categoryLabel: 'Virtual Machine', severity: 'critical', reason: 'VM guest integration service' },
  'vboxtray.exe': { name: 'VirtualBox Tray', category: 'VIRTUALIZATION', categoryLabel: 'Virtual Machine', severity: 'critical', reason: 'VM integration tray' },
  'vmware.exe': { name: 'VMware Workstation', category: 'VIRTUALIZATION', categoryLabel: 'Virtual Machine', severity: 'critical', reason: 'Virtual machine hypervisor' },
  'vmware-tray.exe': { name: 'VMware Tray', category: 'VIRTUALIZATION', categoryLabel: 'Virtual Machine', severity: 'critical', reason: 'VMware background tool' },
  'vmtoolsd.exe': { name: 'VMware Tools Daemon', category: 'VIRTUALIZATION', categoryLabel: 'Virtual Machine', severity: 'critical', reason: 'Virtual machine guest daemon' },

  // --- G. Code Editors & IDEs (Prohibited during exam unless development exception enabled) ---
  'code.exe': { name: 'Visual Studio Code', category: 'DEVELOPMENT_TOOL', categoryLabel: 'Code Editor', severity: 'high', reason: 'Code editor / IDE prohibited during examination' }
};

// ==============================================================================
// 5. PATH & METADATA-BASED HEURISTIC CLASSIFIERS
// ==============================================================================
export const PATH_BASED_DETECTION_RULES = [
  { pattern: /\\ultraviewer/i, name: 'UltraViewer', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'UltraViewer remote support path detected' },
  { pattern: /\\anydesk/i, name: 'AnyDesk', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'AnyDesk remote control installation path detected' },
  { pattern: /\\teamviewer/i, name: 'TeamViewer', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'TeamViewer remote client path detected' },
  { pattern: /\\rustdesk/i, name: 'RustDesk', category: 'REMOTE_ACCESS', categoryLabel: 'Remote Access', severity: 'critical', reason: 'RustDesk remote desktop software path detected' },
  { pattern: /\\obs-studio/i, name: 'OBS Studio', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'OBS Studio broadcasting software path detected' },
  { pattern: /\\streamlabs/i, name: 'Streamlabs', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Streamlabs broadcasting tool path detected' },
  { pattern: /\\bandicam/i, name: 'Bandicam', category: 'SCREEN_RECORDER', categoryLabel: 'Screen Recording', severity: 'high', reason: 'Bandicam screen recording software path detected' },
  { pattern: /\\chatgpt/i, name: 'ChatGPT Desktop', category: 'GENERATIVE_AI', categoryLabel: 'Generative AI', severity: 'critical', reason: 'ChatGPT AI application path detected' },
  { pattern: /\\claude/i, name: 'Claude Desktop', category: 'GENERATIVE_AI', categoryLabel: 'Generative AI', severity: 'critical', reason: 'Claude AI application path detected' }
];

export function matchProhibitedByPathOrMetadata(pathStr = '', rawName = '') {
  if (!pathStr || pathStr.startsWith('Accessible: No')) {
    return null;
  }
  for (const rule of PATH_BASED_DETECTION_RULES) {
    if (rule.pattern.test(pathStr)) {
      return {
        name: rule.name,
        category: rule.category,
        categoryLabel: rule.categoryLabel,
        severity: rule.severity,
        reason: rule.reason
      };
    }
  }
  return null;
}

// ==============================================================================
// 6. NON-ESSENTIAL DESKTOP USER APPLICATIONS (CLOSE RECOMMENDED BEFORE EXAM)
// ==============================================================================
export const NON_ESSENTIAL_USER_APPS = new Set([
  'chrome.exe',
  'msedge.exe',
  'firefox.exe',
  'opera.exe',
  'brave.exe',
  'spotify.exe',
  'notepad.exe',
  'notepad++.exe',
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

// ==============================================================================
// 7. HUMAN-READABLE FRIENDLY NAMES
// ==============================================================================
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
  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ==============================================================================
// 8. DEFAULT EXAM SECURITY POLICY MATRIX
// ==============================================================================
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
  allow_vscode_dev: true,
  allow_background_processes: true,
  browser_policy: 'warn',
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
