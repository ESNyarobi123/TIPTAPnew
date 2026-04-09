# TIPTAP bot-gateway

Bridges WhatsApp (Baileys) to the TIPTAP API.

## Baileys

- **Installed:** `@whiskeysockets/baileys@^6.17.16` (current **stable** line).  
- **npm `latest` tag** is often a **v7 RC**; upgrade only after following [Migrate to v7](https://baileys.wiki/docs/migrate-to-v7) and re-testing.  
- **Docs:** [Introduction | Baileys](https://baileys.wiki/docs/intro) — not the WhatsApp Business Cloud API; uses **Linked Devices**.  
- **Auth:** `useMultiFileAuthState` is acceptable for development; for production, replace with a proper credential store (see Baileys warnings in the official guide).
