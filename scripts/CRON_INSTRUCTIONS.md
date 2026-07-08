# FixBro VPS Cron Job Configuration Guide

This document lists all active automated cron jobs for the FixBro server. Keep this guide for future reference when setting up or migrating your VPS.

---

## 1. Google Indexing Cron Job
Automatically compiles your dynamic URLs and submits them to Google Indexing in daily batches.

* **Endpoint:** `https://fixbro.in/api/indexing-cron?secret=YOUR_CRON_SECRET`
* **Schedule:** Every day at 1:00 AM server time (recommended).
* **Control:** Can be paused/started or monitored from the **Google Indexing Dashboard** inside your Admin Panel. Once all pages are submitted, it automatically stops querying the database.
* **VPS Cron Command:**
  ```bash
  0 1 * * * curl -s "https://fixbro.in/api/indexing-cron?secret=\$CRON_SECRET" >/dev/null 2>&1
  ```

---

## 2. Marketing Automation Cron Job
Handles email automated flows, including abandoned cart reminders, booking reminders, and customer re-engagement.

* **Endpoint:** `https://fixbro.in/api/marketing-cron?secret=YOUR_CRON_SECRET`
* **Schedule:** Every 2 hours (recommended).
* **Control:** Configured through the **Marketing Automation Settings** dashboard.
* **VPS Cron Command:**
  ```bash
  0 */2 * * * curl -s "https://fixbro.in/api/marketing-cron?secret=\$CRON_SECRET" >/dev/null 2>&1
  ```

---

## How to Configure these on your VPS

### Step 1: Open the Cron schedule editor
SSH into your VPS and run:
```bash
crontab -e
```
*(Choose `nano` by pressing `1` if asked to select an editor).*

### Step 2: Paste the Cron rules
Go to the very bottom of the file and paste the rules. Make sure the `CRON_SECRET` variable matches your environment setting.

```bash
# 1. Google Indexing Cron (Runs Daily at 1:00 AM)
0 1 * * * curl -s "https://fixbro.in/api/indexing-cron?secret=\$CRON_SECRET" >/dev/null 2>&1

# 2. Marketing Automation Cron (Runs Every 2 Hours)
0 */2 * * * curl -s "https://fixbro.in/api/marketing-cron?secret=\$CRON_SECRET" >/dev/null 2>&1
```

### Step 3: Save and Exit
* Press `Ctrl + O` and press `Enter` to save the file.
* Press `Ctrl + X` to close the editor.
* The terminal will output: `crontab: installing new crontab`.

---

## Manual Verification & Testing
To manually test either of the cron jobs from your terminal, run:

**Test Indexing:**
```bash
curl "https://fixbro.in/api/indexing-cron?secret=YOUR_CRON_SECRET"
```

**Test Marketing:**
```bash
curl "https://fixbro.in/api/marketing-cron?secret=YOUR_CRON_SECRET"
```
