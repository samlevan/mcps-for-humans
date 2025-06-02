// UI utilities - toast notifications, file switcher, highlighting, etc.

// Toast notification system
function showToast(type, message) {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    
    const toastIcon = toast.querySelector('.toast-icon');
    const toastMessage = toast.querySelector('.toast-message');
    
    // Set content
    toastMessage.textContent = message;
    
    // Set type and icon
    toast.className = `toast-notification ${type}`;
    switch (type) {
        case 'success':
            toastIcon.textContent = '✅';
            break;
        case 'error':
            toastIcon.textContent = '❌';
            break;
        case 'warning':
            toastIcon.textContent = '⚠️';
            break;
        case 'info':
            toastIcon.textContent = 'ℹ️';
            break;
        default:
            toastIcon.textContent = 'ℹ️';
    }
    
    // Show toast
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 4000);
}

function highlightNewServer(serverName) {
    // Wait for re-render, then highlight
    setTimeout(() => {
        const serverItems = document.querySelectorAll('.server-item');
        for (const item of serverItems) {
            const nameElement = item.querySelector('.server-readiness-name, h3');
            if (nameElement && nameElement.textContent.trim() === serverName) {
                item.classList.add('newly-added');
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Remove the highlight class after animation completes
                setTimeout(() => {
                    item.classList.remove('newly-added');
                }, 3000); // Match the 3s animation duration
                
                break;
            }
        }
    }, 100);
}

// File switcher functions removed - now handled by file path icons

// Environment variable row management
function addEnvVarRow(key = '', value = '') {
    const envVarsList = document.getElementById('envVarsList');
    if (!envVarsList) return;
    
    const row = document.createElement('div');
    row.className = 'env-var-row';
    
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.placeholder = 'Variable name';
    keyInput.value = key;
    keyInput.className = 'env-var-key';
    
    const valueWrapper = document.createElement('div');
    valueWrapper.className = 'env-var-value-wrapper';
    
    const valueInput = document.createElement('input');
    valueInput.type = 'password';
    valueInput.placeholder = 'Value';
    valueInput.value = value;
    valueInput.className = 'env-var-value';
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn-small btn-icon';
    toggleBtn.innerHTML = '👁';
    toggleBtn.title = 'Show/hide value';
    toggleBtn.onclick = () => {
        if (valueInput.type === 'password') {
            valueInput.type = 'text';
            toggleBtn.innerHTML = '🙈';
        } else {
            valueInput.type = 'password';
            toggleBtn.innerHTML = '👁';
        }
    };
    
    valueWrapper.appendChild(valueInput);
    valueWrapper.appendChild(toggleBtn);
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-small btn-danger';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => row.remove();
    
    row.appendChild(keyInput);
    row.appendChild(valueWrapper);
    row.appendChild(removeBtn);
    
    envVarsList.appendChild(row);
}

// Add Server dropdown functions
function toggleAddServerDropdown() {
    const dropdown = document.getElementById('addServerDropdownMenu');
    const button = document.getElementById('addServerDropdownBtn');
    
    if (!dropdown || !button) return;
    
    if (dropdown.classList.contains('hidden')) {
        showAddServerDropdown();
    } else {
        hideAddServerDropdown();
    }
}

function showAddServerDropdown() {
    const dropdown = document.getElementById('addServerDropdownMenu');
    const button = document.getElementById('addServerDropdownBtn');
    
    if (!dropdown || !button) return;
    
    dropdown.classList.remove('hidden');
    button.classList.add('open');
    
    // Focus first item for accessibility
    const firstItem = dropdown.querySelector('.dropdown-item');
    if (firstItem) {
        firstItem.setAttribute('tabindex', '0');
        firstItem.focus();
    }
}

function hideAddServerDropdown() {
    const dropdown = document.getElementById('addServerDropdownMenu');
    const button = document.getElementById('addServerDropdownBtn');
    
    if (!dropdown || !button) return;
    
    dropdown.classList.add('hidden');
    button.classList.remove('open');
    
    // Remove tabindex from items
    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.removeAttribute('tabindex');
    });
}

function navigateDropdown(direction) {
    const items = Array.from(document.querySelectorAll('#addServerDropdownMenu .dropdown-item'));
    const currentIndex = items.findIndex(item => item === document.activeElement);
    const nextIndex = currentIndex + direction;
    
    if (nextIndex >= 0 && nextIndex < items.length) {
        items[nextIndex].focus();
    }
}

// Initialize UI utilities event listeners
document.addEventListener('DOMContentLoaded', () => {
    // File switcher button removed - now handled by clicking the file path
    
    // File switcher dropdown removed - now handled by icons

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.add-server-dropdown')) {
            hideAddServerDropdown();
        }
    });

    // Enhanced Add Server dropdown functionality
    document.getElementById('addServerDropdownBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        // Open gallery instead of dropdown
        if (window.gallery && window.gallery.showGalleryModal) {
            window.gallery.showGalleryModal();
        }
    });

    document.getElementById('manualEntryOption')?.addEventListener('click', () => {
        hideAddServerDropdown();
        if (window.serverManagement) {
            window.serverManagement.setEditingServerName(null);
            window.serverManagement.setEditingDisabledServer(false);
        }
        if (window.modals && window.modals.showServerModal) {
            window.modals.showServerModal();
        }
    });

    document.getElementById('pasteJsonOption')?.addEventListener('click', () => {
        hideAddServerDropdown();
        if (window.importExport && window.importExport.showSingleServerImportModal) {
            window.importExport.showSingleServerImportModal();
        }
    });

    // Add environment variable button
    document.getElementById('addEnvVarBtn')?.addEventListener('click', () => {
        addEnvVarRow('', '');
    });
    
    // Keyboard support for dropdown
    document.addEventListener('keydown', (e) => {
        const dropdown = document.getElementById('addServerDropdownMenu');
        if (dropdown && !dropdown.classList.contains('hidden')) {
            if (e.key === 'Escape') {
                hideAddServerDropdown();
                document.getElementById('addServerDropdownBtn')?.focus();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                navigateDropdown(e.key === 'ArrowDown' ? 1 : -1);
            } else if (e.key === 'Enter') {
                const focusedItem = document.activeElement;
                if (focusedItem && focusedItem.classList.contains('dropdown-item')) {
                    focusedItem.click();
                }
            }
        }
    });
});

// Export UI utilities
window.uiUtils = {
    showToast,
    highlightNewServer,
    addEnvVarRow,
    toggleAddServerDropdown,
    showAddServerDropdown,
    hideAddServerDropdown,
    navigateDropdown
};