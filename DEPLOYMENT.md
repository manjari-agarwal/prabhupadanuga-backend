# Deployment: GitHub to AWS Lightsail

## 1. Create the GitHub repository

Create a private repository named `prabhupadanuga-backend`. From the local project directory, run:

```bash
git init
git branch -M main
git add .
git commit -m "Initial Prabhupadanuga backend"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/prabhupadanuga-backend.git
git push -u origin main
```

Never commit `.env`, R2 secrets, MongoDB credentials, or private keys.

## 2. AWS Lightsail server

Create a Linux/Unix Ubuntu instance in the Mumbai region. Start with the 2 GB RAM plan. Attach a static IP. In Lightsail Networking, open TCP port `7000` only temporarily for API testing; later use HTTPS through a domain/reverse proxy.

Connect to the instance and run:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin
sudo usermod -aG docker ubuntu
exit
```

Connect again, then run:

```bash
sudo mkdir -p /opt/prabhupadanuga-backend
sudo chown ubuntu:ubuntu /opt/prabhupadanuga-backend
git clone https://github.com/YOUR_GITHUB_USERNAME/prabhupadanuga-backend.git /opt/prabhupadanuga-backend
cd /opt/prabhupadanuga-backend
cp .env.example .env
nano .env
docker compose -f docker-compose.production.yml up -d --build
curl http://localhost:7000/api/v1/health
```

## 3. Production `.env`

Set `NODE_ENV=production`, `PORT=7000`, real MongoDB Atlas/R2 secrets, long random JWT secrets, and your eventual frontend URL in `APP_ORIGIN`.

In MongoDB Atlas Network Access, add the Lightsail static IP. R2 already works with this backend; keep the R2 keys only in the server `.env`.

## 4. GitHub automatic deployment

On GitHub: Settings -> Secrets and variables -> Actions -> New repository secret:

- `LIGHTSAIL_HOST`: Lightsail static IP or server DNS name
- `LIGHTSAIL_SSH_KEY`: private key content used for the `ubuntu` user

Each push to `main` then connects to the server, pulls current code, and rebuilds the Docker container.

## 5. FE API sharing

Give the FE team the Postman collection plus one base URL variable:

```text
Development: http://LIGHTSAIL_STATIC_IP:7000/api/v1
Production: https://api.YOUR_DOMAIN/api/v1
```

Use HTTPS and a proper API subdomain before publishing the Android/iOS app.
