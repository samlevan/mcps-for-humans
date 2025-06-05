# MCPs for Humans

<div align="center">
  <img src="logo.png" alt="MCPs for Humans Logo" width="128" height="128">
  
  **A friendly GUI for managing Claude MCP (Model Context Protocol) configurations**
  
  *No more editing JSON files by hand. Connect Claude to external tools and data sources with a beautiful, intuitive interface.*
  
  [![Website](https://img.shields.io/badge/Website-mcpsforhumans.com-blue)](https://mcpsforhumans.com/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)](https://github.com/samlevan/mcps-for-humans/releases)
  
</div>

## ✨ What is MCPs for Humans?

MCPs for Humans transforms the way you configure Claude's MCP (Model Context Protocol) servers. Instead of manually editing JSON configuration files, you get an elegant desktop application that makes connecting Claude to external tools and data sources as simple as clicking a button.

## 🚀 Key Features

### 🎨 **Visual MCP Management**
- Beautiful, modern dark interface optimized for developer workflows
- Drag-and-drop server management
- Real-time configuration validation
- Smart command parsing with automatic quoting

### 🔧 **Easy Configuration**
- **Gallery of Popular Servers**: Pre-configured templates for Gmail, Google Docs, Salesforce, HubSpot, and more
- **Manual Entry**: Guided form interface for custom server configurations
- **JSON Import/Export**: Copy-paste support for existing configurations

### 🧪 **Live Testing**
- Test MCP configurations directly from the app
- Real-time error detection and debugging
- Detailed logs for troubleshooting
- Connection validation before saving

### 💾 **Smart Auto-Save**
- Automatic configuration backup
- Version history with restore capability

### 🌍 **Cross-Platform**
- Native apps for macOS (Intel & Apple Silicon)


## 📥 Download

Get the latest version for your platform:

### macOS
- **Universal Binary** (Intel & Apple Silicon): [Download .dmg](https://github.com/samlevan/mcps-for-humans/releases/latest)


## 🛠️ Development

### Prerequisites

- Node.js 16 or higher
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/samlevan/mcps-for-humans.git
cd mcps-for-humans

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
# macOS DMG (unsigned)
npm run build:mac

# macOS DMG - signed and notarized (requires Apple Developer account)
npm run build:mac:dmg
```

#### Code Signing and Notarization (macOS)

To build a signed and notarized DMG for distribution:

1. **Set up your Apple Developer credentials**:
   ```bash
   export APPLE_ID="your.email@example.com"
   export APPLE_ID_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password
   export APPLE_TEAM_ID="XXXXXXXXXX"
   ```

2. **Build, sign, and notarize**:
   ```bash
   npm run build:mac:dmg
   ```

   This will automatically:
   - Build the application
   - Code sign with your Developer ID certificate
   - Create a DMG installer
   - Submit to Apple for notarization
   - Staple the notarization ticket

**Note**: You need an Apple Developer account and a valid Developer ID certificate installed in your Keychain.

### Build Output

Built applications will be saved in the `dist/` directory:

- **macOS**: `.dmg` and `.zip` files

## 🤝 Contributing

We welcome contributions! Whether it's:

- 🐛 Bug reports and fixes
- ✨ New feature suggestions
- 📝 Documentation improvements  
- 🔌 New MCP server integrations

Please feel free to submit a Pull Request or open an issue.

## 📜 License

MIT License - Open source. Free forever. Built with ❤️ for the Claude community.

---

<div align="center">
  
**[Visit mcpsforhumans.com](https://mcpsforhumans.com/) • [Download Latest Release](https://github.com/samlevan/mcps-for-humans/releases/latest) • [Report Issues](https://github.com/samlevan/mcps-for-humans/issues)**

</div> 