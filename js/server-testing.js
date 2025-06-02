// Server testing functionality

let isTestInProgress = false;
let lastTestResult = null;

// Initialize server testing event listeners
document.addEventListener('DOMContentLoaded', () => {
    const testButton = document.getElementById('testServerBtn');
    if (testButton) {
        testButton.addEventListener('click', testServerConfiguration);
    }
    
    // Add keyboard shortcut Cmd/Ctrl+T
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 't') {
            const serverModal = document.getElementById('serverModal');
            if (serverModal && serverModal.style.display === 'flex') {
                e.preventDefault();
                testServerConfiguration();
            }
        }
    });
});

// Main test function
async function testServerConfiguration() {
    if (isTestInProgress) {
        return; // Prevent multiple simultaneous tests
    }
    
    const testButton = document.getElementById('testServerBtn');
    const testResults = document.getElementById('testResultsPanel');
    const modalBody = document.querySelector('.modal-body');
    const modalFooter = document.querySelector('.modal-footer');
    
    if (!testButton || !testResults) return;
    
    try {
        isTestInProgress = true;
        
        // Get configuration from current form
        const config = getCurrentServerConfig();
        
        if (!config) {
            showTestResult({
                success: false,
                error: 'Please enter a valid server configuration',
                errorType: 'validation',
                duration: 0
            });
            return;
        }
        
        // Update UI to testing state
        setTestingState(true);
        showTestingProgress();
        
        // Call backend test
        const result = await window.api.testServerConfig(config);
        
        // Show results
        showTestResult(result);
        
    } catch (error) {
        console.error('Test error:', error);
        showTestResult({
            success: false,
            error: 'Failed to test server: ' + error.message,
            errorType: 'unknown',
            duration: 0
        });
    } finally {
        isTestInProgress = false;
        setTestingState(false);
    }
}

// Get current server configuration from form
function getCurrentServerConfig() {
    const serverNameInput = document.getElementById('serverName');
    const commandInput = document.getElementById('commandInput');
    const envVarsList = document.getElementById('envVarsList');
    
    if (!serverNameInput || !commandInput) return null;
    
    const name = serverNameInput.value.trim();
    const commandValue = commandInput.value.trim();
    
    if (!name || !commandValue) return null;
    
    // Parse command using the command parser
    let command = '';
    let args = [];
    
    try {
        if (window.commandParser) {
            const parsed = window.commandParser.parseCommandLine(commandValue);
            command = parsed.command;
            args = parsed.args;
        } else {
            // Fallback: simple split
            const parts = commandValue.split(' ');
            command = parts[0];
            args = parts.slice(1);
        }
    } catch (error) {
        console.warn('Command parsing error:', error);
        const parts = commandValue.split(' ');
        command = parts[0];
        args = parts.slice(1);
    }
    
    // Get environment variables
    const env = {};
    if (envVarsList) {
        const envRows = envVarsList.querySelectorAll('.env-var-row');
        envRows.forEach(row => {
            const key = row.querySelector('.env-var-key')?.value.trim();
            const value = row.querySelector('.env-var-value')?.value.trim();
            if (key) {
                env[key] = value;
            }
        });
    }
    
    const config = { command, args };
    if (Object.keys(env).length > 0) {
        config.env = env;
    }
    
    return config;
}

// Set testing state UI
function setTestingState(testing) {
    const testButton = document.getElementById('testServerBtn');
    const buttonText = testButton?.querySelector('.btn-text');
    const buttonSpinner = testButton?.querySelector('.btn-spinner');
    const modalBody = document.querySelector('.modal-body');
    const modalFooter = document.querySelector('.modal-footer');
    
    if (testing) {
        if (buttonText) buttonText.textContent = 'Testing...';
        if (buttonSpinner) buttonSpinner.classList.remove('hidden');
        if (modalBody) modalBody.classList.add('testing');
        if (modalFooter) modalFooter.classList.add('testing');
    } else {
        if (buttonText) buttonText.textContent = 'Test';
        if (buttonSpinner) buttonSpinner.classList.add('hidden');
        if (modalBody) modalBody.classList.remove('testing');
        if (modalFooter) modalFooter.classList.remove('testing');
    }
}

// Show testing progress
function showTestingProgress() {
    const testResults = document.getElementById('testResultsPanel');
    const resultIcon = testResults?.querySelector('.test-result-icon');
    const resultTitle = testResults?.querySelector('.test-result-title');
    const resultTime = testResults?.querySelector('.test-result-time');
    const resultMessage = testResults?.querySelector('.test-result-message');
    const outputDetails = testResults?.querySelector('.test-output-details');
    const resultActions = testResults?.querySelector('.test-result-actions');
    
    if (!testResults) return;
    
    // Show panel with testing state
    testResults.className = 'test-results-panel testing';
    testResults.classList.remove('hidden');
    
    if (resultIcon) resultIcon.textContent = '⟳';
    if (resultTitle) resultTitle.textContent = 'Testing server configuration...';
    if (resultTime) resultTime.textContent = '';
    if (resultMessage) resultMessage.textContent = 'Starting server and checking if it responds correctly.';
    if (outputDetails) outputDetails.classList.add('hidden');
    if (resultActions) resultActions.classList.add('hidden');
}

// Show test results
function showTestResult(result) {
    const testResults = document.getElementById('testResultsPanel');
    const resultIcon = testResults?.querySelector('.test-result-icon');
    const resultTitle = testResults?.querySelector('.test-result-title');
    const resultTime = testResults?.querySelector('.test-result-time');
    const resultMessage = testResults?.querySelector('.test-result-message');
    const outputDetails = testResults?.querySelector('.test-output-details');
    const outputLogs = testResults?.querySelector('.test-output-logs');
    const resultActions = testResults?.querySelector('.test-result-actions');
    
    if (!testResults) return;
    
    lastTestResult = result;
    
    // Set panel state (success with warning shows as warning)
    const panelState = result.success ? (result.warning ? 'warning' : 'success') : 'error';
    testResults.className = `test-results-panel ${panelState}`;
    testResults.classList.remove('hidden');
    
    // Set icon and title
    if (result.success) {
        if (result.warning) {
            if (resultIcon) resultIcon.textContent = '✓';
            if (resultTitle) resultTitle.textContent = 'Command works on your system';
        } else {
            if (resultIcon) resultIcon.textContent = '✅';
            if (resultTitle) resultTitle.textContent = 'Command works on your system';
        }
    } else {
        if (resultIcon) resultIcon.textContent = '✗';
        if (resultTitle) resultTitle.textContent = 'Command failed';
    }
    
    // Set timing
    if (resultTime && result.duration) {
        if (result.duration < 1000) {
            resultTime.textContent = `${result.duration}ms`;
        } else {
            resultTime.textContent = `${(result.duration / 1000).toFixed(1)}s`;
        }
    }
    
    // Set message
    if (resultMessage) {
        if (result.success) {
            let messages = [];
            
            // Main message
            messages.push(result.message || 'Command works on your system');
            
            // Add warning if present
            if (result.warning) {
                messages.push(`\n⚠️ ${result.warning}`);
            }
            
            resultMessage.innerHTML = messages.join('<br>').replace(/\n/g, '<br>');
        } else {
            let messages = [];
            
            // Main error message
            messages.push(result.message || 'Unknown error occurred');
            
            // Add hint if present
            if (result.hint) {
                messages.push(`\n💡 ${result.hint}`);
            }
            
            resultMessage.innerHTML = messages.join('<br>').replace(/\n/g, '<br>');
        }
    }
    
    // Show logs if available
    if (outputDetails && outputLogs && (result.stdout || result.stderr)) {
        const logs = [];
        if (result.stdout && result.stdout.trim()) {
            logs.push('STDOUT:');
            logs.push(result.stdout.trim());
        }
        if (result.stderr && result.stderr.trim()) {
            if (logs.length > 0) logs.push('\n');
            logs.push('STDERR:');
            logs.push(result.stderr.trim());
        }
        
        if (logs.length > 0) {
            outputLogs.textContent = logs.join('\n');
            outputDetails.classList.remove('hidden');
        } else {
            outputDetails.classList.add('hidden');
        }
    } else if (outputDetails) {
        outputDetails.classList.add('hidden');
    }
    
    // Show action buttons for errors
    if (resultActions) {
        if (!result.success) {
            const actions = getErrorActions(result);
            if (actions.length > 0) {
                resultActions.innerHTML = '';
                actions.forEach(action => {
                    const actionBtn = document.createElement('a');
                    actionBtn.className = 'test-action-btn';
                    actionBtn.textContent = action.text;
                    if (action.url) {
                        actionBtn.href = action.url;
                        actionBtn.target = '_blank';
                    } else if (action.onClick) {
                        actionBtn.href = '#';
                        actionBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            action.onClick();
                        });
                    }
                    resultActions.appendChild(actionBtn);
                });
                resultActions.classList.remove('hidden');
            } else {
                resultActions.classList.add('hidden');
            }
        } else {
            resultActions.classList.add('hidden');
        }
    }
    
    // Show toast notification
    if (window.uiUtils && window.uiUtils.showToast) {
        const toastType = result.success ? (result.warning ? 'warning' : 'success') : 'error';
        let toastMessage;
        if (result.success) {
            toastMessage = result.warning ? 'Test passed with warnings' : 'Test passed!';
        } else {
            toastMessage = `Test failed: ${result.message || 'Unknown error'}`;
        }
        window.uiUtils.showToast(toastType, toastMessage);
    }
}

// Get action buttons for error types
function getErrorActions(result) {
    const actions = [];
    
    switch (result.errorType) {
        case 'command_not_found':
            // No install guide action - removed per user request
            break;
            
        case 'file_not_found':
            actions.push({
                text: 'Browse for File',
                onClick: async () => {
                    const result = await window.api.openFileDialog();
                    if (result.success) {
                        // Update the command field with the selected file
                        const commandInput = document.getElementById('commandInput');
                        if (commandInput) {
                            // Replace the file path in the command
                            const parts = commandInput.value.split(' ');
                            parts[parts.length - 1] = result.filePath;
                            commandInput.value = parts.join(' ');
                            if (window.commandParser) {
                                window.commandParser.parseCommand(commandInput.value);
                            }
                        }
                    }
                }
            });
            break;
            
        case 'missing_dependency':
            actions.push({
                text: 'Check Dependencies',
                onClick: () => {
                    if (window.systemDeps && window.systemDeps.showSystemStatusModal) {
                        window.systemDeps.showSystemStatusModal();
                    }
                }
            });
            break;
            
        case 'permission_denied':
            actions.push({
                text: 'Permission Help',
                url: 'https://support.apple.com/guide/terminal/change-permissions-apdd54c2d463/mac'
            });
            break;
    }
    
    return actions;
}

// Hide test results (called when form changes)
function hideTestResults() {
    const testResults = document.getElementById('testResultsPanel');
    if (testResults) {
        testResults.classList.add('hidden');
    }
    lastTestResult = null;
}

// Check if configuration has changed since last test
function hasConfigChangedSinceTest() {
    if (!lastTestResult) return false;
    
    const currentConfig = getCurrentServerConfig();
    if (!currentConfig) return true;
    
    // Simple comparison - in a real app you might want more sophisticated comparison
    const lastConfig = lastTestResult.testedConfig;
    if (!lastConfig) return true;
    
    return JSON.stringify(currentConfig) !== JSON.stringify(lastConfig);
}

// Monitor form changes to hide results
document.addEventListener('DOMContentLoaded', () => {
    // Monitor command input changes
    const commandInput = document.getElementById('commandInput');
    if (commandInput) {
        commandInput.addEventListener('input', () => {
            if (lastTestResult) {
                hideTestResults();
            }
        });
    }
    
    // Monitor server name changes
    const serverNameInput = document.getElementById('serverName');
    if (serverNameInput) {
        serverNameInput.addEventListener('input', () => {
            if (lastTestResult) {
                hideTestResults();
            }
        });
    }
    
    // Monitor environment variable changes
    document.addEventListener('click', (e) => {
        if (e.target.matches('.env-var-key, .env-var-value') || 
            e.target.matches('#addEnvVarBtn')) {
            setTimeout(() => {
                if (lastTestResult) {
                    hideTestResults();
                }
            }, 100);
        }
    });
});

// Export server testing functionality
window.serverTesting = {
    testServerConfiguration,
    getCurrentServerConfig,
    showTestResult,
    hideTestResults,
    hasConfigChangedSinceTest,
    isTestInProgress: () => isTestInProgress,
    getLastTestResult: () => lastTestResult
};