---
id: extension-publishing
title: Publishing to the Hub
sidebar_position: 11
---

# Publishing to the Hub

Once your extension is complete, you can publish it to the **xnapify Extension Hub** so that other instances can install it globally via their Admin Dashboards. 

The Hub is essentially a statically generated JSON registry hosted inside the main repository's `hub/` directory. It does *not* host your code, only metadata linking to your release `.zip`.

## Publishing Workflow

1. **Build the Extension:**
   Compile your extension locally to generate its hashed ID and integrity checksum.
   ```bash
   npm run extension
   ```
2. **Extract Metadata:**
   Open the generated `package.json` inside your build folder (e.g., `build/extensions/@xnapify-extension/my-extension/package.json`). You will need the `id` (to use as your registry key) and the `integrity` (your SHA-256 checksum).
3. **Host your Archive:**
   Zip your built extension directory and upload it to a publicly accessible URL (e.g., as an artifact on a GitHub Release).
4. **Create a Hub Metadata File:**
   Fork the xnapify repository and create a new JSON file inside `hub/extensions/@xnapify-extension/my-extension.json`.
   ```json
   {
     "name": "@xnapify-extension/my-extension",
     "key": "<your-built-id>",
     "version": "1.0.0",
     "description": "Short summary",
     "category": "productivity",
     "downloadUrl": "https://github.com/you/repo/releases/download/v1.0.0/my-extension.zip",
     "checksum": "<your-built-integrity-hash>"
   }
   ```
5. **Submit a Pull Request:**
   Submit your PR to the main xnapify repository. The GitHub Actions CI will automatically validate your metadata and regenerate the central `registry.json`. Once merged, your extension will instantly appear in all live xnapify Dashboards!
