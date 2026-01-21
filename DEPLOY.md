# Deploy to Vercel - Step by Step Guide

## Prerequisites
- A GitHub account
- A Vercel account (free at vercel.com)

---

## Step 1: Create GitHub Repository

Open PowerShell in the project folder and run:

```powershell
cd C:\Users\Usuario\.gemini\antigravity\scratch\lithium-tracker

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Lithium Price Tracker with Serverless API"
```

Then go to **github.com/new** and create a new repository called `lithium-tracker`.

```powershell
# Connect to GitHub (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/lithium-tracker.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy on Vercel

1. Go to **[vercel.com](https://vercel.com)** 
2. Click **"Sign up"** → Continue with GitHub
3. Click **"Add New Project"**
4. Find and select `lithium-tracker`
5. Click **"Deploy"** (Vercel auto-detects settings)
6. Wait ~1 minute

You'll get a URL like: `https://lithium-tracker-xxx.vercel.app`

---

## Step 3: Add to Phone Home Screen

### iPhone
1. Open URL in Safari
2. Tap Share button (square with arrow)
3. Tap **"Add to Home Screen"**
4. Name it "Lithium" and tap Add

### Android
1. Open URL in Chrome
2. Tap 3-dot menu
3. Tap **"Add to Home Screen"**

---

## Step 4: Update Prices Daily

To update prices, edit `/api/prices.js` in the `CURRENT_PRICES` object, then:

```powershell
git add .
git commit -m "Update prices Jan 22"
git push
```

Vercel auto-redeploys in ~30 seconds.

---

## How It Works

| Component | Purpose |
|-----------|---------|
| `/api/prices.js` | Serverless function that returns prices |
| `vercel.json` | Routes `/api/*` requests to serverless functions |
| React App | Fetches from `/api/prices` every 5 minutes |

---

## Your App URL

After deployment, your app will be available at:
```
https://lithium-tracker-YOUR_USERNAME.vercel.app
```

This URL works on any device with internet access!
