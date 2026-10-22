#!/bin/bash
# Runs ON the VM (Ubuntu, user ubuntu), after careerjet-proxy.mjs was copied to ~ and Node is in ~/node.
# Creates the secret, the systemd service and opens port 8080 in the VM's firewall. Prints the secret at the end.
set -e
SECRET=$(openssl rand -hex 24)
sudo mkdir -p /opt/careerjet-proxy
sudo cp ~/careerjet-proxy.mjs /opt/careerjet-proxy/
sudo chown -R ubuntu:ubuntu /opt/careerjet-proxy
printf 'PROXY_SECRET=%s\nPORT=8080\n' "$SECRET" | sudo tee /etc/careerjet-proxy.env >/dev/null
sudo chmod 600 /etc/careerjet-proxy.env
sudo tee /etc/systemd/system/careerjet-proxy.service >/dev/null <<'EOF'
[Unit]
Description=Careerjet proxy (fixed IP for Kaizo)
After=network-online.target

[Service]
User=ubuntu
EnvironmentFile=/etc/careerjet-proxy.env
ExecStart=/home/ubuntu/node/bin/node /opt/careerjet-proxy/careerjet-proxy.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
# the firewall of the VM: allow 8080 before the final REJECT rule, and keep it after a reboot
sudo iptables -C INPUT -p tcp --dport 8080 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 5 -p tcp -m state --state NEW --dport 8080 -j ACCEPT
sudo sh -c 'iptables-save > /etc/iptables/rules.v4'
sudo systemctl daemon-reload
sudo systemctl enable --now careerjet-proxy
sleep 1
echo "proxy: $(systemctl is-active careerjet-proxy)   bot: $(systemctl is-active ttsbot)   health: $(curl -s localhost:8080/health)"
echo "CAREERJET_PROXY_SECRET=$SECRET"
