#!/bin/bash

# 🔧 Service Configuration Script за kid.slavy.space

echo "🚀 Setting up Kid DApp Service on port 3011..."

# Check if running as root for system files
if [ "$EUID" -ne 0 ]; then
    echo "⚠️ This script needs sudo privileges for system configuration"
    echo "Run with: sudo ./setup-service.sh"
    exit 1
fi

# 1. Create systemd service file
echo "📝 Creating systemd service..."
tee /etc/systemd/system/school.api.service > /dev/null << 'EOF'
[Unit]
Description=Kid DApp Frontend Service
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/school-dapp
ExecStart=/usr/bin/npm run serve
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3011

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/www/school-dapp

[Install]
WantedBy=multi-user.target
EOF

# 2. Create Apache VirtualHost for kid.slavy.space
echo "🌐 Creating Apache VirtualHost..."
tee /etc/apache2/sites-available/kid.slavy.space.conf > /dev/null << 'EOF'
<VirtualHost *:80>
    ServerName kid.slavy.space
    ServerAlias www.kid.slavy.space
    ServerAdmin ivanovslavy@gmail.com
    ErrorLog /var/log/apache2/kid-error.log
    CustomLog /var/log/apache2/kid-access.log combined
    
    # Enable required modules
    RewriteEngine on
    
    # Redirect HTTP to HTTPS (uncomment when SSL is ready)
    # RewriteCond %{HTTPS} off
    # RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
    
    # Proxy settings
    ProxyPreserveHost On
    ProxyTimeout 300
    
    # WebSocket support for React development
    ProxyPass "/ws" "ws://127.0.0.1:3011/ws"
    ProxyPassReverse "/ws" "ws://127.0.0.1:3011/ws"
    
    # Main proxy to React app
    ProxyPass "/" "http://127.0.0.1:3011/"
    ProxyPassReverse "/" "http://127.0.0.1:3011/"
</VirtualHost>

# HTTPS version (when SSL is ready)
<VirtualHost *:443>
    ServerName kid.slavy.space
    ServerAlias www.kid.slavy.space
    ServerAdmin ivanovslavy@gmail.com
    ErrorLog /var/log/apache2/kid-error.log
    CustomLog /var/log/apache2/kid-access.log combined
    
    # SSL Configuration (will be added by Let's Encrypt)
    SSLEngine on
    # SSLCertificateFile /etc/letsencrypt/live/kid.slavy.space/fullchain.pem
    # SSLCertificateKeyFile /etc/letsencrypt/live/kid.slavy.space/privkey.pem
    
    # Security headers
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    
    # Proxy settings
    ProxyPreserveHost On
    ProxyTimeout 300
    
    # WebSocket support
    ProxyPass "/ws" "ws://127.0.0.1:3011/ws"
    ProxyPassReverse "/ws" "ws://127.0.0.1:3011/ws"
    
    # Main proxy
    ProxyPass "/" "http://127.0.0.1:3011/"
    ProxyPassReverse "/" "http://127.0.0.1:3011/"
</VirtualHost>
EOF

# 3. Enable required Apache modules
echo "🔧 Enabling Apache modules..."
a2enmod proxy proxy_http proxy_wstunnel rewrite headers ssl 2>/dev/null || {
    echo "⚠️ Some modules may already be enabled"
}

# 4. Enable the site
echo "🌐 Enabling Apache site..."
a2ensite kid.slavy.space.conf

# 5. Test Apache configuration
echo "🔍 Testing Apache configuration..."
if apache2ctl configtest; then
    echo "✅ Apache configuration is valid"
    systemctl reload apache2
else
    echo "❌ Apache configuration has errors!"
    exit 1
fi

# 6. Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

echo ""
echo "✅ Service configuration completed!"
echo ""
echo "📋 What was created:"
echo "   - /etc/systemd/system/school.api.service"
echo "   - /etc/apache2/sites-available/kid.slavy.space.conf"
echo "   - Enabled Apache modules and site"
echo ""
echo "🚀 Next steps:"
echo "1. Build and deploy your React app to /var/www/school-dapp"
echo "2. Start the service: sudo systemctl start school.api.service"
echo "3. Enable auto-start: sudo systemctl enable school.api.service"
echo "4. Check status: sudo systemctl status school.api.service"
echo ""
echo "🔒 To add SSL later:"
echo "   sudo certbot --apache -d kid.slavy.space -d www.kid.slavy.space"
