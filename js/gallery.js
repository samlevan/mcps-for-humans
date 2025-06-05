// Server Gallery functionality
let galleryServers = [];
let selectedServer = null;

// Load gallery data on startup
async function loadGalleryData() {
    try {
        const response = await fetch('gallery.json');
        const data = await response.json();
        galleryServers = data.servers;
        renderGalleryGrid();
    } catch (error) {
        console.error('Failed to load gallery data:', error);
        if (window.uiUtils && window.uiUtils.showToast) {
            window.uiUtils.showToast('error', 'Failed to load server gallery');
        }
    }
}

// Initialize gallery when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    loadGalleryData();
    setupGalleryEventListeners();
});

function setupGalleryEventListeners() {
    // Gallery modal close buttons
    document.querySelector('#serverGalleryModal .close-btn')?.addEventListener('click', hideGalleryModal);
    document.querySelector('#serverCredentialModal .close-btn')?.addEventListener('click', hideCredentialModal);
    
    // Custom server dropdown
    const customServerBtn = document.getElementById('addCustomServerBtn');
    const customServerMenu = document.getElementById('customServerDropdownMenu');
    
    customServerBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        customServerMenu.classList.toggle('hidden');
    });
    
    // Custom server dropdown options
    document.getElementById('galleryManualEntryOption')?.addEventListener('click', () => {
        hideGalleryModal();
        customServerMenu.classList.add('hidden');
        window.serverManagement.showServerModal();
    });
    
    document.getElementById('galleryPasteJsonOption')?.addEventListener('click', () => {
        hideGalleryModal();
        customServerMenu.classList.add('hidden');
        window.importExport.showSingleServerImportModal();
    });
    
    // Credential form buttons
    document.getElementById('cancelCredentialBtn')?.addEventListener('click', hideCredentialModal);
    document.getElementById('testCredentialBtn')?.addEventListener('click', testServerWithCredentials);
    document.getElementById('addServerFromGalleryBtn')?.addEventListener('click', addServerFromGallery);
    
    // Credential form validation
    document.getElementById('credentialForm')?.addEventListener('input', validateCredentialForm);
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.add-custom-server-dropdown')) {
            customServerMenu?.classList.add('hidden');
        }
    });
    
    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target === document.getElementById('serverGalleryModal')) {
            hideGalleryModal();
        }
        if (e.target === document.getElementById('serverCredentialModal')) {
            hideCredentialModal();
        }
    });
}

function showGalleryModal() {
    const modal = document.getElementById('serverGalleryModal');
    if (modal) {
        modal.style.display = 'flex';
        renderGalleryGrid();
    }
}

function hideGalleryModal() {
    const modal = document.getElementById('serverGalleryModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function renderGalleryGrid() {
    const grid = document.getElementById('serverGalleryGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    galleryServers.forEach(server => {
        const card = createServerCard(server);
        grid.appendChild(card);
    });
}

function createServerCard(server) {
    const card = document.createElement('div');
    card.className = 'server-card';
    card.dataset.serverId = server.id;
    
    // Add coming soon status if applicable
    if (server.status === 'coming_soon') {
        card.classList.add('server-card-coming-soon');
    }
    
    let cardContent = `
        <h3 class="server-card-name">${server.name}</h3>
    `;
    
    // Check if logo is an emoji or a file path
    if (server.logo && server.logo.startsWith('./') || server.logo.startsWith('/')) {
        cardContent += `<img class="server-card-logo" src="${server.logo}" alt="${server.name} logo" />`;
    } else {
        // Use emoji as logo
        cardContent += `<div class="server-card-emoji-logo">${server.logo}</div>`;
    }
    
    // Add coming soon badge
    if (server.status === 'coming_soon') {
        cardContent += '<div class="coming-soon-badge">COMING SOON</div>';
    }
    
    card.innerHTML = cardContent;
    
    // Only add click handler if not coming soon
    if (server.status !== 'coming_soon') {
        card.addEventListener('click', () => selectServerFromGallery(server));
    } else {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.uiUtils && window.uiUtils.showToast) {
                window.uiUtils.showToast('info', `${server.name} integration coming soon!`);
            }
        });
    }
    
    return card;
}

function selectServerFromGallery(server) {
    selectedServer = server;
    
    // Show modal for: SSE servers, connection_string servers, or servers with credentials
    // Only add directly if it has no credentials AND no special config type
    if ((!server.credentials || server.credentials.length === 0) && 
        server.configType !== 'sse' && 
        server.configType !== 'connection_string') {
        addServerDirectly(server);
    } else {
        showCredentialModal(server);
    }
}

function addServerDirectly(server) {
    const serverConfig = {
        command: server.command,
        args: server.args || [],
        env: {}
    };
    
    // Generate a unique name
    const serverName = generateUniqueServerName(server.name);
    
    // Add the server
    window.serverManagement.addServer(serverName, serverConfig);
    
    hideGalleryModal();
    if (window.uiUtils && window.uiUtils.showToast) {
        window.uiUtils.showToast('success', `Added ${server.name} server`);
    }
}

function generateUniqueServerName(baseName) {
    const config = window.core.currentConfig();
    const existingNames = new Set([
        ...Object.keys(config.mcpServers || {}),
        ...Object.keys(config.disabledMcpServers || {})
    ]);
    
    // Preserve original capitalization, just replace spaces with hyphens
    let name = baseName.replace(/\s+/g, '-');
    
    // If name doesn't exist, use it
    if (!existingNames.has(name)) {
        return name;
    }
    
    // Otherwise, append a number
    let counter = 2;
    while (existingNames.has(`${name}-${counter}`)) {
        counter++;
    }
    
    return `${name}-${counter}`;
}

function showCredentialModal(server) {
    const modal = document.getElementById('serverCredentialModal');
    if (!modal) return;
    
    // Update modal title
    document.getElementById('credentialModalTitle').textContent = `Configure ${server.name}`;
    
    // Update server info
    const serverInfo = document.getElementById('credentialServerInfo');
    let serverInfoHTML = '';
    
    // Check if logo is an emoji or a file path
    if (server.logo && (server.logo.startsWith('./') || server.logo.startsWith('/'))) {
        serverInfoHTML += `<img class="credential-server-logo" src="${server.logo}" alt="${server.name} logo" />`;
    } else {
        serverInfoHTML += `<div class="credential-server-emoji-logo">${server.logo}</div>`;
    }
    
    serverInfoHTML += `<h3 class="credential-server-name">${server.name}</h3>`;
    
    // Add introduction section if present
    if (server.introduction) {
        serverInfoHTML += `
            <div class="credential-separator"></div>
            <div class="credential-introduction">
                <h4>${server.introduction.icon} ${server.introduction.title}</h4>
                <p>${server.introduction.description}</p>
                <ul>
                    ${server.introduction.features.map(feature => `<li>${feature}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    serverInfo.innerHTML = serverInfoHTML;
    
    // Build credential fields or SSE info
    const fieldsContainer = document.getElementById('credentialFields');
    fieldsContainer.innerHTML = '';
    
    if (server.configType === 'sse' && server.sse) {
        // Show SSE-specific information instead of credential fields
        if (server.sse.authNotice) {
            const authDiv = document.createElement('div');
            authDiv.className = 'sse-info-section';
            authDiv.innerHTML = `
                <div class="sse-info-header">
                    <span class="sse-info-icon">ℹ️</span>
                    <span class="sse-info-title">${server.sse.authNotice.title}</span>
                </div>
                <p class="sse-info-text">${server.sse.authNotice.text}</p>
            `;
            fieldsContainer.appendChild(authDiv);
        }
        
        if (server.sse.requirements) {
            const reqDiv = document.createElement('div');
            reqDiv.className = 'sse-info-section sse-requirements';
            reqDiv.innerHTML = `
                <div class="sse-info-header">
                    <span class="sse-info-icon">⚠️</span>
                    <span class="sse-info-title">${server.sse.requirements.title}</span>
                </div>
                <p class="sse-info-text">${server.sse.requirements.text}</p>
            `;
            fieldsContainer.appendChild(reqDiv);
        }
    } else if (server.configType === 'connection_string' && server.connectionString) {
        // Connection string configuration
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'credential-field';
        
        const label = document.createElement('label');
        label.className = 'credential-label';
        label.innerHTML = `<span class="credential-label-text">${server.connectionString.label}</span><span class="credential-required">*</span>`;
        fieldDiv.appendChild(label);
        
        // Create input wrapper for password field with toggle
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'credential-input-wrapper';
        
        const input = document.createElement('input');
        input.type = 'password';
        input.className = 'credential-input';
        input.name = 'CONNECTION_STRING';
        input.placeholder = server.connectionString.placeholder || '';
        input.required = true;
        
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'credential-toggle-btn';
        toggleBtn.innerHTML = '👁️';
        toggleBtn.title = 'Show/hide connection string';
        toggleBtn.addEventListener('click', () => {
            if (input.type === 'password') {
                input.type = 'text';
                toggleBtn.classList.add('showing');
            } else {
                input.type = 'password';
                toggleBtn.classList.remove('showing');
            }
        });
        
        inputWrapper.appendChild(input);
        inputWrapper.appendChild(toggleBtn);
        fieldDiv.appendChild(inputWrapper);
        
        // Add help text
        if (server.connectionString.helpText) {
            const helpText = document.createElement('p');
            helpText.className = 'credential-help-text';
            helpText.textContent = server.connectionString.helpText;
            fieldDiv.appendChild(helpText);
        }
        
        // Add examples if provided
        if (server.connectionString.examples && server.connectionString.examples.length > 0) {
            const examplesDiv = document.createElement('div');
            examplesDiv.className = 'credential-examples';
            examplesDiv.innerHTML = '<ul>' + 
                server.connectionString.examples.map(ex => `<li><code>${ex}</code></li>`).join('') + 
                '</ul>';
            fieldDiv.appendChild(examplesDiv);
        }
        
        // Add warning if provided
        if (server.connectionString.warning) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'credential-warning';
            warningDiv.textContent = server.connectionString.warning;
            fieldDiv.appendChild(warningDiv);
        }
        
        fieldsContainer.appendChild(fieldDiv);
    } else if (server.credentials) {
        // Regular credential fields
        server.credentials.forEach(cred => {
            const field = createCredentialField(cred, server);
            fieldsContainer.appendChild(field);
        });
    }
    
    // Add links section if present
    if (server.links) {
        const linksDiv = document.createElement('div');
        linksDiv.className = 'credential-links';
        
        // Determine which link to use (github, npm, docs, etc.)
        const linkUrl = server.links.github || server.links.npm || server.links.docs || '';
        const linkText = server.links.linkText || 'View source';
        
        linksDiv.innerHTML = `<a href="#" class="credential-link" data-url="${linkUrl}">${linkText}</a>`;
        
        const link = linksDiv.querySelector('.credential-link');
        link.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.api && window.api.openExternalLink) {
                window.api.openExternalLink(linkUrl);
            }
        });
        
        fieldsContainer.appendChild(linksDiv);
    }
    
    // Reset form state
    // Enable Add Server button for SSE servers (no fields) and disable for others until validated
    const addBtn = document.getElementById('addServerFromGalleryBtn');
    // Connection string servers need validation, so keep button disabled initially
    addBtn.disabled = server.configType === 'sse' ? false : true;
    
    // Update button text for SSE servers to be clearer
    if (server.configType === 'sse') {
        addBtn.textContent = 'Add Server (Authenticate in Claude)';
    } else {
        addBtn.textContent = 'Add Server';
    }
    
    // Show/hide test button based on server type
    const testBtn = document.getElementById('testCredentialBtn');
    if (server.requiresUrlArg || server.configType === 'url' || server.configType === 'sse' || server.configType === 'connection_string') {
        // Hide test button for URL-based, SSE, and connection string servers
        testBtn.style.display = 'none';
    } else {
        // Show test button for credential-based servers
        testBtn.style.display = '';
        testBtn.querySelector('.btn-text').textContent = 'Test Connection';
        testBtn.querySelector('.btn-spinner').classList.add('hidden');
    }
    
    // Show modal
    modal.style.display = 'flex';
}

function createCredentialField(credential, server) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'credential-field';
    
    const label = document.createElement('label');
    label.className = 'credential-label';
    
    let labelContent = `<span class="credential-label-text">${credential.label}</span>`;
    if (credential.required) {
        labelContent += '<span class="credential-required">*</span>';
    }
    
    label.innerHTML = labelContent;
    fieldDiv.appendChild(label);
    
    // Create input wrapper for URL fields with toggle
    if (credential.type === 'url' && credential.hideByDefault) {
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'credential-input-wrapper';
        
        const input = document.createElement('input');
        input.type = 'password';
        input.className = 'credential-input';
        input.name = credential.key;
        input.placeholder = credential.placeholder || '';
        input.required = credential.required;
        
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'credential-toggle-btn';
        toggleBtn.innerHTML = '👁️';
        toggleBtn.title = 'Show/hide URL';
        toggleBtn.addEventListener('click', () => {
            if (input.type === 'password') {
                input.type = 'text';
                toggleBtn.classList.add('showing');
            } else {
                input.type = 'password';
                toggleBtn.classList.remove('showing');
            }
        });
        
        inputWrapper.appendChild(input);
        inputWrapper.appendChild(toggleBtn);
        fieldDiv.appendChild(inputWrapper);
    } else {
        const input = document.createElement('input');
        // Set input type based on credential type
        if (credential.type === 'email') {
            input.type = 'email';
        } else if (credential.type === 'password') {
            input.type = 'password';
        } else if (credential.type === 'url') {
            input.type = 'url';
        } else {
            input.type = 'text';
        }
        input.className = 'credential-input';
        input.name = credential.key;
        input.placeholder = credential.placeholder || '';
        input.required = credential.required;
        fieldDiv.appendChild(input);
    }
    
    // Add help text with link
    if (credential.helpText && credential.helpLinkText && credential.helpUrl) {
        const helpDiv = document.createElement('div');
        helpDiv.className = 'credential-help-text';
        helpDiv.innerHTML = `${credential.helpText} <a href="#" class="credential-help-inline-link" data-url="${credential.helpUrl}">${credential.helpLinkText} →</a>`;
        
        const helpLink = helpDiv.querySelector('.credential-help-inline-link');
        helpLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.api && window.api.openExternalLink) {
                window.api.openExternalLink(credential.helpUrl);
            }
        });
        
        fieldDiv.appendChild(helpDiv);
    } else if (credential.helpText) {
        const helpText = document.createElement('p');
        helpText.className = 'credential-help-text';
        helpText.textContent = credential.helpText;
        fieldDiv.appendChild(helpText);
    }
    
    return fieldDiv;
}

function hideCredentialModal() {
    const modal = document.getElementById('serverCredentialModal');
    if (modal) {
        modal.style.display = 'none';
        selectedServer = null;
    }
}

function validateCredentialForm() {
    const form = document.getElementById('credentialForm');
    const addBtn = document.getElementById('addServerFromGalleryBtn');
    
    if (!form || !addBtn) return;
    
    const requiredFields = form.querySelectorAll('input[required]');
    let allValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            allValid = false;
        }
    });
    
    addBtn.disabled = !allValid;
}

async function testServerWithCredentials() {
    if (!selectedServer) return;
    
    const testBtn = document.getElementById('testCredentialBtn');
    const btnText = testBtn.querySelector('.btn-text');
    const btnSpinner = testBtn.querySelector('.btn-spinner');
    
    // Show loading state
    btnText.textContent = 'Testing...';
    btnSpinner.classList.remove('hidden');
    testBtn.disabled = true;
    
    // Gather credentials
    const env = {};
    const form = document.getElementById('credentialForm');
    const inputs = form.querySelectorAll('input');
    
    inputs.forEach(input => {
        if (input.value) {
            env[input.name] = input.value;
        }
    });
    
    // Create server config
    const serverConfig = {
        command: selectedServer.command,
        args: selectedServer.args || [],
        env: env
    };
    
    try {
        const result = await window.api.testServerConfig(serverConfig);
        
        // Reset button state
        btnText.textContent = 'Test Connection';
        btnSpinner.classList.add('hidden');
        testBtn.disabled = false;
        
        if (result.success) {
            if (window.uiUtils && window.uiUtils.showToast) {
                window.uiUtils.showToast('success', 'Connection test successful!');
            }
            document.getElementById('addServerFromGalleryBtn').disabled = false;
        } else {
            if (window.uiUtils && window.uiUtils.showToast) {
                window.uiUtils.showToast('error', `Test failed: ${result.error}`);
            }
            
            // Highlight problematic fields if we can determine them
            if (result.errorType === 'exit_error' && result.stderr) {
                // Try to identify which credential might be wrong
                inputs.forEach(input => {
                    if (result.stderr.toLowerCase().includes(input.name.toLowerCase())) {
                        input.classList.add('error');
                    }
                });
            }
        }
    } catch (error) {
        btnText.textContent = 'Test Connection';
        btnSpinner.classList.add('hidden');
        testBtn.disabled = false;
        
        if (window.uiUtils && window.uiUtils.showToast) {
            window.uiUtils.showToast('error', `Test error: ${error.message}`);
        }
    }
}

async function addServerFromGallery() {
    if (!selectedServer) return;
    
    const form = document.getElementById('credentialForm');
    const inputs = form.querySelectorAll('input');
    
    // Gather credentials and URL
    const env = {};
    let urlValue = null;
    let connectionString = null;
    
    inputs.forEach(input => {
        const value = input.value.trim();
        if (value) {
            if (input.name === 'PIPEDREAM_URL' && selectedServer.requiresUrlArg) {
                // Store URL separately for args
                urlValue = value;
            } else if (input.name === 'CONNECTION_STRING' && selectedServer.configType === 'connection_string') {
                // Store connection string separately for args
                connectionString = value;
            } else {
                // Check if this credential has a urlFormat property
                const credential = selectedServer.credentials?.find(cred => cred.key === input.name);
                if (credential && credential.urlFormat && selectedServer.requiresUrlArg) {
                    // Format the URL with the credential value
                    urlValue = credential.urlFormat.replace('{value}', value);
                } else {
                    env[input.name] = value;
                }
            }
        } else if (input.required) {
            // Include empty required fields (shouldn't happen with validation)
            env[input.name] = '';
        }
        // Skip empty optional fields
    });
    
    // Create server config
    const serverConfig = {
        command: selectedServer.command,
        args: [...(selectedServer.args || [])]
    };
    
    // Add URL as last argument if required
    if (selectedServer.requiresUrlArg && urlValue) {
        serverConfig.args.push(urlValue);
    }
    
    // Add SSE URL if it's an SSE server
    if (selectedServer.configType === 'sse' && selectedServer.sse && selectedServer.sse.url) {
        serverConfig.args.push(selectedServer.sse.url);
    }
    
    // Add connection string as argument if it's a connection string server
    if (selectedServer.configType === 'connection_string' && connectionString) {
        serverConfig.args.push(connectionString);
    }
    
    // Only add env if there are environment variables
    if (Object.keys(env).length > 0) {
        serverConfig.env = env;
    }
    
    // Generate unique name
    let serverName = generateUniqueServerName(selectedServer.name);
    
    // Special cases for Google services - use underscore instead of hyphen
    if (selectedServer.id === 'google-docs' && serverName === 'Google-Docs') {
        serverName = 'google_docs';
    } else if (selectedServer.id === 'google-sheets' && serverName === 'Google-Sheets') {
        serverName = 'google_sheets';
    }
    
    // Add the server
    window.serverManagement.addServer(serverName, serverConfig);
    
    // Close modals
    hideCredentialModal();
    hideGalleryModal();
    
    // Show success message
    if (window.uiUtils && window.uiUtils.showToast) {
        window.uiUtils.showToast('success', `Added ${selectedServer.name} server`);
    }
}

// Make gallery functions available globally
window.gallery = {
    showGalleryModal,
    hideGalleryModal,
    loadGalleryData
};