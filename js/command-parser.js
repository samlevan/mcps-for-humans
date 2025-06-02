// Command parsing and validation functionality

// Command parsing functions
function parseCommand(input) {
    const parsedDisplay = document.getElementById('parsedDisplay');
    const parsedCommand = document.getElementById('parsedCommand');
    const parsedArgs = document.getElementById('parsedArgs');
    const commandError = document.getElementById('commandError');
    const commandInput = document.getElementById('commandInput');
    const serverCommandInput = document.getElementById('serverCommand');
    const serverArgsInput = document.getElementById('serverArgs');
    
    // Clear previous error
    commandError.classList.add('hidden');
    commandInput.classList.remove('error');
    
    if (!input.trim()) {
        parsedDisplay.classList.add('hidden');
        return;
    }
    
    try {
        const parsed = parseCommandLine(input);
        
        if (!parsed.command) {
            throw new Error('No command specified');
        }
        
        // Display parsed result
        parsedCommand.textContent = parsed.command;
        parsedArgs.textContent = parsed.args.length > 0 ? parsed.args.join(', ') : '(none)';
        parsedDisplay.classList.remove('hidden');
        
        // Update hidden fields
        serverCommandInput.value = parsed.command;
        serverArgsInput.value = parsed.args.join('\n');
        
        // Dependency warnings are now only shown after clicking Test button
    } catch (error) {
        commandError.textContent = error.message;
        commandError.classList.remove('hidden');
        commandInput.classList.add('error');
        parsedDisplay.classList.add('hidden');
    }
}

function parseCommandLine(input) {
    const args = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let escaped = false;
    
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }
        
        if (char === '\\') {
            escaped = true;
            continue;
        }
        
        if ((char === '"' || char === "'") && !inQuotes) {
            inQuotes = true;
            quoteChar = char;
            continue;
        }
        
        if (char === quoteChar && inQuotes) {
            inQuotes = false;
            quoteChar = '';
            continue;
        }
        
        if (char === ' ' && !inQuotes) {
            if (current) {
                args.push(current);
                current = '';
            }
            continue;
        }
        
        current += char;
    }
    
    if (inQuotes) {
        throw new Error(`Unclosed quote: ${quoteChar}`);
    }
    
    if (current) {
        args.push(current);
    }
    
    return {
        command: args[0] || '',
        args: args.slice(1)
    };
}

// Initialize command parser event listeners
document.addEventListener('DOMContentLoaded', () => {
    const commandInput = document.getElementById('commandInput');
    
    if (commandInput) {
        let parseTimeout = null;
        commandInput.addEventListener('input', (e) => {
            clearTimeout(parseTimeout);
            parseTimeout = setTimeout(() => {
                parseCommand(e.target.value);
            }, 300); // Debounce for 300ms
        });
    }

    // Example command buttons
    document.querySelectorAll('.example-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const command = e.target.getAttribute('data-command');
            if (commandInput) {
                commandInput.value = command;
                parseCommand(command);
            }
        });
    });
});

// Export command parser functionality
window.commandParser = {
    parseCommand,
    parseCommandLine
};