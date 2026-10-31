# Secure connection (HTTPS) for the clinic network

Without HTTPS, anyone on the clinic Wi-Fi or network could read passwords and patient records as they travel
between a tablet and the clinic computer. **The app refuses to accept network connections until HTTPS is set up**
(it will only talk to the computer it runs on). This page is for whoever looks after the clinic computer.

## How it works

You create a small private "clinic certificate authority" once. It signs a certificate for the clinic computer.
Each phone, tablet or PC that will use the app installs the clinic's **public** certificate (`ca.crt`) once, after which
the browser shows the padlock and no warnings. Nothing is sent to any outside service and no internet is needed.

## One-time setup on the clinic computer

1. **Give the computer a fixed address.** In the router, reserve one IP address for the clinic computer
   (called a DHCP reservation or static lease). The certificate is issued for that address; if the address changes,
   browsers will warn again and the certificate must be reissued.
2. **Create the certificates** (PowerShell, in the app folder). Choose a CA passphrase of at least 12 characters.

   ```powershell
   $env:CLINIC_CA_PASSPHRASE = "choose a long passphrase here"
   npm run cert -- --name clinic-pc --ip 192.168.1.20
   ```

   Use the computer's real name and the reserved address. You can repeat `--name` and `--ip` to add more.
   Without any `--name/--ip` it uses this computer's current name and addresses.
3. **Keep the CA safe.** Copy the whole `tls` folder (it is in the data folder, shown when the app starts) to a USB drive
   and keep that USB drive and the CA passphrase somewhere other than this computer. The CA key inside is encrypted,
   and is needed only to renew the certificate. `server.key` stays on the computer and must not be shared.
4. **Allow the connection through Windows Firewall** (run once, as administrator):

   ```powershell
   New-NetFirewallRule -DisplayName "Clinic app" -Direction Inbound -Protocol TCP -LocalPort 3080 -Action Allow -Profile Private
   ```

   Keep the network profile set to *Private*, and do not expose this port to the internet (no router port forwarding).
5. **Start the app listening on the network:**

   ```powershell
   $env:HOST = "0.0.0.0"
   npm start
   ```

   It prints `listening on https://...`. If it says "Refusing to listen ... without HTTPS", step 2 was not completed.
6. Staff open `https://clinic-pc:3080` (or `https://192.168.1.20:3080`). Plain `http://` does not work by design.

## Install the clinic certificate on each device (once)

Get `ca.crt` onto the device: the doctor can open **Clinic** in the menu and press *Download the clinic certificate*
(do this on a device you already trust, or copy the file from the `tls` folder using a USB drive or a message to yourself).
It contains no secrets.

- **Windows PC:** double-click `ca.crt` → Install Certificate → Local Machine (or Current User) → *Place all certificates in the
  following store* → **Trusted Root Certification Authorities** → Finish. Restart the browser.
- **Android:** Settings → Security → Encryption & credentials → Install a certificate → **CA certificate** → choose the file
  (accept the warning: you are trusting the clinic's own authority).
- **iPhone / iPad:** open the file → Settings → *Profile Downloaded* → Install; then Settings → General → About →
  Certificate Trust Settings → switch on full trust for *Clinic Local CA*.

Only install this certificate on devices the clinic controls. A device that trusts it will trust anything signed with the CA key,
which is why that key is encrypted and kept off the computer.

## Renewal (every 2 years)

The server certificate lasts 2 years. The app warns the doctor (Clinic page and a bar on every screen) for the last 30 days,
and refuses to start with an expired certificate. To renew, put the `tls` folder back if needed and run the same
`npm run cert` command with the same CA passphrase; devices do not need anything reinstalled (same CA). Restart the app.
If you change the computer name or address, run it with the new `--name/--ip` and restart.

## What this does and does not give you

- Encrypts everything between staff devices and the clinic computer, and lets them confirm they are talking to the real one.
- The session cookie is marked *Secure* and the browser is told to keep using HTTPS for this address.
- It does not protect a stolen or unlocked device, or the data on the clinic computer's disk (use BitLocker),
  and it does not make it safe to expose the app to the internet.
- There is no automatic redirect from `http://` to `https://`. To start the app by itself when Windows starts, see `AUTO-START.md`.
