#!/bin/bash
set -e

# 🚀 Deploy Script за Kid DApp

echo "🚀 Deploying Kid DApp to production..."

# Variables
APP_DIR="/var/www/school-dapp"
SERVICE_NAME="school.api.service"
DOMAIN="kid.slavy.space"
PORT="3011"

# Check if we have build directory
if [ ! -d "build" ]; then
    echo "❌ No build directory found!"
    echo "Please run 'npm run build' first"
    exit 1
fi

# Check if port is available (kill if needed)
if netstat -tuln | grep -q ":$PORT "; then
    echo "⚠️ Port $PORT is already in use!"
    echo "Existing services on port $PORT:"
    netstat -tulnp | grep ":$PORT "
    read -p "Stop existing service and continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
    # Stop any existing service on this port
    sudo fuser -k $PORT/tcp 2>/dev/null || true
    sleep 2
fi

# Stop service if running
echo "🛑 Stopping existing service..."
sudo systemctl stop $SERVICE_NAME 2>/dev/null || true

# Create app directory
echo "📁 Preparing directories..."
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Copy files
echo "📋 Copying application files..."
sudo cp -r build $APP_DIR/
sudo cp package.json $APP_DIR/
sudo cp package-lock.json $APP_DIR/ 2>/dev/null || echo "No package-lock.json found"

# Copy node_modules if exists, otherwise will install
if [ -d "node_modules" ]; then
    echo "📦 Copying node_modules..."
    sudo cp -r node_modules $APP_DIR/
else
    echo "⚠️ node_modules not found, will install fresh"
fi

# Set ownership
sudo chown -R www-data:www-data $APP_DIR

# Install dependencies if needed
cd $APP_DIR
if [ ! -d "node_modules" ] || [ ! -f "node_modules/serve/package.json" ]; then
    echo "📦 Installing dependencies..."
    sudo -u www-data npm ci --production
    
    # Install serve specifically if not present
    if [ ! -f "node_modules/serve/package.json" ]; then
        sudo -u www-data npm install serve
    fi
fi

# Verify serve is available
if [ ! -f "node_modules/.bin/serve" ]; then
    echo "❌ serve command not found!"
    echo "Installing serve globally as fallback..."
    sudo npm install -g serve
fi

# Enable and start service
echo "🔧 Starting systemd service..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl start $SERVICE_NAME

# Check service status
echo "📊 Checking service status..."
sleep 5
if sudo systemctl is-active $SERVICE_NAME --quiet; then
    echo "✅ Service is running on port $PORT"
    pid=$(sudo systemctl show $SERVICE_NAME --property=MainPID --value)
    echo "   PID: $pid"
else
    echo "❌ Service failed to start!"
    echo "📝 Service logs:"
    sudo journalctl -u $SERVICE_NAME -n 10 --no-pager
    exit 1
fi

# Test local connection
echo "🔍 Testing local connection..."
sleep 3
if curl -s --connect-timeout 5 http://localhost:$PORT > /dev/null; then
    echo "✅ Local connection successful"
else
    echo "⚠️ Local connection failed, but service is running"
fi

# Test website through Apache
echo "🌐 Testing website..."
if curl -s --head http://$DOMAIN | head -n 1 | grep -q "200\|301\|302"; then
    echo "✅ Website is online at http://$DOMAIN"
else
    echo "⚠️ Website may not be responding through Apache yet"
    echo "   Check Apache logs: sudo tail -f /var/log/apache2/kid-error.log"
fi

echo ""
echo "🎉 Deployment completed!"
echo ""
echo "📊 Status Summary:"
echo "   🌐 Website: http://$DOMAIN"
echo "   🔌 Port: $PORT"
echo "   📁 Directory: $APP_DIR"
echo "   🔧 Service: $SERVICE_NAME"
echo ""
echo "🔧 Management Commands:"
echo "   Status: sudo systemctl status $SERVICE_NAME"
echo "   Logs: sudo journalctl -u $SERVICE_NAME -f"
echo "   Restart: sudo systemctl restart $SERVICE_NAME"
echo "   Apache logs: sudo tail -f /var/log/apache2/kid-error.log"
echo ""
echo "🔒 To enable HTTPS:"
echo "   sudo certbot --apache -d $DOMAIN -d www.$DOMAIN"
