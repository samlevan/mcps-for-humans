const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const store = new Store();

let mainWindow;

function createWindow() {
  // Get screen dimensions
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  // Calculate window dimensions
  const windowWidth = Math.min(780, screenWidth * 0.5); // 780px max, or 50% of screen width
  const windowHeight = screenHeight - 100; // Full height minus some padding for dock/taskbar
  
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();
  
  // Setup auto-updater
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

// Get default MCP config path
function getDefaultConfigPath() {
  const platform = process.platform;
  const homeDir = os.homedir();
  
  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
  } else {
    return path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json');
  }
}

// Check if Claude Desktop is installed
async function checkClaudeInstalled() {
  const platform = process.platform;
  
  try {
    if (platform === 'darwin') {
      // macOS: Check for Claude.app in Applications
      try {
        await fs.access('/Applications/Claude.app');
        return true;
      } catch {
        // Also check user Applications
        try {
          await fs.access(path.join(os.homedir(), 'Applications', 'Claude.app'));
          return true;
        } catch {
          return false;
        }
      }
    } else if (platform === 'win32') {
      // Windows: Check common installation paths
      const possiblePaths = [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'claude-desktop'),
        path.join(process.env.PROGRAMFILES || '', 'Claude'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'Claude')
      ];
      
      for (const checkPath of possiblePaths) {
        try {
          await fs.access(checkPath);
          return true;
        } catch {
          continue;
        }
      }
      
      // Also check if Claude is in the registry (more reliable)
      try {
        await execAsync('reg query "HKEY_CURRENT_USER\\Software\\Claude" /ve');
        return true;
      } catch {
        return false;
      }
    } else {
      // Linux: Check common installation paths
      const possiblePaths = [
        '/usr/bin/claude',
        '/usr/local/bin/claude',
        path.join(os.homedir(), '.local', 'share', 'applications', 'claude.desktop'),
        '/opt/Claude'
      ];
      
      for (const checkPath of possiblePaths) {
        try {
          await fs.access(checkPath);
          return true;
        } catch {
          continue;
        }
      }
      return false;
    }
  } catch (error) {
    console.error('Error checking Claude installation:', error);
    return false;
  }
}

// IPC handlers
ipcMain.handle('get-default-config-path', () => {
  return getDefaultConfigPath();
});

ipcMain.handle('check-claude-installed', async () => {
  return await checkClaudeInstalled();
});

ipcMain.handle('load-config', async (event, filePath) => {
  try {
    const configPath = filePath || getDefaultConfigPath();
    const data = await fs.readFile(configPath, 'utf8');
    return { success: true, data: JSON.parse(data), path: configPath };
  } catch (error) {
    // Check if it's a file not found error
    if (error.code === 'ENOENT') {
      return { success: false, error: error.message, errorType: 'FILE_NOT_FOUND' };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-default-config', async () => {
  try {
    const configPath = getDefaultConfigPath();
    const configDir = path.dirname(configPath);
    
    // Create directory if it doesn't exist
    await fs.mkdir(configDir, { recursive: true });
    
    // Create a minimal default config
    const defaultConfig = {
      mcpServers: {},
      disabledMcpServers: {}
    };
    
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
    
    return { success: true, path: configPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-config', async (event, filePath, config) => {
  try {
    await fs.writeFile(filePath, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, filePath: result.filePaths[0] };
  }
  return { success: false };
});

ipcMain.handle('save-file-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'claude_desktop_config.json',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePath) {
    return { success: true, filePath: result.filePath };
  }
  return { success: false };
});

// Open containing folder
ipcMain.handle('open-containing-folder', async (event, filePath) => {
  try {
    const { shell } = require('electron');
    await shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open external link in default browser
ipcMain.handle('open-external-link', async (event, url) => {
  try {
    const { shell } = require('electron');
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get user preferences
ipcMain.handle('get-preferences', () => {
  return {
    configPath: store.get('configPath')
  };
});

// Set user preferences
ipcMain.handle('set-preferences', (event, preferences) => {
  Object.entries(preferences).forEach(([key, value]) => {
    store.set(key, value);
  });
  return { success: true };
});

// Check if file exists
ipcMain.handle('check-file-exists', async (event, filePath) => {
  try {
    await fs.access(filePath);
    return { exists: true };
  } catch {
    return { exists: false };
  }
});

// Create backup
ipcMain.handle('create-backup', async (event, filePath) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(path.dirname(filePath), '.mcp-config-backups');
    const backupPath = path.join(backupDir, `backup-${timestamp}.json`);
    
    // Create backup directory if it doesn't exist
    await fs.mkdir(backupDir, { recursive: true });
    
    // Copy current config to backup
    const configData = await fs.readFile(filePath, 'utf8');
    await fs.writeFile(backupPath, configData);
    
    // Clean up old backups (keep last 10)
    const backups = await fs.readdir(backupDir);
    const sortedBackups = backups
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (sortedBackups.length > 10) {
      for (const oldBackup of sortedBackups.slice(10)) {
        await fs.unlink(path.join(backupDir, oldBackup));
      }
    }
    
    return { success: true, backupPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get backup list
ipcMain.handle('get-backups', async (event, filePath) => {
  try {
    const backupDir = path.join(path.dirname(filePath), '.mcp-config-backups');
    const files = await fs.readdir(backupDir);
    const backups = await Promise.all(
      files
        .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
        .map(async (file) => {
          const stats = await fs.stat(path.join(backupDir, file));
          return {
            filename: file,
            path: path.join(backupDir, file),
            timestamp: stats.mtime
          };
        })
    );
    
    return {
      success: true,
      backups: backups.sort((a, b) => b.timestamp - a.timestamp)
    };
  } catch (error) {
    return { success: false, backups: [] };
  }
});

// Restore from backup
ipcMain.handle('restore-backup', async (event, backupPath, targetPath) => {
  try {
    const backupData = await fs.readFile(backupPath, 'utf8');
    await fs.writeFile(targetPath, backupData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Dependency checking functionality

// Define known dependencies and their check commands
const DEPENDENCIES = {
  npx: {
    name: 'npx',
    description: 'Node Package Runner',
    checkCommand: 'npx --version',
    requiredBy: [],
    platforms: {
      win32: {
        installMethods: [
          {
            name: 'Node.js Installer',
            description: 'Download and install Node.js (includes npx)',
            url: 'https://nodejs.org/en/download/',
            estimatedTime: '5-10 minutes'
          },
          {
            name: 'winget',
            description: 'Install via Windows Package Manager',
            command: 'winget install OpenJS.NodeJS',
            estimatedTime: '3-5 minutes'
          }
        ]
      },
      darwin: {
        installMethods: [
          {
            name: 'Homebrew',
            description: 'Install via Homebrew package manager',
            command: 'brew install node',
            estimatedTime: '3-5 minutes'
          },
          {
            name: 'Node.js Installer',
            description: 'Download and install Node.js (includes npx)',
            url: 'https://nodejs.org/en/download/',
            estimatedTime: '5-10 minutes'
          }
        ]
      },
      linux: {
        installMethods: [
          {
            name: 'apt (Ubuntu/Debian)',
            description: 'Install via apt package manager',
            command: 'sudo apt update && sudo apt install nodejs npm',
            estimatedTime: '2-3 minutes'
          },
          {
            name: 'yum (CentOS/RHEL)',
            description: 'Install via yum package manager',
            command: 'sudo yum install nodejs npm',
            estimatedTime: '2-3 minutes'
          },
          {
            name: 'Node.js Installer',
            description: 'Download and install Node.js (includes npx)',
            url: 'https://nodejs.org/en/download/',
            estimatedTime: '5-10 minutes'
          }
        ]
      }
    }
  },
  uvx: {
    name: 'uvx',
    description: 'Python Package Runner',
    checkCommand: 'uvx --version',
    requiredBy: [],
    platforms: {
      win32: {
        installMethods: [
          {
            name: 'pip',
            description: 'Install via pip (requires Python)',
            command: 'pip install uvx',
            estimatedTime: '1-2 minutes'
          },
          {
            name: 'pipx',
            description: 'Install via pipx (isolated environment)',
            command: 'pipx install uvx',
            estimatedTime: '1-2 minutes'
          }
        ]
      },
      darwin: {
        installMethods: [
          {
            name: 'pip',
            description: 'Install via pip (requires Python)',
            command: 'pip install uvx',
            estimatedTime: '1-2 minutes'
          },
          {
            name: 'pipx',
            description: 'Install via pipx (isolated environment)',
            command: 'pipx install uvx',
            estimatedTime: '1-2 minutes'
          }
        ]
      },
      linux: {
        installMethods: [
          {
            name: 'pip',
            description: 'Install via pip (requires Python)',
            command: 'pip install uvx',
            estimatedTime: '1-2 minutes'
          },
          {
            name: 'pipx',
            description: 'Install via pipx (isolated environment)',
            command: 'pipx install uvx',
            estimatedTime: '1-2 minutes'
          }
        ]
      }
    }
  },
  node: {
    name: 'node',
    description: 'Node.js Runtime',
    checkCommand: 'node --version',
    requiredBy: [],
    platforms: {
      win32: {
        installMethods: [
          {
            name: 'Node.js Installer',
            description: 'Download and install Node.js',
            url: 'https://nodejs.org/en/download/',
            estimatedTime: '5-10 minutes'
          },
          {
            name: 'winget',
            description: 'Install via Windows Package Manager',
            command: 'winget install OpenJS.NodeJS',
            estimatedTime: '3-5 minutes'
          }
        ]
      },
      darwin: {
        installMethods: [
          {
            name: 'Homebrew',
            description: 'Install via Homebrew package manager',
            command: 'brew install node',
            estimatedTime: '3-5 minutes'
          },
          {
            name: 'Node.js Installer',
            description: 'Download and install Node.js',
            url: 'https://nodejs.org/en/download/',
            estimatedTime: '5-10 minutes'
          }
        ]
      },
      linux: {
        installMethods: [
          {
            name: 'apt (Ubuntu/Debian)',
            description: 'Install via apt package manager',
            command: 'sudo apt update && sudo apt install nodejs',
            estimatedTime: '2-3 minutes'
          },
          {
            name: 'yum (CentOS/RHEL)',
            description: 'Install via yum package manager',
            command: 'sudo yum install nodejs',
            estimatedTime: '2-3 minutes'
          }
        ]
      }
    }
  },
  python: {
    name: 'python',
    description: 'Python Runtime',
    checkCommand: 'python --version',
    alternativeCommands: ['python3 --version'],
    requiredBy: [],
    platforms: {
      win32: {
        installMethods: [
          {
            name: 'Python Installer',
            description: 'Download and install Python',
            url: 'https://www.python.org/downloads/',
            estimatedTime: '5-10 minutes'
          },
          {
            name: 'Microsoft Store',
            description: 'Install Python from Microsoft Store',
            command: 'ms-windows-store://pdp/?ProductId=9NRWMJP3717K',
            estimatedTime: '3-5 minutes'
          }
        ]
      },
      darwin: {
        installMethods: [
          {
            name: 'Homebrew',
            description: 'Install via Homebrew package manager',
            command: 'brew install python',
            estimatedTime: '3-5 minutes'
          },
          {
            name: 'Python Installer',
            description: 'Download and install Python',
            url: 'https://www.python.org/downloads/',
            estimatedTime: '5-10 minutes'
          }
        ]
      },
      linux: {
        installMethods: [
          {
            name: 'apt (Ubuntu/Debian)',
            description: 'Install via apt package manager',
            command: 'sudo apt update && sudo apt install python3',
            estimatedTime: '2-3 minutes'
          },
          {
            name: 'yum (CentOS/RHEL)',
            description: 'Install via yum package manager',
            command: 'sudo yum install python3',
            estimatedTime: '2-3 minutes'
          }
        ]
      }
    }
  }
};

async function checkDependency(depKey, depInfo) {
  const result = {
    name: depKey,
    available: false,
    version: null,
    error: null
  };

  // Get the user's shell
  const shell = process.env.SHELL || '/bin/bash';

  try {
    // Try primary command through the user's shell
    const { stdout } = await execAsync(`${shell} -l -c "${depInfo.checkCommand}"`);
    result.available = true;
    result.version = stdout.trim();
    return result;
  } catch (error) {
    // Try alternative commands if available
    if (depInfo.alternativeCommands) {
      for (const altCommand of depInfo.alternativeCommands) {
        try {
          const { stdout } = await execAsync(`${shell} -l -c "${altCommand}"`);
          result.available = true;
          result.version = stdout.trim();
          return result;
        } catch (altError) {
          // Continue to next alternative
        }
      }
    }
    
    result.error = error.message;
    return result;
  }
}

function extractDependenciesFromConfig(config) {
  const dependencies = new Set();
  
  // Check mcpServers
  if (config.mcpServers) {
    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      if (serverConfig.command) {
        const command = serverConfig.command.toLowerCase();
        
        // Map commands to dependencies
        if (command === 'npx' || command.includes('npx')) {
          dependencies.add('npx');
        } else if (command === 'uvx' || command.includes('uvx')) {
          dependencies.add('uvx');
        } else if (command === 'node' || command.includes('node')) {
          dependencies.add('node');
        } else if (command === 'python' || command === 'python3' || command.includes('python')) {
          dependencies.add('python');
        }
        
        // Update requiredBy lists
        if (DEPENDENCIES[command]) {
          if (!DEPENDENCIES[command].requiredBy.includes(serverName)) {
            DEPENDENCIES[command].requiredBy.push(serverName);
          }
        }
      }
    }
  }
  
  // Check disabledMcpServers too
  if (config.disabledMcpServers) {
    for (const [serverName, serverConfig] of Object.entries(config.disabledMcpServers)) {
      if (serverConfig.command) {
        const command = serverConfig.command.toLowerCase();
        
        if (command === 'npx' || command.includes('npx')) {
          dependencies.add('npx');
        } else if (command === 'uvx' || command.includes('uvx')) {
          dependencies.add('uvx');
        } else if (command === 'node' || command.includes('node')) {
          dependencies.add('node');
        } else if (command === 'python' || command === 'python3' || command.includes('python')) {
          dependencies.add('python');
        }
        
        if (DEPENDENCIES[command]) {
          if (!DEPENDENCIES[command].requiredBy.includes(`${serverName} (disabled)`)) {
            DEPENDENCIES[command].requiredBy.push(`${serverName} (disabled)`);
          }
        }
      }
    }
  }
  
  return Array.from(dependencies);
}

ipcMain.handle('check-dependencies', async (event, config = null) => {
  try {
    // Reset requiredBy lists
    Object.values(DEPENDENCIES).forEach(dep => {
      dep.requiredBy = [];
    });
    
    // Extract dependencies from config if provided
    let requiredDependencies = [];
    if (config) {
      requiredDependencies = extractDependenciesFromConfig(config);
    }
    
    // Check all known dependencies
    const results = {};
    const checkPromises = Object.entries(DEPENDENCIES).map(async ([key, depInfo]) => {
      const result = await checkDependency(key, depInfo);
      result.required = requiredDependencies.includes(key);
      result.description = depInfo.description;
      result.requiredBy = depInfo.requiredBy;
      results[key] = result;
    });
    
    await Promise.all(checkPromises);
    
    // Calculate overall status
    const required = Object.values(results).filter(r => r.required);
    const requiredMissing = required.filter(r => !r.available);
    const allMissing = Object.values(results).filter(r => !r.available);
    
    let overallStatus = 'ok';
    if (requiredMissing.length > 0) {
      overallStatus = 'error';
    } else if (allMissing.length > 0) {
      overallStatus = 'warning';
    }
    
    return {
      success: true,
      results,
      overallStatus,
      summary: {
        total: Object.keys(results).length,
        available: Object.values(results).filter(r => r.available).length,
        required: required.length,
        requiredMissing: requiredMissing.length
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-dependency-instructions', async (event, dependencyName) => {
  try {
    const dep = DEPENDENCIES[dependencyName];
    if (!dep) {
      return { success: false, error: 'Unknown dependency' };
    }
    
    const platform = process.platform;
    const instructions = dep.platforms[platform] || dep.platforms.linux; // Fallback to linux
    
    return {
      success: true,
      dependency: dep,
      platform: platform,
      instructions: instructions
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-single-dependency', async (event, command) => {
  try {
    // Try to determine which dependency this command maps to
    const commandLower = command.toLowerCase();
    let depKey = null;
    
    if (commandLower === 'npx' || commandLower.includes('npx')) {
      depKey = 'npx';
    } else if (commandLower === 'uvx' || commandLower.includes('uvx')) {
      depKey = 'uvx';
    } else if (commandLower === 'node' || commandLower.includes('node')) {
      depKey = 'node';
    } else if (commandLower === 'python' || commandLower === 'python3' || commandLower.includes('python')) {
      depKey = 'python';
    }
    
    if (!depKey || !DEPENDENCIES[depKey]) {
      // Try to check the command directly through the user's shell
      const shell = process.env.SHELL || '/bin/bash';
      try {
        await execAsync(`${shell} -l -c "${command} --version"`);
        return { success: true, available: true, dependency: null };
      } catch {
        return { success: true, available: false, dependency: null };
      }
    }
    
    const result = await checkDependency(depKey, DEPENDENCIES[depKey]);
    result.dependency = DEPENDENCIES[depKey];
    
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Helper function to get Claude Desktop's PATH
function getClaudeDesktopPath() {
  const platform = process.platform;
  const homeDir = os.homedir();
  const basePath = process.env.PATH || '';
  const pathSeparator = platform === 'win32' ? ';' : ':';
  
  // Start with current PATH
  const paths = basePath.split(pathSeparator);
  
  // Add Claude Desktop's known search paths based on platform
  if (platform === 'darwin') {
    // macOS paths
    paths.push(
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/opt/local/bin',
      path.join(homeDir, '.local/bin'),
      path.join(homeDir, 'bin')
    );
    
    // Add nvm paths if they exist
    const nvmDir = path.join(homeDir, '.nvm/versions/node');
    try {
      const fsSync = require('fs');
      const nvmVersions = fsSync.readdirSync(nvmDir);
      nvmVersions.forEach(version => {
        paths.push(path.join(nvmDir, version, 'bin'));
      });
    } catch (error) {
      // nvm not installed or accessible
    }
  } else if (platform === 'win32') {
    // Windows paths
    paths.push(
      'C:\\Program Files\\nodejs',
      'C:\\Program Files (x86)\\nodejs',
      path.join(process.env.APPDATA || '', 'npm'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs\\Python\\Python39\\Scripts'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs\\Python\\Python310\\Scripts'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs\\Python\\Python311\\Scripts')
    );
  } else {
    // Linux paths
    paths.push(
      '/usr/local/bin',
      '/opt/local/bin',
      path.join(homeDir, '.local/bin'),
      path.join(homeDir, 'bin'),
      '/snap/bin'
    );
  }
  
  // Remove duplicates and non-existent paths
  const uniquePaths = [...new Set(paths)];
  return uniquePaths.join(pathSeparator);
}

// Helper function to detect Claude compatibility issues
function getClaudeWarning(command) {
  const commandLower = command.toLowerCase();
  
  // Only warn about commands that Claude truly cannot handle
  const problematicCommands = {
    'nvm': 'Claude Desktop cannot use nvm directly. Commands that require nvm will fail.'
  };
  
  // Check if command starts with any problematic command
  for (const [cmd, warning] of Object.entries(problematicCommands)) {
    if (commandLower === cmd || commandLower.startsWith(cmd + ' ')) {
      return warning;
    }
  }
  
  // Check for home directory shortcut
  if (command.startsWith('~')) {
    return 'Claude Desktop may not expand ~ to your home directory. Use the full path instead.';
  }
  
  return null;
}

// Test server configuration
ipcMain.handle('test-server-config', async (event, config) => {
  const startTime = Date.now();
  let testProcess = null;
  
  try {
    // Validate config
    if (!config.command) {
      return { 
        success: false, 
        message: 'Command is required',
        duration: Date.now() - startTime
      };
    }

    // Prepare command and arguments
    const command = config.command;
    const args = config.args || [];
    
    // Check for Claude compatibility issues
    const claudeWarning = getClaudeWarning(command);

    // Create test promise with timeout
    const testPromise = new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      
      // Get Claude Desktop's augmented PATH
      const claudePath = getClaudeDesktopPath();
      
      // Create environment with Claude's PATH
      const testEnv = config.env ? { ...process.env, ...config.env } : { ...process.env };
      testEnv.PATH = claudePath;
      
      // Use direct spawn without shell wrapper to match Claude's execution method
      testProcess = spawn(command, args, {
        env: testEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,  // Direct execution, no shell
        detached: false
      });

      let stdout = '';
      let stderr = '';
      let resolved = false;
      
      // Collect output
      testProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      testProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle successful startup
      testProcess.on('spawn', () => {
        // Give the server a moment to initialize
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            
            // Try to kill the process gracefully
            try {
              testProcess.kill('SIGTERM');
              setTimeout(() => {
                if (!testProcess.killed) {
                  testProcess.kill('SIGKILL');
                }
              }, 1000);
            } catch (killError) {
              console.warn('Error killing test process:', killError);
            }
            
            const result = {
              success: true,
              message: 'Command works on your system',
              stdout: stdout.slice(-2000), // Last 2000 chars
              stderr: stderr.slice(-2000),
              duration: Date.now() - startTime
            };
            
            // Add Claude warning if applicable
            if (claudeWarning) {
              result.warning = claudeWarning;
            }
            
            resolve(result);
          }
        }, 2000); // Wait 2 seconds for server to initialize
      });

      // Handle process errors
      testProcess.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          
          let message = 'Command failed';
          let hint = 'Check the command and arguments';
          
          if (error.code === 'ENOENT') {
            message = `Command failed: ${error.message}`;
            hint = 'Check that the command is installed and in your PATH';
            
            // Provide more specific hints for common commands
            const cmdLower = command.toLowerCase();
            if (cmdLower === 'npx' || cmdLower === 'npm') {
              hint = 'Install Node.js from https://nodejs.org or check your PATH';
            } else if (cmdLower === 'python' || cmdLower === 'python3') {
              hint = 'Install Python from https://python.org or check your PATH';
            }
          } else if (error.code === 'EACCES') {
            message = 'Command failed: Permission denied';
            hint = 'Check file permissions or try running with appropriate privileges';
          } else if (error.code === 'ETIMEDOUT') {
            message = 'Command failed: Timeout';
            hint = 'The command took too long to respond';
          }
          
          reject({
            success: false,
            message: message,
            hint: hint,
            stdout: stdout,
            stderr: stderr,
            duration: Date.now() - startTime
          });
        }
      });

      // Handle process exit
      testProcess.on('exit', (code, signal) => {
        if (!resolved) {
          resolved = true;
          
          if (code === 0) {
            const result = {
              success: true,
              message: 'Command works on your system',
              stdout: stdout,
              stderr: stderr,
              duration: Date.now() - startTime
            };
            
            // Add Claude warning if applicable
            if (claudeWarning) {
              result.warning = claudeWarning;
            }
            
            resolve(result);
          } else {
            let message = `Command failed: Exited with code ${code}`;
            let hint = 'Check the output for more details';
            
            // Analyze stderr for common errors
            const stderrLower = stderr.toLowerCase();
            if (stderrLower.includes('not found') || stderrLower.includes('no such file')) {
              message = 'Command failed: File or module not found';
              hint = 'Check if all file paths in the configuration exist';
            } else if (stderrLower.includes('permission denied')) {
              message = 'Command failed: Permission denied';
              hint = 'Check file permissions or run with appropriate privileges';
            } else if (stderrLower.includes('module not found') || stderrLower.includes('package not found')) {
              message = 'Command failed: Missing dependencies';
              hint = 'Install missing packages or check your package installation';
            } else if (stderrLower.includes('syntax error') || stderrLower.includes('syntaxerror')) {
              message = 'Command failed: Syntax error';
              hint = 'Check the command syntax and arguments';
            }
            
            reject({
              success: false,
              message: message,
              hint: hint,
              stdout: stdout,
              stderr: stderr,
              exitCode: code,
              duration: Date.now() - startTime
            });
          }
        }
      });
    });

    // Add timeout (5 seconds as per requirements)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        if (testProcess && !testProcess.killed) {
          try {
            testProcess.kill('SIGKILL');
          } catch (error) {
            console.warn('Error killing timed out process:', error);
          }
        }
        reject({
          success: false,
          message: 'Command failed: Timeout after 5 seconds',
          hint: 'The command may be taking too long to start or may require user input',
          duration: 5000
        });
      }, 5000);
    });

    // Race between test completion and timeout
    return await Promise.race([testPromise, timeoutPromise]);

  } catch (error) {
    // Cleanup
    if (testProcess && !testProcess.killed) {
      try {
        testProcess.kill('SIGKILL');
      } catch (killError) {
        console.warn('Error killing process in catch block:', killError);
      }
    }
    
    // Return the error object if it's already formatted
    if (error.success === false) {
      return error;
    }
    
    return {
      success: false,
      message: error.message || 'Unknown error occurred during test',
      hint: 'Please check your configuration and try again',
      duration: Date.now() - startTime
    };
  }
});

// Auto-updater setup
function setupAutoUpdater() {
  // Configure auto-updater
  autoUpdater.checkForUpdatesAndNotify();
  
  // Log updater events for debugging
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
  });
  
  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info);
  });
  
  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available.');
  });
  
  autoUpdater.on('error', (err) => {
    console.error('Error in auto-updater:', err);
  });
  
  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);
    
    // Send download progress to renderer
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', progressObj);
    }
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded');
    
    // Show dialog to user
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded. Restart the app to apply the update.',
      buttons: ['Restart Now', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });
  
  // Check for updates every hour
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 60 * 60 * 1000);
}

// IPC handlers for update status
ipcMain.handle('check-for-updates', async () => {
  return autoUpdater.checkForUpdatesAndNotify();
});

ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});