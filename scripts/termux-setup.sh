#!/bin/bash

# Sinket Hitter - Termux (Android) Setup Script
# Step-by-step setup for Android devices

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
echo "║           ⚡ SINKET HITTER - TERMUX SETUP ⚡                    ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_step() { echo -e "${CYAN}[STEP $1]${NC} $2"; }

# Check if running in Termux
if [ -z "$TERMUX_VERSION" ] && [ -z "$TERMUX_API_VERSION" ]; then
    if [ ! -d "/data/data/com.termux" ]; then
        print_error "This script is designed for Termux (Android)"
        print_status "For VPS setup, use: bash scripts/setup.sh"
        exit 1
    fi
fi

print_step "1/8" "Granting storage permission..."
echo "   Tap 'Allow' when prompted"
termux-setup-storage
print_success "Storage permission granted"

print_step "2/8" "Updating packages..."
pkg update -y
print_success "Packages updated"

print_step "3/8" "Installing required packages..."
pkg install -y git nodejs wget curl
print_success "Packages installed"

print_step "4/8" "Installing Chromium browser..."
pkg install -y chromium
print_success "Chromium installed"

print_step "5/8" "Installing cloudflared..."
pkg install -y cloudflared
print_success "Cloudflared installed"

print_step "6/8" "Setting up environment..."
echo 'export PUPPETEER_EXECUTABLE_PATH=$(which chromium)' >> ~/.bashrc
export PUPPETEER_EXECUTABLE_PATH=$(which chromium)
print_success "Environment configured"

print_step "7/8" "Installing npm dependencies..."
if [ -f "package.json" ]; then
    npm install
    print_success "Dependencies installed"
else
    print_error "package.json not found. Are you in the project directory?"
    exit 1
fi

print_step "8/8" "Creating start scripts..."

cat > start.sh << 'EOF'
#!/bin/bash
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              ⚡ SINKET HITTER - STARTING... ⚡                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

export PUPPETEER_EXECUTABLE_PATH=$(which chromium)

if pgrep -f "node server.js" > /dev/null; then
    echo "⚠️  Server already running!"
    echo "   Stop it: pkill -f 'node server.js'"
    exit 1
fi

echo "📡 Starting server..."
node server.js &
SERVER_PID=$!

sleep 3

if kill -0 $SERVER_PID 2>/dev/null; then
    echo ""
    echo "✅ Server started!"
    echo ""
    echo "📱 Local: http://localhost:3000"
    echo ""
    echo "🌐 For public URL:"
    echo "   1. Swipe left → New Session"
    echo "   2. Run: cloudflared tunnel --url http://localhost:3000"
    echo ""
    wait $SERVER_PID
else
    echo "❌ Server failed to start!"
    exit 1
fi
EOF

chmod +x start.sh
print_success "Start script created"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║                   ✅ SETUP COMPLETE!                            ║"
echo "║                                                                ║"
echo "║  Next steps:                                                   ║"
echo "║                                                                ║"
echo "║  1. Start server:                                              ║"
echo "║     ./start.sh                                                 ║"
echo "║                                                                ║"
echo "║  2. Get public URL (New Session):                              ║"
echo "║     - Swipe left from edge                                     ║"
echo "║     - Tap 'New Session'                                        ║"
echo "║     - Run: cloudflared tunnel --url http://localhost:3000      ║"
echo "║                                                                ║"
echo "║  3. Copy the URL and use in browser!                           ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
