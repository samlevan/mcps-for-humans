# MCPs for Humans

A friendly GUI for managing Claude MCP (Model Context Protocol) configurations.

![MCPs for Humans Logo](logo.png)

## Features

- **Visual MCP Management**: Easy-to-use graphical interface for managing your Claude MCP configurations
- **Live Configuration**: Edit and test MCP configurations without manual file editing
- **Cross-Platform**: Available for macOS, Windows, and Linux
- **Dark Theme**: Beautiful, modern dark interface optimized for developer workflows
- **Real-time Testing**: Test your MCP configurations directly from the app

## Download

Download the latest release for your platform:

- **macOS**: Download `.dmg` file (supports both Intel and Apple Silicon)
- **Windows**: Download `.exe` installer or `.zip` file
- **Linux**: Download `.AppImage` or `.deb` package

## Development

### Prerequisites

- Node.js 16 or higher
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/mcp-config-gui.git
cd mcp-config-gui

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Building for Distribution

#### Build for all platforms:
```bash
npm run build
```

#### Build for specific platforms:
```bash
# macOS only
npm run build:mac

# macOS signed and notarized (requires Apple Developer account)
npm run build:mac:signed

# Windows only
npm run build:win

# Linux only
npm run build:linux
```

#### Development builds:
```bash
# Create unpacked directory (faster for testing)
npm run pack

# Create distributable packages
npm run dist
```

### Build Output

Built applications will be saved in the `dist/` directory:

- **macOS**: `.dmg` and `.zip` files
- **Windows**: `.exe` installer and `.zip` files  
- **Linux**: `.AppImage` and `.deb` packages

## License

MIT License - Open source. Free forever. Built for the Claude community.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 