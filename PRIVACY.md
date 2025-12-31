# Privacy Policy for Coverflex Transaction Downloader

**Last Updated: December 27, 2024**

## Overview

Coverflex Transaction Downloader is a Chrome extension that allows users to download their Coverflex transaction history as CSV files. This privacy policy explains how the extension handles user data.

## Data Collection and Usage

### Authentication Token
- **What we collect:** The extension temporarily stores your Coverflex authentication token locally in your browser
- **How we collect it:** The token is captured from your browser's local storage when you visit the Coverflex activity page
- **Why we collect it:** The token is required to authenticate API requests to Coverflex's servers to fetch your transaction data
- **Where it's stored:** Exclusively in your browser's local storage using Chrome's `chrome.storage.local` API
- **How long we keep it:** The token remains until you clear your browser data or uninstall the extension

### Transaction Data
- **What we access:** Your Coverflex transaction history (dates, amounts, merchants, categories, etc.)
- **How we access it:** The extension fetches this data from Coverflex's API (`menhir-api.coverflex.com`) using your authentication token
- **What we do with it:** The data is processed locally in your browser to generate CSV files
- **Where it goes:** The CSV file is downloaded directly to your computer. No data is sent to any external servers or third parties

## Data Sharing

**We do not share, sell, or transmit your data to any third parties.**

All data processing happens entirely within your browser. The extension:
- Does NOT send data to any external servers (except Coverflex's own API to fetch your transactions)
- Does NOT track your usage
- Does NOT collect analytics
- Does NOT store your data on any remote servers

## Third-Party Services

The extension communicates only with:
- **Coverflex API** (`menhir-api.coverflex.com`) - To fetch your transaction data using your existing authentication
- **Coverflex Website** (`my.coverflex.com`) - To inject the download button and capture the authentication token

These are the same services you already use when accessing Coverflex normally.

## Permissions

The extension requires the following permissions:

- **storage:** To save your authentication token locally in your browser
- **webRequest:** To optionally intercept the authentication token from API requests (fallback method)
- **Host permissions for `my.coverflex.com`:** To inject the download button on the Coverflex activity page and access localStorage
- **Host permissions for `menhir-api.coverflex.com`:** To fetch your transaction data from Coverflex's API

## Data Security

- All data processing occurs locally in your browser
- The authentication token is stored using Chrome's secure storage API
- No data is transmitted to any servers other than Coverflex's official API
- The extension is open source and can be audited at: https://github.com/ilbonte/coverflex-downloader

## User Rights

You have the right to:
- Uninstall the extension at any time
- Clear stored data by removing the extension
- Inspect the extension's source code on GitHub

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be posted on this page with an updated "Last Updated" date.

## Contact

For questions about this privacy policy or the extension, please:
- Open an issue on GitHub: https://github.com/ilbonte/coverflex-downloader/issues
- Contact the developer via GitHub

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR)
- User data is processed transparently and with minimal collection

---

By using this extension, you acknowledge that you have read and understood this privacy policy.
