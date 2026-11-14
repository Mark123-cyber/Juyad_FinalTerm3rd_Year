# SLSU Lost and Found

## Open the app on a phone over this PC's hotspot

1. Turn on the mobile hotspot on this PC and connect the phone to it.
2. In this folder, start the app with `npm run dev` (run `npm install` first if dependencies are not installed).
3. On the PC, run `ipconfig` and find the IPv4 address for the hotspot network adapter.
4. In Chrome on the phone, open `http://<PC-IPv4-address>:5173`, replacing the placeholder with that address (for example, `http://192.168.137.1:5173`).

Keep the development server running while using the app. If the phone cannot connect, allow Node.js/Vite through Windows Defender Firewall on the private network, and verify both devices are connected to the same hotspot. This development server listens on the PC's network interfaces; use it only on a trusted network.
