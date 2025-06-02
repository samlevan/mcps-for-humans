// Import/Export functionality - JSON import, single server import, bulk import

// Import state
let importState = {
    parsedServers: [],
    duplicates: [],
    needsServerName: false
};

// Single server import state  
let singleServerImportState = {
    parsedServer: null,
    needsServerName: false,
    isValid: false
};

// Import modal event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Import modal events
    document.getElementById('pasteFromClipboardBtn')?.addEventListener('click', pasteFromClipboard);
    document.getElementById('parseJsonBtn')?.addEventListener('click', parseImportJson);
    document.getElementById('cancelImportBtn')?.addEventListener('click', hideImportModal);
    document.getElementById('cancelImportBtn2')?.addEventListener('click', hideImportModal);
    document.getElementById('backToEditBtn')?.addEventListener('click', backToEditStep);
    document.getElementById('confirmImportBtn')?.addEventListener('click', confirmImport);
    document.getElementById('closeImportBtn')?.addEventListener('click', hideImportModal);
    
    // Single server import modal events
    document.getElementById('singlePasteFromClipboardBtn')?.addEventListener('click', pasteSingleFromClipboard);
    document.getElementById('cancelSingleImportBtn')?.addEventListener('click', hideSingleServerImportModal);
    document.getElementById('addSingleServerBtn')?.addEventListener('click', addSingleServer);
    
    // JSON input validation
    const singleJsonInput = document.getElementById('singleJsonInput');
    if (singleJsonInput) {
        let singleValidationTimeout = null;
        
        singleJsonInput.addEventListener('input', () => {
            clearTimeout(singleValidationTimeout);
            singleValidationTimeout = setTimeout(() => {
                validateSingleServerJson();
            }, 300);
        });
    }
    
    // Server name input validation
    const singleServerNameInput = document.getElementById('singleServerName');
    if (singleServerNameInput) {
        singleServerNameInput.addEventListener('input', validateSingleServerName);
    }
    
    // Close modals when clicking outside
    document.addEventListener('click', (event) => {
        if (event.target === document.getElementById('importJsonModal')) {
            hideImportModal();
        }
        if (event.target === document.getElementById('singleServerImportModal')) {
            hideSingleServerImportModal();
        }
    });
});

// Bulk import functions
function showImportModal() {
    const modal = document.getElementById('importJsonModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    // Reset to first step
    showImportStep(1);
    
    // Clear input
    const jsonInput = document.getElementById('jsonInput');
    if (jsonInput) {
        jsonInput.value = '';
    }
    document.getElementById('jsonError')?.classList.add('hidden');
    
    // Reset state
    importState = {
        parsedServers: [],
        duplicates: [],
        needsServerName: false
    };
}

function hideImportModal() {
    const modal = document.getElementById('importJsonModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showImportStep(step) {
    // Hide all steps
    for (let i = 1; i <= 3; i++) {
        document.getElementById(`importStep${i}`)?.classList.add('hidden');
    }
    
    // Show target step
    document.getElementById(`importStep${step}`)?.classList.remove('hidden');
}

function backToEditStep() {
    showImportStep(1);
}

async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        const jsonInput = document.getElementById('jsonInput');
        if (jsonInput) {
            jsonInput.value = text;
        }
    } catch (error) {
        console.warn('Could not read from clipboard:', error);
        // Fallback - just focus the textarea
        document.getElementById('jsonInput')?.focus();
    }
}

function parseImportJson() {
    const jsonInput = document.getElementById('jsonInput');
    const jsonError = document.getElementById('jsonError');
    
    if (!jsonInput) return;
    
    let inputText = jsonInput.value.trim();
    
    if (!inputText) {
        showJsonError('Please paste some JSON configuration.');
        return;
    }
    
    // Clear previous errors
    jsonError?.classList.add('hidden');
    
    try {
        // Smart detection and cleanup
        inputText = smartJsonCleanup(inputText);
        
        // Parse JSON
        const parsedJson = JSON.parse(inputText);
        
        // Detect format and extract servers
        const detectionResult = detectJsonFormat(parsedJson);
        
        if (!detectionResult.success) {
            showJsonError(detectionResult.error);
            return;
        }
        
        importState.parsedServers = detectionResult.servers;
        importState.needsServerName = detectionResult.needsServerName;
        
        // Check for duplicates
        checkForDuplicates();
        
        // Show preview
        showImportPreview();
        showImportStep(2);
        
    } catch (error) {
        showJsonError(`Invalid JSON: ${error.message}`);
    }
}

function smartJsonCleanup(text) {
    // Remove common copy-paste artifacts
    text = text.trim();
    
    // Remove JavaScript variable declarations
    text = text.replace(/^(const|let|var)\s+\w+\s*=\s*/, '');
    text = text.replace(/;?\s*$/, '');
    
    // Handle trailing commas (simple approach)
    text = text.replace(/,(\s*[}\]])/g, '$1');
    
    return text;
}

function detectJsonFormat(json) {
    // Format 1: Full config with mcpServers wrapper
    if (json.mcpServers && typeof json.mcpServers === 'object') {
        const servers = [];
        for (const [name, config] of Object.entries(json.mcpServers)) {
            if (!config.command) {
                return { success: false, error: `Server "${name}" is missing required "command" field.` };
            }
            servers.push({ name, config });
        }
        return { success: true, servers, needsServerName: false };
    }
    
    // Format 2: Single server format (object with one key that contains a server config)
    if (typeof json === 'object' && !Array.isArray(json)) {
        const keys = Object.keys(json);
        
        // Check if this looks like a server definition (has command)
        if (json.command) {
            // Format 3: Server definition only
            return { success: true, servers: [{ name: null, config: json }], needsServerName: true };
        }
        
        // Check if this looks like Format 2 (single server with name)
        if (keys.length === 1) {
            const serverName = keys[0];
            const serverConfig = json[serverName];
            
            if (serverConfig && typeof serverConfig === 'object' && serverConfig.command) {
                return { success: true, servers: [{ name: serverName, config: serverConfig }], needsServerName: false };
            }
        }
        
        // Check if this looks like multiple servers without mcpServers wrapper
        let allHaveCommand = true;
        const servers = [];
        
        for (const [name, config] of Object.entries(json)) {
            if (!config || typeof config !== 'object' || !config.command) {
                allHaveCommand = false;
                break;
            }
            servers.push({ name, config });
        }
        
        if (allHaveCommand && servers.length > 0) {
            return { success: true, servers, needsServerName: false };
        }
    }
    
    // Format 4: Array of servers
    if (Array.isArray(json)) {
        const servers = [];
        for (let i = 0; i < json.length; i++) {
            const item = json[i];
            if (!item.command) {
                return { success: false, error: `Server at index ${i} is missing required "command" field.` };
            }
            servers.push({ name: null, config: item });
        }
        return { success: true, servers, needsServerName: servers.length > 0 };
    }
    
    return { success: false, error: 'Unrecognized JSON format. Expected MCP server configuration.' };
}

function checkForDuplicates() {
    const currentConfig = window.core.currentConfig();
    const existingServers = { ...currentConfig.mcpServers, ...currentConfig.disabledMcpServers };
    importState.duplicates = [];
    
    for (const server of importState.parsedServers) {
        if (server.name && existingServers[server.name]) {
            importState.duplicates.push(server.name);
        }
    }
}

function showImportPreview() {
    const previewDiv = document.getElementById('importPreview');
    const serverNamePrompt = document.getElementById('serverNamePrompt');
    const duplicateHandling = document.getElementById('duplicateHandling');
    
    if (!previewDiv) return;
    
    // Clear preview
    previewDiv.innerHTML = '';
    
    // Show server name prompt if needed
    if (importState.needsServerName && serverNamePrompt) {
        serverNamePrompt.classList.remove('hidden');
        
        // Pre-fill with a suggested name if there's only one server
        if (importState.parsedServers.length === 1) {
            const command = importState.parsedServers[0].config.command;
            const suggestedName = command.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const newServerNameInput = document.getElementById('newServerName');
            if (newServerNameInput) {
                newServerNameInput.value = suggestedName;
            }
        }
    } else if (serverNamePrompt) {
        serverNamePrompt.classList.add('hidden');
    }
    
    // Show duplicate handling if needed
    if (importState.duplicates.length > 0 && duplicateHandling) {
        duplicateHandling.classList.remove('hidden');
        showDuplicateOptions();
    } else if (duplicateHandling) {
        duplicateHandling.classList.add('hidden');
    }
    
    // Show preview of servers
    for (let i = 0; i < importState.parsedServers.length; i++) {
        const server = importState.parsedServers[i];
        const serverDiv = createServerPreview(server, i);
        previewDiv.appendChild(serverDiv);
    }
}

function createServerPreview(server, index) {
    const div = document.createElement('div');
    div.className = 'import-preview-item';
    
    const name = server.name || `Server ${index + 1}`;
    
    div.innerHTML = `
        <h4>${name}</h4>
        <div class="import-preview-detail">
            <span class="import-preview-label">Command:</span>
            <span class="import-preview-value">${server.config.command}</span>
        </div>
        ${server.config.args ? `
        <div class="import-preview-detail">
            <span class="import-preview-label">Arguments:</span>
            <span class="import-preview-value">${server.config.args.join(', ')}</span>
        </div>
        ` : ''}
        ${server.config.env ? `
        <div class="import-preview-detail">
            <span class="import-preview-label">Environment:</span>
            <span class="import-preview-value">${Object.keys(server.config.env).length} variable(s)</span>
        </div>
        ` : ''}
    `;
    
    return div;
}

function showDuplicateOptions() {
    const duplicatesList = document.getElementById('duplicatesList');
    if (!duplicatesList) return;
    
    duplicatesList.innerHTML = '';
    
    for (const duplicateName of importState.duplicates) {
        const duplicateDiv = document.createElement('div');
        duplicateDiv.className = 'duplicate-item';
        
        duplicateDiv.innerHTML = `
            <div class="duplicate-item-header">Server: ${duplicateName}</div>
            <div class="duplicate-options">
                <div class="duplicate-option">
                    <input type="radio" name="duplicate_${duplicateName}" value="replace" id="replace_${duplicateName}">
                    <label for="replace_${duplicateName}">Replace existing</label>
                </div>
                <div class="duplicate-option">
                    <input type="radio" name="duplicate_${duplicateName}" value="skip" id="skip_${duplicateName}" checked>
                    <label for="skip_${duplicateName}">Skip duplicate</label>
                </div>
                <div class="duplicate-option">
                    <input type="radio" name="duplicate_${duplicateName}" value="rename" id="rename_${duplicateName}">
                    <label for="rename_${duplicateName}">Rename to ${duplicateName}_2</label>
                </div>
            </div>
        `;
        
        duplicatesList.appendChild(duplicateDiv);
    }
}

async function confirmImport() {
    const newServerNameInput = document.getElementById('newServerName');
    
    // Validate server name if needed
    if (importState.needsServerName && newServerNameInput) {
        const serverName = newServerNameInput.value.trim();
        if (!serverName) {
            alert('Please enter a server name.');
            newServerNameInput.focus();
            return;
        }
        
        // Apply name to all servers that need it
        for (const server of importState.parsedServers) {
            if (!server.name) {
                server.name = serverName;
            }
        }
    }
    
    // Process duplicates
    const duplicateActions = {};
    for (const duplicateName of importState.duplicates) {
        const selectedOption = document.querySelector(`input[name="duplicate_${duplicateName}"]:checked`);
        duplicateActions[duplicateName] = selectedOption ? selectedOption.value : 'skip';
    }
    
    // Check dependencies for servers being imported
    const missingDeps = [];
    
    for (const server of importState.parsedServers) {
        if (server.config && server.config.command) {
            const depCheck = await window.api.checkSingleDependency(server.config.command);
            if (depCheck.success && !depCheck.available && depCheck.dependency) {
                const depName = depCheck.dependency.name;
                if (!missingDeps.includes(depName)) {
                    missingDeps.push(depName);
                }
            }
        }
    }
    
    // Show warning if dependencies are missing
    if (missingDeps.length > 0) {
        const proceed = confirm(
            `⚠️ Warning: The following dependencies are not installed on your system:\n\n` +
            `${missingDeps.join(', ')}\n\n` +
            `You can still import these servers, but they won't be able to run until you install the required tools.\n\n` +
            `Do you want to continue with the import?`
        );
        
        if (!proceed) {
            return;
        }
    }
    
    // Import servers
    let importedCount = 0;
    let skippedCount = 0;
    let replacedCount = 0;
    
    const currentConfig = window.core.currentConfig();
    
    for (const server of importState.parsedServers) {
        let finalName = server.name;
        
        if (importState.duplicates.includes(server.name)) {
            const action = duplicateActions[server.name];
            
            if (action === 'skip') {
                skippedCount++;
                continue;
            } else if (action === 'rename') {
                finalName = generateUniqueName(server.name);
            } else if (action === 'replace') {
                replacedCount++;
            }
        }
        
        // Add to config
        currentConfig.mcpServers[finalName] = server.config;
        importedCount++;
    }
    
    // Mark as changed and refresh
    window.core.markAsChanged();
    if (window.serverManagement && window.serverManagement.renderServers) {
        window.serverManagement.renderServers();
    }
    
    // Show success step
    showImportSuccess(importedCount, skippedCount, replacedCount);
    showImportStep(3);
    
    // Check dependencies after import
    setTimeout(async () => {
        if (window.systemDeps && window.systemDeps.checkSystemDependencies) {
            await window.systemDeps.checkSystemDependencies();
        }
    }, 100);
}

function generateUniqueName(baseName) {
    const currentConfig = window.core.currentConfig();
    let counter = 2;
    let candidateName = `${baseName}_${counter}`;
    
    while (currentConfig.mcpServers[candidateName] || currentConfig.disabledMcpServers[candidateName]) {
        counter++;
        candidateName = `${baseName}_${counter}`;
    }
    
    return candidateName;
}

function showImportSuccess(imported, skipped, replaced) {
    const summaryDiv = document.getElementById('importSummary');
    if (!summaryDiv) return;
    
    summaryDiv.innerHTML = '';
    
    if (imported > 0) {
        const importedItem = document.createElement('div');
        importedItem.className = 'import-summary-item';
        importedItem.textContent = `✅ ${imported} server(s) imported successfully`;
        summaryDiv.appendChild(importedItem);
    }
    
    if (replaced > 0) {
        const replacedItem = document.createElement('div');
        replacedItem.className = 'import-summary-item';
        replacedItem.textContent = `🔄 ${replaced} server(s) replaced`;
        summaryDiv.appendChild(replacedItem);
    }
    
    if (skipped > 0) {
        const skippedItem = document.createElement('div');
        skippedItem.className = 'import-summary-item';
        skippedItem.textContent = `⏭️ ${skipped} server(s) skipped (duplicates)`;
        summaryDiv.appendChild(skippedItem);
    }
}

function showJsonError(message) {
    const jsonError = document.getElementById('jsonError');
    if (jsonError) {
        jsonError.textContent = message;
        jsonError.classList.remove('hidden');
    }
}

// Single Server Import Modal functions
function showSingleServerImportModal() {
    const modal = document.getElementById('singleServerImportModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    // Reset state
    singleServerImportState = {
        parsedServer: null,
        needsServerName: false,
        isValid: false
    };
    
    // Clear inputs
    const singleJsonInput = document.getElementById('singleJsonInput');
    const singleServerName = document.getElementById('singleServerName');
    if (singleJsonInput) singleJsonInput.value = '';
    if (singleServerName) singleServerName.value = '';
    
    // Hide elements
    document.getElementById('singleJsonValidation')?.classList.add('hidden');
    document.getElementById('singleJsonError')?.classList.add('hidden');
    document.getElementById('singleServerPreview')?.classList.add('hidden');
    document.getElementById('singleServerNamePrompt')?.classList.add('hidden');
    document.getElementById('singleServerNameError')?.classList.add('hidden');
    
    // Reset input styles
    if (singleJsonInput) {
        singleJsonInput.classList.remove('valid', 'invalid');
    }
    
    // Disable add button
    const addButton = document.getElementById('addSingleServerBtn');
    if (addButton) {
        addButton.disabled = true;
    }
    
    // Focus on text area
    setTimeout(() => {
        if (singleJsonInput) {
            singleJsonInput.focus();
        }
    }, 100);
}

function hideSingleServerImportModal() {
    const modal = document.getElementById('singleServerImportModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function pasteSingleFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        const singleJsonInput = document.getElementById('singleJsonInput');
        if (singleJsonInput) {
            singleJsonInput.value = text;
            validateSingleServerJson();
        }
    } catch (error) {
        console.warn('Could not read from clipboard:', error);
        document.getElementById('singleJsonInput')?.focus();
    }
}

function validateSingleServerJson() {
    const jsonInput = document.getElementById('singleJsonInput');
    if (!jsonInput) return;
    
    const validation = document.getElementById('singleJsonValidation');
    const validationIcon = validation?.querySelector('.validation-icon');
    const validationText = validation?.querySelector('.validation-text');
    const errorDiv = document.getElementById('singleJsonError');
    const preview = document.getElementById('singleServerPreview');
    const namePrompt = document.getElementById('singleServerNamePrompt');
    
    const inputText = jsonInput.value.trim();
    
    if (!inputText) {
        // Empty input - hide validation
        validation?.classList.add('hidden');
        errorDiv?.classList.add('hidden');
        preview?.classList.add('hidden');
        namePrompt?.classList.add('hidden');
        jsonInput.classList.remove('valid', 'invalid');
        singleServerImportState.isValid = false;
        updateSingleAddButton();
        return;
    }
    
    try {
        // Parse JSON
        const parsedJson = JSON.parse(inputText);
        
        // Detect format and extract server
        const detectionResult = detectSingleServerFormat(parsedJson);
        
        if (!detectionResult.success) {
            showSingleValidationError(detectionResult.error);
            return;
        }
        
        // Valid JSON and format
        showSingleValidationSuccess();
        singleServerImportState.parsedServer = detectionResult.server;
        singleServerImportState.needsServerName = detectionResult.needsServerName;
        singleServerImportState.isValid = true;
        
        // Show preview
        showSingleServerPreview(detectionResult.server, detectionResult.needsServerName);
        
        // Show name prompt if needed
        if (detectionResult.needsServerName && namePrompt) {
            namePrompt.classList.remove('hidden');
            
            // Auto-suggest name based on command
            const suggestedName = generateServerName(detectionResult.server.config.command);
            const singleServerName = document.getElementById('singleServerName');
            if (singleServerName) {
                singleServerName.value = suggestedName;
            }
        } else if (namePrompt) {
            namePrompt.classList.add('hidden');
        }
        
        updateSingleAddButton();
        
    } catch (error) {
        showSingleValidationError(`Invalid JSON: ${error.message}`);
    }
}

function detectSingleServerFormat(json) {
    // Format 1: Server definition only (no name)
    if (json.command) {
        return {
            success: true,
            server: { name: null, config: json },
            needsServerName: true
        };
    }
    
    // Format 2: Single server with name
    if (typeof json === 'object' && !Array.isArray(json)) {
        const keys = Object.keys(json);
        
        if (keys.length === 1) {
            const serverName = keys[0];
            const serverConfig = json[serverName];
            
            if (serverConfig && typeof serverConfig === 'object' && serverConfig.command) {
                return {
                    success: true,
                    server: { name: serverName, config: serverConfig },
                    needsServerName: false
                };
            }
        }
        
        // Format 3: Full config with mcpServers wrapper (single server)
        if (json.mcpServers && typeof json.mcpServers === 'object') {
            const serverNames = Object.keys(json.mcpServers);
            
            if (serverNames.length === 1) {
                const serverName = serverNames[0];
                const serverConfig = json.mcpServers[serverName];
                
                if (serverConfig && serverConfig.command) {
                    return {
                        success: true,
                        server: { name: serverName, config: serverConfig },
                        needsServerName: false
                    };
                }
            } else if (serverNames.length > 1) {
                return {
                    success: false,
                    error: 'Multiple servers detected. Use "Import JSON" for bulk import.'
                };
            }
        }
    }
    
    return {
        success: false,
        error: 'Unrecognized format. Expected single server configuration.'
    };
}

function showSingleValidationSuccess() {
    const validation = document.getElementById('singleJsonValidation');
    const validationIcon = validation?.querySelector('.validation-icon');
    const validationText = validation?.querySelector('.validation-text');
    const errorDiv = document.getElementById('singleJsonError');
    const jsonInput = document.getElementById('singleJsonInput');
    
    if (validation) {
        validation.classList.remove('hidden', 'invalid');
        validation.classList.add('valid');
    }
    if (validationIcon) validationIcon.textContent = '✅';
    if (validationText) validationText.textContent = 'Valid JSON';
    
    errorDiv?.classList.add('hidden');
    if (jsonInput) {
        jsonInput.classList.remove('invalid');
        jsonInput.classList.add('valid');
    }
}

function showSingleValidationError(message) {
    const validation = document.getElementById('singleJsonValidation');
    const validationIcon = validation?.querySelector('.validation-icon');
    const validationText = validation?.querySelector('.validation-text');
    const errorDiv = document.getElementById('singleJsonError');
    const jsonInput = document.getElementById('singleJsonInput');
    const preview = document.getElementById('singleServerPreview');
    const namePrompt = document.getElementById('singleServerNamePrompt');
    
    if (validation) {
        validation.classList.remove('hidden', 'valid');
        validation.classList.add('invalid');
    }
    if (validationIcon) validationIcon.textContent = '❌';
    if (validationText) validationText.textContent = 'Invalid JSON';
    
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
    
    if (jsonInput) {
        jsonInput.classList.remove('valid');
        jsonInput.classList.add('invalid');
    }
    
    preview?.classList.add('hidden');
    namePrompt?.classList.add('hidden');
    
    singleServerImportState.isValid = false;
    updateSingleAddButton();
}

function showSingleServerPreview(server, needsServerName) {
    const preview = document.getElementById('singleServerPreview');
    const previewContent = document.getElementById('singlePreviewContent');
    
    if (!preview || !previewContent) return;
    
    const serverName = server.name || 'New Server';
    
    let previewHtml = `
        <div class="preview-detail">
            <span class="preview-label">Name:</span>
            <span class="preview-value">${serverName}${needsServerName ? ' (will be set)' : ''}</span>
        </div>
        <div class="preview-detail">
            <span class="preview-label">Command:</span>
            <span class="preview-value">${server.config.command}</span>
        </div>
    `;
    
    if (server.config.args && server.config.args.length > 0) {
        previewHtml += `
            <div class="preview-detail">
                <span class="preview-label">Arguments:</span>
                <span class="preview-value">${server.config.args.join(', ')}</span>
            </div>
        `;
    }
    
    if (server.config.env && Object.keys(server.config.env).length > 0) {
        previewHtml += `
            <div class="preview-detail">
                <span class="preview-label">Environment:</span>
                <span class="preview-value">${Object.keys(server.config.env).length} variable(s)</span>
            </div>
        `;
    }
    
    previewContent.innerHTML = previewHtml;
    preview.classList.remove('hidden');
}

function generateServerName(command) {
    // Generate a suggested server name based on the command
    const cleanCommand = command.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    return cleanCommand.substring(0, 20); // Limit length
}

function validateSingleServerName() {
    const nameInput = document.getElementById('singleServerName');
    const nameError = document.getElementById('singleServerNameError');
    
    if (!nameInput || !nameError) return true;
    
    const name = nameInput.value.trim();
    
    if (!name && singleServerImportState.needsServerName) {
        nameInput.classList.add('input-error');
        nameError.textContent = 'Server name is required';
        nameError.classList.remove('hidden');
        updateSingleAddButton();
        return false;
    }
    
    // Check for duplicates
    const currentConfig = window.core.currentConfig();
    if (name && (currentConfig.mcpServers[name] || currentConfig.disabledMcpServers[name])) {
        nameInput.classList.add('input-error');
        nameError.textContent = `A server named '${name}' already exists. Please choose a different name.`;
        nameError.classList.remove('hidden');
        updateSingleAddButton();
        return false;
    }
    
    // Valid name
    nameInput.classList.remove('input-error');
    nameError.classList.add('hidden');
    updateSingleAddButton();
    return true;
}

function updateSingleAddButton() {
    const addButton = document.getElementById('addSingleServerBtn');
    if (!addButton) return;
    
    let isValid = singleServerImportState.isValid;
    
    if (singleServerImportState.needsServerName) {
        const nameInput = document.getElementById('singleServerName');
        if (nameInput) {
            const name = nameInput.value.trim();
            isValid = isValid && name && !nameInput.classList.contains('input-error');
        }
    }
    
    addButton.disabled = !isValid;
}

async function addSingleServer() {
    if (!singleServerImportState.isValid) {
        return;
    }
    
    let serverName = singleServerImportState.parsedServer.name;
    
    if (singleServerImportState.needsServerName) {
        const nameInput = document.getElementById('singleServerName');
        if (nameInput) {
            serverName = nameInput.value.trim();
        }
        
        if (!validateSingleServerName()) {
            return;
        }
    }
    
    // Check for dependency warning
    const serverConfig = singleServerImportState.parsedServer.config;
    if (serverConfig.command) {
        const depCheck = await window.api.checkSingleDependency(serverConfig.command);
        if (depCheck.success && !depCheck.available && depCheck.dependency) {
            const proceed = confirm(
                `⚠️ Warning: This server requires '${depCheck.dependency.name}' which wasn't found on your system.\n\n` +
                `You can still add this server, but it won't be able to run until you install the required tool.\n\n` +
                `Do you want to continue?`
            );
            
            if (!proceed) {
                return;
            }
        }
    }
    
    // Add server to config
    const currentConfig = window.core.currentConfig();
    currentConfig.mcpServers[serverName] = serverConfig;
    
    // Mark as changed and refresh
    window.core.markAsChanged();
    if (window.serverManagement && window.serverManagement.renderServers) {
        window.serverManagement.renderServers();
    }
    
    // Hide modal
    hideSingleServerImportModal();
    
    // Show success toast
    if (window.uiUtils && window.uiUtils.showToast) {
        window.uiUtils.showToast('success', `Server '${serverName}' added successfully`);
    }
    
    // Highlight new server
    if (window.uiUtils && window.uiUtils.highlightNewServer) {
        window.uiUtils.highlightNewServer(serverName);
    }
    
    // Check dependencies
    setTimeout(async () => {
        if (window.systemDeps && window.systemDeps.checkSystemDependencies) {
            await window.systemDeps.checkSystemDependencies();
        }
    }, 100);
}

// Make import functions available globally
window.hideImportModal = hideImportModal;
window.hideSingleServerImportModal = hideSingleServerImportModal;

// Export import/export functionality
window.importExport = {
    showImportModal,
    hideImportModal,
    showSingleServerImportModal,
    hideSingleServerImportModal,
    parseImportJson,
    confirmImport,
    addSingleServer
};