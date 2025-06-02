// System dependencies checking and management

let systemStatus = {
    dependencies: {},
    overallStatus: 'unknown'
};

// Initialize system status check
document.addEventListener('DOMContentLoaded', async () => {
    // Initial dependency check
    await checkSystemDependencies();
    
    // Add refresh button event listener
    document.getElementById('refreshDependenciesBtn')?.addEventListener('click', async () => {
        await checkSystemDependencies();
        updateSystemStatusModal();
    });
    
    // System status button removed from header
    
    // Close system status modal when clicking outside
    document.addEventListener('click', (event) => {
        if (event.target === document.getElementById('systemStatusModal')) {
            hideSystemStatusModal();
        }
    });
});

async function checkSystemDependencies() {
    try {
        const currentConfig = window.core.currentConfig();
        const result = await window.api.checkDependencies(currentConfig);
        if (result.success) {
            systemStatus.dependencies = result.results;
            systemStatus.overallStatus = result.overallStatus;
            systemStatus.summary = result.summary;
            updateSystemStatusIndicator();
        }
    } catch (error) {
        console.error('Failed to check dependencies:', error);
        systemStatus.overallStatus = 'unknown';
        updateSystemStatusIndicator();
    }
}

function updateSystemStatusIndicator() {
    // System status indicator removed from header - no-op function
    // Status can still be checked via the system status modal if needed
}

function showSystemStatusModal() {
    const modal = document.getElementById('systemStatusModal');
    if (modal) {
        modal.style.display = 'flex';
        updateSystemStatusModal();
    }
}

function hideSystemStatusModal() {
    const modal = document.getElementById('systemStatusModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function updateSystemStatusModal() {
    updateSystemStatusSummary();
    updateDependenciesList();
    updateServerReadinessList();
}

function updateSystemStatusSummary() {
    const summaryDiv = document.getElementById('systemStatusSummary');
    const statusOverview = document.querySelector('.system-status-overview');
    
    if (!summaryDiv || !statusOverview) return;
    
    // Remove existing status classes
    statusOverview.classList.remove('status-ok', 'status-warning', 'status-error');
    
    let summaryIcon = '🔄';
    let summaryText = 'Checking system dependencies...';
    
    if (systemStatus.summary) {
        const { available, total, required, requiredMissing } = systemStatus.summary;
        
        switch (systemStatus.overallStatus) {
            case 'ok':
                statusOverview.classList.add('status-ok');
                summaryIcon = '✅';
                summaryText = `All dependencies ready! ${available}/${total} tools available, ${required} required.`;
                break;
            case 'warning':
                statusOverview.classList.add('status-warning');
                summaryIcon = '⚠️';
                summaryText = `${available}/${total} tools available. ${total - available} optional dependencies missing.`;
                break;
            case 'error':
                statusOverview.classList.add('status-error');
                summaryIcon = '❌';
                summaryText = `${requiredMissing} required dependencies missing! ${available}/${total} tools available.`;
                break;
        }
    }
    
    summaryDiv.innerHTML = `
        <div class="status-summary-icon">${summaryIcon}</div>
        <div class="status-summary-text">${summaryText}</div>
    `;
}

function updateDependenciesList() {
    const dependenciesList = document.getElementById('dependenciesList');
    if (!dependenciesList) return;
    
    dependenciesList.innerHTML = '';
    
    for (const [depName, depInfo] of Object.entries(systemStatus.dependencies)) {
        const depDiv = createDependencyItem(depName, depInfo);
        dependenciesList.appendChild(depDiv);
    }
}

function createDependencyItem(depName, depInfo) {
    const div = document.createElement('div');
    let statusClass = 'status-not-required';
    let statusIcon = '⚪';
    
    if (depInfo.available) {
        statusClass = 'status-ok';
        statusIcon = '✅';
    } else if (depInfo.required) {
        statusClass = 'status-error';
        statusIcon = '❌';
    }
    
    div.className = `dependency-item ${statusClass}`;
    
    const requiredByText = depInfo.requiredBy && depInfo.requiredBy.length > 0 
        ? `Required by: ${depInfo.requiredBy.join(', ')}`
        : '';
    
    const versionText = depInfo.version ? `Version: ${depInfo.version}` : '';
    
    div.innerHTML = `
        <div class="dependency-status-icon">${statusIcon}</div>
        <div class="dependency-info">
            <div class="dependency-name">${depInfo.name || depName}</div>
            <div class="dependency-description">${depInfo.description}</div>
            ${versionText ? `<div class="dependency-version">${versionText}</div>` : ''}
            ${requiredByText ? `<div class="dependency-required-by">${requiredByText}</div>` : ''}
        </div>
        <div class="dependency-actions">
            ${!depInfo.available ? `<button class="btn btn-small" onclick="showSetupInstructions('${depName}')">Setup</button>` : ''}
            <button class="btn btn-small" onclick="recheckDependency('${depName}')">Check</button>
        </div>
    `;
    
    return div;
}

function updateServerReadinessList() {
    const serverReadinessList = document.getElementById('serverReadinessList');
    if (!serverReadinessList) return;
    
    serverReadinessList.innerHTML = '';
    
    const currentConfig = window.core.currentConfig();
    
    // Check active servers
    if (currentConfig.mcpServers) {
        for (const [serverName, serverConfig] of Object.entries(currentConfig.mcpServers)) {
            const readinessItem = createServerReadinessItem(serverName, serverConfig, false);
            serverReadinessList.appendChild(readinessItem);
        }
    }
    
    // Check disabled servers
    if (currentConfig.disabledMcpServers) {
        for (const [serverName, serverConfig] of Object.entries(currentConfig.disabledMcpServers)) {
            const readinessItem = createServerReadinessItem(serverName, serverConfig, true);
            serverReadinessList.appendChild(readinessItem);
        }
    }
    
    if (serverReadinessList.children.length === 0) {
        serverReadinessList.innerHTML = '<p style="color: #666; font-style: italic;">No servers configured</p>';
    }
}

function createServerReadinessItem(serverName, serverConfig, isDisabled) {
    const div = document.createElement('div');
    
    // Check if the command dependency is available
    const command = serverConfig.command?.toLowerCase();
    let isReady = true;
    let missingDep = null;
    
    if (command) {
        for (const [depName, depInfo] of Object.entries(systemStatus.dependencies)) {
            if (command === depName || command.includes(depName)) {
                if (!depInfo.available) {
                    isReady = false;
                    missingDep = depName;
                }
                break;
            }
        }
    }
    
    const readyClass = isReady ? 'ready' : 'not-ready';
    const statusIcon = isReady ? '✅' : '❌';
    const statusText = isReady ? 'Ready to run' : `Missing: ${missingDep}`;
    const statusColor = isReady ? 'server-readiness-ready' : 'server-readiness-missing';
    
    div.className = `server-readiness-item ${readyClass}`;
    
    div.innerHTML = `
        <div class="server-readiness-info">
            <div class="server-readiness-name">${serverName}${isDisabled ? ' (disabled)' : ''}</div>
            <div class="server-readiness-command">${serverConfig.command}</div>
        </div>
        <div class="server-readiness-status">
            <div class="server-readiness-icon">${statusIcon}</div>
            <div class="server-readiness-text ${statusColor}">${statusText}</div>
            ${!isReady ? `<button class="btn btn-small" onclick="showSetupInstructions('${missingDep}')">Setup</button>` : ''}
        </div>
    `;
    
    return div;
}

async function showSetupInstructions(dependencyName) {
    try {
        const result = await window.api.getDependencyInstructions(dependencyName);
        if (result.success) {
            displaySetupInstructions(result.dependency, result.platform, result.instructions);
        } else {
            alert(`Could not get setup instructions: ${result.error}`);
        }
    } catch (error) {
        alert(`Error getting setup instructions: ${error.message}`);
    }
}

function displaySetupInstructions(dependency, platform, instructions) {
    const instructionsDiv = document.getElementById('setupInstructions');
    const instructionsContent = document.getElementById('instructionsContent');
    
    if (!instructionsDiv || !instructionsContent) return;
    
    instructionsContent.innerHTML = '';
    
    const instructionSection = document.createElement('div');
    instructionSection.className = 'instruction-section';
    
    let platformName = platform;
    switch (platform) {
        case 'win32': platformName = 'Windows'; break;
        case 'darwin': platformName = 'macOS'; break;
        case 'linux': platformName = 'Linux'; break;
    }
    
    instructionSection.innerHTML = `
        <div class="instruction-title">
            Setup ${dependency.name} - ${dependency.description}
            <span class="instruction-os">${platformName}</span>
        </div>
    `;
    
    for (const method of instructions.installMethods) {
        const methodDiv = document.createElement('div');
        methodDiv.className = 'instruction-method';
        
        let content = `
            <div class="instruction-method-title">${method.name}</div>
            <div>${method.description}</div>
        `;
        
        if (method.command) {
            content += `<div class="instruction-command">${method.command}</div>`;
        }
        
        if (method.url) {
            content += `<div><a href="${method.url}" class="instruction-link" target="_blank">${method.url}</a></div>`;
        }
        
        if (method.estimatedTime) {
            content += `<div style="color: #666; font-size: 12px; margin-top: 5px;">Estimated time: ${method.estimatedTime}</div>`;
        }
        
        methodDiv.innerHTML = content;
        instructionSection.appendChild(methodDiv);
    }
    
    instructionsContent.appendChild(instructionSection);
    instructionsDiv.classList.remove('hidden');
    
    // Scroll to instructions
    instructionsDiv.scrollIntoView({ behavior: 'smooth' });
}

async function recheckDependency(dependencyName) {
    // Update the specific dependency
    await checkSystemDependencies();
    updateSystemStatusModal();
}

// Add dependency warning to server modal
function showDependencyWarning(command) {
    return window.api.checkSingleDependency(command).then(result => {
        const warningDiv = document.getElementById('dependencyWarning');
        
        if (warningDiv) {
            warningDiv.remove();
        }
        
        if (result.success && !result.available && result.dependency) {
            const warning = document.createElement('div');
            warning.id = 'dependencyWarning';
            warning.className = 'dependency-warning';
            
            warning.innerHTML = `
                <div class="dependency-warning-icon">⚠️</div>
                <div class="dependency-warning-text">
                    This server requires '${result.dependency.name}' which wasn't found on your system.
                </div>
            `;
            
            const modalBody = document.querySelector('#serverModal .modal-body');
            if (modalBody) {
                modalBody.insertBefore(warning, modalBody.firstChild);
            }
        }
    }).catch(error => {
        console.warn('Could not check dependency:', error);
    });
}

// Make system status functions available globally
window.hideSystemStatusModal = hideSystemStatusModal;
window.showSetupInstructions = showSetupInstructions;
window.recheckDependency = recheckDependency;

// Export system dependencies functionality
window.systemDeps = {
    checkSystemDependencies,
    updateSystemStatusIndicator,
    showSystemStatusModal,
    hideSystemStatusModal,
    updateSystemStatusModal,
    showSetupInstructions,
    recheckDependency,
    showDependencyWarning
};