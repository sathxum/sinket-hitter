#!/bin/bash

# Sinket Hitter - VPS Setup Script
# One-command setup for Ubuntu/Debian/CentOS

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║              ⚡ SINKET HITTER - VPS SETUP ⚡                    ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Print functions
print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    print_error "Cannot detect OS"
    exit 1
fi

print_status "Detected OS: $OS $VER"

# Update system
print_status "Updating system packages..."
if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    apt-get update -qq
    apt-get upgrade -y -qq
elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
    yum update -y -q
fi
print_success "System packages updated"

# Install Node.js
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js 18.x..."
    
    if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs -qq
    elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        yum install -y nodejs -q
    fi
    
    print_success "Node.js installed: $(node --version)"
else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$NODE_VERSION" -lt 16 ]]; then
        print_warning "Node.js version is below 16. Please upgrade."
        exit 1
    fi
    print_success "Node.js found: $(node --version)"
fi

# Install dependencies
print_status "Installing npm dependencies..."
npm install
print_success "Dependencies installed"

# Install Chrome dependencies
print_status "Installing Chrome dependencies..."
if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    apt-get install -y -qq \
        ca-certificates fonts-liberation libappindicator3-1 libasound2 \
        libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
        libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 \
        libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
        libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
        libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
        lsb-release wget xdg-utils
elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
    yum install -y -q \
        alsa-lib atk cups-libs gtk3 libXcomposite libXcursor libXdamage \
        libXext libXi libXrandr libXScrnSaver libXtst pango \
        xorg-x11-fonts-100dpi xorg-x11-fonts-75dpi xorg-x11-fonts-cyrillic \
        xorg-x11-fonts-misc xorg-x11-fonts-Type1 xorg-x11-utils
fi
print_success "Chrome dependencies installed"

# Install cloudflared
if ! command -v cloudflared &> /dev/null; then
    print_status "Installing Cloudflare Tunnel..."
    
    ARCH=$(uname -m)
    if [[ "$ARCH" == "x86_64" ]]; then
        CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
    elif [[ "$ARCH" == "aarch64" ]]; then
        CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
    else
        CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-386"
    fi
    
    wget -q "$CF_URL" -O /usr/local/bin/cloudflared
    chmod +x /usr/local/bin/cloudflared
    print_success "Cloudflare Tunnel installed"
else
    print_success "Cloudflare Tunnel already installed"
fi

# Create directories
mkdir -p logs screenshots

# Create start script
cat > start.sh << 'EOF'
#!/bin/bash
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║              ⚡ SINKET HITTER - STARTING... ⚡                  ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if pgrep -f "node server.js" > /dev/null; then
    echo "⚠️  Server already running!"
    echo "   Stop it: pkill -f 'node server.js'"
    exit 1
fi

echo "📡 Starting server on port 3000..."
node server.js &
SERVER_PID=$!

sleep 3

if kill -0 $SERVER_PID 2>/dev/null; then
    echo ""
    echo "✅ Server started successfully!"
    echo ""
    echo "📱 Local URL: http://localhost:3000"
    echo ""
    echo "🌐 To get public URL, run in another terminal:"
    echo "   npm run tunnel"
    echo ""
    echo "⏹️  To stop: pkill -f 'node server.js'"
    echo ""
    wait $SERVER_PID
else
    echo "❌ Server failed to start!"
    exit 1
fi
EOF

chmod +x start.sh

# Create systemd service
if [ -d /etc/systemd/system ]; then
    cat > /etc/systemd/system/sinket-hitter.service << EOF
[Unit]
Description=Sinket Hitter Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$(pwd)
ExecStart=$(which node) server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    print_success "Systemd service created"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║                   ✅ SETUP COMPLETE!                            ║"
echo "║                                                                ║"
echo "║  Next steps:                                                   ║"
echo "║  1. Start server:    ./start.sh                                ║"
echo "║  2. Get public URL:  npm run tunnel                            ║"
echo "║                                                                ║"
echo "║  Or use systemd:                                               ║"
echo "║  systemctl start sinket-hitter                                 ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
