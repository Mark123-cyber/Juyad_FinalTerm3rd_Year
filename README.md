# SLSU Lost and Found

A React and Vite application backed by a local SQLite database. User passwords are stored as salted hashes; authenticated sessions use HTTP-only cookies. The primary administrator account is configured locally and is never hard-coded in the app.

## First-time setup

1. Install Node.js 26 or newer.
2. From this folder, run `npm install`.
3. Run `npm run dev`. On first launch, the app creates a private `.env` file with username `admin` and a randomly generated password, then starts the Vite website and API/database server.
4. Open `.env` to view the generated admin password, or replace it with a private password of 12 to 128 characters and restart the app. Do not share or commit `.env`.
5. Open the local URL printed by Vite, usually `http://localhost:5173`.

The fixed admin username and password from `.env` are created or refreshed when the server starts. Choose **SSC / Admin / Registrar** on the sign-in form and use an authorized staff account to open the Administrator dashboard; staff accounts must be created by an administrator. Choose **Student** to sign in with an account created by campus staff. Student accounts require a unique Student ID of 3–32 letters, numbers, or hyphens; an email address is optional. Students can sign in with either their Student ID or email address. **Remember me** keeps the sign-in session on the device after closing the browser; leave it unchecked for a browser-session-only cookie.

The SQLite database is created at `server/data/lost-and-found.sqlite` and is excluded from Git. Back up this file to preserve accounts and reports.

## Student alerts and report follow-up

Students can report lost and found items directly. Staff accounts can also report either type for people who visit their office; the walk-in reporter's name is optional, and leaving it blank keeps it private. Student dashboards show searchable campus reports and an in-app notification bell. New reports and staff-confirmed claim/resolution updates notify student accounts assigned to the report's campus; the student who submitted a new report does not receive a duplicate alert. Notification events are retained in the database and appear the next time a student signs in. The notification bell refreshes while the app is open.

Email alerts are sent to campus student accounts with an email address when SMTP is configured. Add your SMTP provider's settings to the private `.env` file and restart the API:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_FROM="Lost and Found <lost-and-found@example.com>"
```

For port 465, set `SMTP_SECURE=true`. If your SMTP relay does not require authentication, omit `SMTP_USER` and `SMTP_PASSWORD`. Email delivery is disabled until `SMTP_HOST` and `SMTP_FROM` are configured; the administrator dashboard displays this status. Keep SMTP credentials private and never commit `.env`. Student email addresses are optional, so students without one still receive in-app notifications.

Administrators should mark a report **Claimed / resolved** only after campus staff verifies that the item has been returned. That status change sends one claim update to students at that campus. Reopening a report does not send an alert; marking it claimed again after reopening sends a new update.

## Administrator tools

Administrators can search and filter campus reports, mark verified returns as claimed/resolved, add/edit/remove user accounts, assign Student IDs and optional email addresses, change user roles and reset passwords, edit or remove any lost/found report, and add/remove campus choices. The fixed admin account cannot be removed or have its login, role, or password changed from the dashboard. Removing a campus that is assigned to an account is blocked until those accounts are moved to another campus.

The initial campus choices are San Juan, Hinunangan, Sogod, Bontoc, and Maasin.

## Open on a phone with Chrome

1. Connect the phone and PC to the same Wi-Fi network or turn on the PC's mobile hotspot and connect the phone to it.
2. Start the app with `npm run dev` and keep it running.
3. On the PC, run `ipconfig` and find the PC's IPv4 address for that Wi-Fi or hotspot connection.
4. In Chrome on the phone, open `http://<PC-IPv4-address>:<Vite-port>`, replacing both placeholders with the PC address and the port Vite printed (usually `5173`; for example, `http://192.168.137.1:5173`).
5. If the phone cannot connect, allow Node.js through Windows Defender Firewall on the private network and verify both devices are on the same network.

The development server listens on the PC's network interfaces so a phone can reach it. This local HTTP setup is intended for a trusted network; use HTTPS and a hardened deployment before exposing accounts or personal data to the public internet.

## Production build

Run `npm run build`, then set `NODE_ENV=production` and start the API with `npm start`. The API serves the built website and automatically enables secure session cookies when deployed over HTTPS.
