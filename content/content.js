// Content script for Coverflex Transaction Downloader
// Injects download button and captures auth token

const TOKEN_KEY = 'cvrflx_flightdeck_token';

// Send token to service worker
function captureToken() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      chrome.runtime.sendMessage({ action: 'setToken', token });
    }
  } catch (e) {
    console.error('Coverflex Downloader: Failed to read token', e);
  }
}

// Create download button with Coverflex styling
function createDownloadButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'coverflex-csv-download-btn';
  button.className = 'relative flex cursor-pointer items-center justify-center overflow-hidden rounded-md text-center outline-0 transition-all duration-150 ease-out bg-neutral10 min-h-[3.2rem] px-md py-xs';
  button.style.cssText = `
    background: #fde5d8;
    border: 2px solid #f88572;
    border-radius: 8px;
    padding: 8px 16px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    color: #333e4a;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.15s ease;
  `;

  // Download icon SVG
  button.innerHTML = `
    <svg viewBox="0 0 512 512" height="14" width="14" style="fill: #f88572;">
      <path d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 242.7-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7 288 32zM64 352c-35.3 0-64 28.7-64 64l0 32c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-32c0-35.3-28.7-64-64-64l-101.5 0-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352 64 352zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"/>
    </svg>
    <span>Download CSV</span>
  `;

  button.addEventListener('mouseenter', () => {
    button.style.background = '#fcd4c0';
    button.style.borderColor = '#f66b56';
  });

  button.addEventListener('mouseleave', () => {
    button.style.background = '#fde5d8';
    button.style.borderColor = '#f88572';
  });

  button.addEventListener('click', handleDownloadClick);

  return button;
}

// Handle download button click - shows modal with options
function handleDownloadClick(event) {
  event.preventDefault();

  // Capture token
  captureToken();

  // Show download modal
  showDownloadModal();
}

// CSV conversion functions (duplicated to avoid module import issues in content script)
function operationsToCSV(data) {
  const columns = [
    'id', 'date', 'type', 'status', 'merchant', 'amount', 'currency',
    'is_debit', 'category', 'product', 'voucher_count', 'voucher_amount', 'rejection_reason'
  ];

  const operations = data?.operations?.list || [];

  const escapeField = (field) => {
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const getRejectionReason = (params) => {
    if (!params || !Array.isArray(params)) return '';
    const param = params.find(p => p.key === 'rejection_reason');
    return param ? param.value : '';
  };

  const rows = operations.map(op => {
    const amount = op.amount?.amount ? (op.amount.amount / 100).toFixed(2) : '';
    const signedAmount = op.is_debit && amount ? `-${amount}` : amount;

    return [
      op.id || '',
      op.executed_at ? op.executed_at.split('T')[0] : '',
      op.type || '',
      op.status || '',
      op.merchant_name || '',
      signedAmount,
      op.amount?.currency || '',
      op.is_debit ? 'true' : 'false',
      op.category_slug || '',
      op.product_slug || '',
      op.voucher?.count ?? '',
      op.voucher?.amount?.amount ? (op.voucher.amount.amount / 100).toFixed(2) : '',
      getRejectionReason(op.description_params)
    ].map(escapeField).join(',');
  });

  return [columns.join(','), ...rows].join('\n');
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// BudgetBakers CSV conversion functions
function operationsToBudgetBakersCSV(data) {
  const operations = data?.operations?.list || [];
  const confirmedOps = operations.filter(op => op.status === 'confirmed');

  if (confirmedOps.length === 0) return '';

  const escapeField = (field) => {
    const str = String(field);
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const formatDate = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getNote = (op) => {
    const parts = [];
    if (op.type === 'topup') parts.push('Topup');
    else if (op.type === 'refund') parts.push('Refund');
    else if (op.type === 'benefit_expense') parts.push('Expense');
    if (op.category_slug) parts.push(op.category_slug);
    if (op.product_slug && op.product_slug !== op.category_slug) parts.push(op.product_slug);
    return parts.join(' - ');
  };

  const rows = confirmedOps.map(op => {
    const amount = op.amount?.amount ? (op.amount.amount / 100).toFixed(2) : '0.00';
    const signedAmount = op.is_debit ? `-${amount}` : amount;
    return [
      formatDate(op.executed_at),
      signedAmount,
      op.merchant_name || '',
      getNote(op),
      op.amount?.currency || 'EUR'
    ].map(escapeField).join(';');
  });

  return [['Date', 'Amount', 'Payee', 'Note', 'Currency'].map(escapeField).join(';'), ...rows].join('\n');
}

function downloadBudgetBakersCSV(content, filename) {
  downloadCSV(content, filename);
}

// Create and show download modal
function showDownloadModal() {
  // Remove existing modal if present
  const existingModal = document.getElementById('coverflex-download-modal');
  if (existingModal) existingModal.remove();

  // Create modal overlay
  const modal = document.createElement('div');
  modal.id = 'coverflex-download-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    width: 400px;
    max-width: 90vw;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  `;

  const year = new Date().getFullYear();

  modalContent.innerHTML = `
    <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #333e4a;">Download Transactions</h2>

    <div style="margin-bottom: 16px;">
      <label style="display: block; font-size: 12px; color: #5f7287; margin-bottom: 4px;">From</label>
      <input type="date" id="modal-from-date" value="${year}-01-01"
        style="width: 100%; padding: 10px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px;">
    </div>

    <div style="margin-bottom: 16px;">
      <label style="display: block; font-size: 12px; color: #5f7287; margin-bottom: 4px;">To</label>
      <input type="date" id="modal-to-date" value="${year}-12-31"
        style="width: 100%; padding: 10px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px;">
    </div>

    <div style="margin-bottom: 16px;">
      <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: #333e4a;">
        <input type="checkbox" id="modal-include-topups" checked style="width: 16px; height: 16px; cursor: pointer;">
        <span>Include topups</span>
      </label>
    </div>

    <div style="margin-bottom: 20px;">
      <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: #333e4a;">
        <input type="checkbox" id="modal-include-rejected" style="width: 16px; height: 16px; cursor: pointer;">
        <span>Include rejected transactions</span>
      </label>
    </div>

    <button id="modal-download-csv"
      style="width: 100%; padding: 12px; border: none; border-radius: 8px; background: #333e4a; color: white; font-size: 14px; font-weight: 600; cursor: pointer;">
      Download CSV
    </button>

    <button id="modal-download-budgetbakers"
      style="width: 100%; margin-top: 8px; padding: 12px; border: 1px solid #333e4a; border-radius: 8px; background: white; color: #333e4a; font-size: 14px; font-weight: 600; cursor: pointer;">
      CSV for BudgetBakers Wallet
    </button>

    <button id="modal-close"
      style="width: 100%; margin-top: 12px; padding: 10px; border: none; background: transparent; color: #5f7287; font-size: 13px; cursor: pointer;">
      Cancel
    </button>

    <div id="modal-status" style="margin-top: 12px; padding: 10px; border-radius: 8px; font-size: 13px; display: none;"></div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Event handlers
  const closeModal = () => modal.remove();

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);

  document.getElementById('modal-download-csv').addEventListener('click', () => {
    handleModalDownload('csv');
  });

  document.getElementById('modal-download-budgetbakers').addEventListener('click', () => {
    handleModalDownload('budgetbakers');
  });
}

// Handle download from modal
async function handleModalDownload(format) {
  const fromDateInput = document.getElementById('modal-from-date');
  const toDateInput = document.getElementById('modal-to-date');
  const includeTopupsCheckbox = document.getElementById('modal-include-topups');
  const includeRejectedCheckbox = document.getElementById('modal-include-rejected');

  const fromDate = fromDateInput.value;
  const toDate = toDateInput.value;

  if (!fromDate || !toDate) {
    showModalStatus('Please select both dates', 'error');
    return;
  }

  if (new Date(fromDate) > new Date(toDate)) {
    showModalStatus('From date must be before To date', 'error');
    return;
  }

  showModalStatus('Downloading...', 'info');

  try {
    // Format dates to ISO
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const response = await chrome.runtime.sendMessage({
      action: 'fetchOperations',
      fromDate: from.toISOString(),
      toDate: to.toISOString()
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    const data = response.data;
    const includeTopups = includeTopupsCheckbox.checked;
    const includeRejected = format === 'csv' ? includeRejectedCheckbox.checked : false;

    const filteredData = {
      ...data,
      operations: {
        ...data.operations,
        list: data.operations.list.filter(op => {
          if (!includeTopups && op.type === 'topup') return false;
          if (!includeRejected && op.status === 'rejected') return false;
          return true;
        })
      }
    };

    const operationCount = filteredData?.operations?.list?.length || 0;

    if (operationCount === 0) {
      showModalStatus('No transactions found', 'error');
      return;
    }

    let csv, filename;
    if (format === 'budgetbakers') {
      csv = operationsToBudgetBakersCSV(filteredData);
      filename = `coverflex-budgetbakers_${fromDate}_${toDate}.csv`;
    } else {
      csv = operationsToCSV(filteredData);
      filename = `coverflex-transactions_${fromDate}_${toDate}.csv`;
    }

    downloadCSV(csv, filename);
    showModalStatus(`Downloaded ${operationCount} transactions`, 'success');

    setTimeout(() => {
      document.getElementById('coverflex-download-modal')?.remove();
    }, 1500);

  } catch (error) {
    console.error('Download error:', error);
    showModalStatus(error.message, 'error');
  }
}

// Show status in modal
function showModalStatus(message, type) {
  const statusDiv = document.getElementById('modal-status');
  if (!statusDiv) return;

  const colors = {
    success: { bg: '#d1fae5', text: '#065f46' },
    error: { bg: '#fee2e2', text: '#991b1b' },
    info: { bg: '#e0f2fe', text: '#075985' }
  };

  const color = colors[type] || colors.info;
  statusDiv.style.cssText = `
    display: block;
    margin-top: 12px;
    padding: 10px;
    border-radius: 8px;
    font-size: 13px;
    background: ${color.bg};
    color: ${color.text};
  `;
  statusDiv.textContent = message;
}

// Show notification toast
function showNotification(message, type) {
  const existing = document.getElementById('coverflex-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'coverflex-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    animation: slideIn 0.3s ease;
    ${type === 'success'
      ? 'background: #d1fae5; color: #065f46;'
      : 'background: #fee2e2; color: #991b1b;'}
  `;
  notification.textContent = message;

  const style = document.createElement('style');
  style.textContent = '@keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }';
  document.head.appendChild(style);

  document.body.appendChild(notification);

  setTimeout(() => notification.remove(), 4000);
}

// Find and inject button into the page
function injectButton() {
  // Don't inject if already present
  if (document.getElementById('coverflex-csv-download-btn')) return;

  // Find the header section with "Attività" title
  const h1 = Array.from(document.querySelectorAll('h1')).find(el =>
    el.textContent.trim().toLowerCase() === 'attività'
  );

  if (!h1) {
    // Retry after a short delay if page is still loading
    setTimeout(injectButton, 1000);
    return;
  }

  // Find the button container (sibling of the title container)
  const titleContainer = h1.closest('.flex.flex-col.shrink');
  const buttonContainer = titleContainer?.parentElement?.querySelector('.flex.flex-row.gap-md.items-center.self-start');

  if (buttonContainer) {
    const csvButton = createDownloadButton();
    buttonContainer.insertBefore(csvButton, buttonContainer.firstChild);
  } else {
    // Fallback: insert after the h1
    const csvButton = createDownloadButton();
    csvButton.style.marginLeft = '16px';
    h1.parentElement.appendChild(csvButton);
  }
}

// Check if we're on an activity page
function isActivityPage() {
  const path = window.location.pathname;
  return path.includes('/activity');
}

// Initialize
captureToken();

// Wait for DOM and inject button (only on activity pages)
function tryInjectButton() {
  if (isActivityPage()) {
    injectButton();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryInjectButton);
} else {
  tryInjectButton();
}

// Debounce to avoid too many injection attempts
let debounceTimer = null;
function debouncedInjectButton() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (isActivityPage()) {
      injectButton();
    }
  }, 100);
}

// Observe for SPA navigation (DOM changes)
const observer = new MutationObserver(debouncedInjectButton);
observer.observe(document.body, { childList: true, subtree: true });

// Also listen for SPA navigation via History API
let lastPathname = window.location.pathname;
setInterval(() => {
  if (window.location.pathname !== lastPathname) {
    lastPathname = window.location.pathname;
    if (isActivityPage()) {
      injectButton();
    }
  }
}, 500);
