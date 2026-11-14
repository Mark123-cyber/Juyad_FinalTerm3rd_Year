# SLSU Lost and Found

A React and Vite application backed by a local SQLite database. User passwords are stored as salted hashes; authenticated sessions use HTTP-only cookies. The primary administrator account is configured locally and is never hard-coded in the app.

## First-time setup

1. Install Node.js 26 or newer.
2. From this folder, run `npm install`.
3. Run `npm run dev`. On first launch, the app creates a private `.env` file with username `admin` and a randomly generated password, then starts the Vite website and API/database server.
4. Open `.env` to view the generated admin password, or replace it with a private password of 12 to 128 characters and restart the app. Do not share or commit `.env`.
5. Open the local URL printed by Vite, usually `http://localhost:5173`.

The fixed admin username and password from `.env` are created or refreshed when the server starts. Sign in with those credentials to open the Administrator dashboard. Student accounts require a unique Student ID of 3–32 letters, numbers, or hyphens; an email address is optional. Students can sign in with either their Student ID or email address.

The SQLite database is created at `server/data/lost-and-found.sqlite` and is excluded from Git. Back up this file to preserve accounts and reports.

## Administrator tools

Administrators can add, edit, and remove user accounts; assign Student IDs and optional email addresses; change user roles and reset passwords; edit or remove any lost/found report; and add/remove campus choices. The fixed admin account cannot be removed or have its login, role, or password changed from the dashboard. Removing a campus that is assigned to an account is blocked until those accounts are moved to another campus.

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
