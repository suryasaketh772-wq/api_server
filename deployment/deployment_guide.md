# Production AWS EC2 Deployment Guide

This guide describes how to deploy the Realtime Bullion Pricing Backend infrastructure onto a clean **AWS EC2 Ubuntu 22.04 LTS** instance, configure an **Nginx Reverse Proxy**, secure connections using **Let's Encrypt SSL certificates**, and perform **TCP performance tuning** to easily scale to 10,000+ concurrent clients.

---

## 1. AWS EC2 Instance Configuration

### Step 1: Launch EC2 Instance
- **OS Image**: Select `Ubuntu Server 22.04 LTS (HVM), SSD Volume Type`
- **Instance Type**: Select `t3.medium` or higher (2 vCPUs, 4GB RAM is recommended to support up to 10,000 concurrent sockets smoothly; although `t3.micro` works for staging).
- **Storage**: Allocate at least `20 GB GP3` SSD volume.

### Step 2: Configure Security Groups
Add the following inbound rules to the security group bound to your EC2 instance:

| Type | Protocol | Port Range | Source | Reason |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | 22 | `My IP` (Strict) or `0.0.0.0/0` | Secure command-line access |
| **HTTP** | TCP | 80 | `0.0.0.0/0` | Certbot validation & redirects |
| **HTTPS** | TCP | 443 | `0.0.0.0/0` | Secure production user connections |

---

## 2. Server Installation & Configuration

Connect to your EC2 instance via SSH and run the following setup commands:

### Step 1: Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
```

### Step 2: Install Docker Engine & Compose
Install the official Docker Engine and dependency plugins:
```bash
# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update

# Install Docker packages:
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installations:
sudo docker --version
sudo docker compose version
```

### Step 3: Configure User Groups
To run docker commands without `sudo` prefix:
```bash
sudo usermod -aG docker $USER
# Log out and log back in, or run the following to apply immediately:
newgrp docker
```

---

## 3. High-Connection TCP Performance Tuning

To support 10,000+ simultaneous WebSocket connections without hitting default kernel limitations, apply these adjustments.

### Step 1: Adjust System Limits (Limits.conf)
Edit the security limits configuration file:
```bash
sudo nano /etc/security/limits.conf
```
Add the following lines at the bottom of the file:
```text
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
```

### Step 2: Tune Linux Kernel Parameters (Sysctl.conf)
Edit the network configuration file:
```bash
sudo nano /etc/sysctl.conf
```
Append these production TCP optimization settings:
```text
# Max open file descriptors
fs.file-max = 2097152

# Increase max concurrent connection backlog queue
net.core.somaxconn = 65535

# Increase socket receiver and transmitter buffer sizes
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216

# Enable TCP SYN Cookies (DoS flood protection)
net.ipv4.tcp_syncookies = 1

# Allow reuse of connection states in TIME_WAIT states
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15

# Increase local port allocation range
net.ipv4.ip_local_port_range = 1024 65535
```
Apply the network rules instantly:
```bash
sudo sysctl -p
```

---

## 4. Deploying the Application

### Step 1: Clone Backend Directory
Transfer your `backend/` codebase to the EC2 instance folder (e.g. under `/home/ubuntu/api_server/`).

### Step 2: Configure Environment Variables
Inside your server folder `/home/ubuntu/api_server/backend/`:
```bash
cp .env.example .env
nano .env
```
Fill in the production parameters:
```env
ENVIRONMENT=production
ALLOWED_ORIGINS="https://yourwebsite.com,https://www.yourwebsite.com"
DPGOLD_API_URL=https://statewisebcast.dpgold.in:7768/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID/dpgold
DPGOLD_API_KEY=
```

### Step 3: Boot the initial HTTP containers
```bash
# Builds and starts container groups in background mode
docker compose up -d --build
```
Verify the health check logs:
```bash
docker compose logs -f
```

---

## 5. SSL Domain & Certificate Setup (Let's Encrypt)

Ensure your DNS records (A Record) point your domain name (e.g., `bullion.yourdomain.com`) directly to your EC2 elastic public IP address.

### Step 1: Install Certbot on Host
```bash
sudo apt install -y certbot
```

### Step 2: Request SSL Certificate
Nginx is already configured to route Let's Encrypt challenge files via port 80. Run:
```bash
sudo certbot certonly --webroot -w /var/www/certbot -d bullion.yourdomain.com --email your-email@domain.com --agree-tos --no-eff-email
```
This generates your secure public/private keys under `/etc/letsencrypt/live/bullion.yourdomain.com/`.

---

## 6. Securing Nginx (Activating HTTPS)

### Step 1: Update Nginx default.conf
Edit your host's local configuration:
```bash
nano nginx/conf.d/default.conf
```

1. Change `server_name _` to your real domain name (e.g. `server_name bullion.yourdomain.com;`).
2. Inside the first `server` block (port 80), uncomment the 3 lines of HTTPS Redirect:
   ```nginx
   location / {
       return 301 https://$host$request_uri;
   }
   ```
3. Uncomment the entire `server` block listening on port `443` at the bottom of the file.
4. Replace the certificate paths to point to your domain name:
   ```nginx
   ssl_certificate /etc/letsencrypt/live/bullion.yourdomain.com/fullchain.pem;
   ssl_certificate_key /etc/letsencrypt/live/bullion.yourdomain.com/privkey.pem;
   ```

### Step 2: Reload Nginx Container
Test and reload Nginx inside Docker:
```bash
# Verify configuration syntax correctness
docker exec bullion_nginx nginx -t

# Apply SSL configuration gracefully with zero downtime!
docker exec bullion_nginx nginx -s reload
```

---

## 7. Auto-Renew SSL Certificate

Let's Encrypt certificates expire every 90 days. Set up a standard daily cron job to check and auto-renew:
```bash
sudo crontab -e
```
Add the following line at the bottom of the file to check renewals daily at 3:00 AM and reload the Nginx docker container automatically:
```text
0 3 * * * certbot renew --quiet && docker exec bullion_nginx nginx -s reload
```

---

## 8. Service Maintenance & Troubleshooting

### Check Service Status
```bash
docker compose ps
```

### Stream Live Server Logs
```bash
docker compose logs -f backend
```

### Restart Entire Service Cluster
```bash
docker compose restart
```
