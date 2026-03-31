#!/bin/bash

# Sinket Hitter - Cloudflare Tunnel Script
# Creates free public URL

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
echo "║           🌐 CLOUDFLARE TUNNEL - FREE PUBLIC URL               ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo -e "${YELLOW}[WARNING]${NC} cloudflared not found! Installing..."
    
    # Detect platform
    if [ -n "$TERMUX_VERSION" ] || [ -d "/data/data/com.termux" ]; then
        pkg install -y cloudflared
    else
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
    fi
    
    echo -e "${GREEN}[SUCCESS]${NC} cloudflared installed"
fi

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}[WARNING]${NC} Server not running on port 3000!"
    echo ""
    echo "Start the server first:"
    echo "  ./start.sh"
    echo ""
    read -p "Start server now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ./start.sh &
        echo "Waiting for server..."
        sleep 5
    else
        exit 1
    fi
fi

echo -e "${BLUE}[INFO]${NC} Starting Cloudflare tunnel..."
echo -e "${BLUE}[INFO]${NC} This creates a free public URL"
echo ""
echo -e "${YELLOW}Note:${NC} URL changes each time you restart"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo -e "${BLUE}[INFO]${NC} Stopping tunnel..."
    if [ -n "$TUNNEL_PID" ]; then
        kill $TUNNEL_PID 2>/dev/null
    fi
    echo -e "${GREEN}[SUCCESS]${NC} Tunnel stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start tunnel
cloudflared tunnel --url http://localhost:3000 2>&1 &
TUNNEL_PID=$!

echo -e "${BLUE}[INFO]${NC} Waiting for tunnel..."
sleep 5

# Extract URL
attempts=0
max_attempts=30

while [ $attempts -lt $max_attempts ]; do
    TUNNEL_URL=$(ps aux | grep cloudflared | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1)
    
    if [ -n "$TUNNEL_URL" ]; then
        echo ""
        echo "╔════════════════════════════════════════════════════════════════╗"
        echo "║                                                                ║"
        echo "║                    🎉 TUNNEL READY!                            ║"
        echo "║                                                                ║"
        echo -e "║  ${CYAN}Public URL:${NC}                                          ║"
        echo -e "║  ${GREEN}$TUNNEL_URL${NC}                    ║"
        echo "║                                                                ║"
        echo "║  📱 Open this URL in any browser!                              ║"
        echo "║                                                                ║"
        echo "║  ⚠️  URL is temporary - restart to get new one                 ║"
        echo "║                                                                ║"
        echo "╚════════════════════════════════════════════════════════════════╝"
        echo ""
        echo -e "${BLUE}[INFO]${NC} Press Ctrl+C to stop tunnel"
        echo ""
        
        wait $TUNNEL_PID
        exit 0
    fi
    
    attempts=$((attempts + 1))
    sleep 1
done

echo -e "${RED}[ERROR]${NC} Failed to get tunnel URL"
kill $TUNNEL_PID 2>/dev/null
exit 1
