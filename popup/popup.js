// Popup script for Coverflex Transaction Downloader

import { operationsToCSV, downloadCSV, generateFilename } from '../utils/csv.js';
import { operationsToBudgetBakersCSV, downloadBudgetBakersCSV, generateBudgetBakersFilename } from '../utils/budgetbakers.js';
import { formatDateRange } from '../utils/api.js';

// DOM elements
const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');
const includeWelfareCheckbox = document.getElementById('includeWelfare');
const includeMealsCheckbox = document.getElementById('includeMeals');
const includeTopupsCheckbox = document.getElementById('includeTopups');
const includeRejectedCheckbox = document.getElementById('includeRejected');
const downloadBtn = document.getElementById('downloadBtn');
const downloadBudgetBakersBtn = document.getElementById('downloadBudgetBakersBtn');
const statusDiv = document.getElementById('status');

// Set default dates to current year
function setDefaultDates() {
  const year = new Date().getFullYear();
  fromDateInput.value = `${year}-01-01`;
  toDateInput.value = `${year}-12-31`;
}

// Show status message
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.classList.remove('hidden');
}

// Hide status message
function hideStatus() {
  statusDiv.classList.add('hidden');
}

// Set loading state for a specific button
function setButtonLoading(button, loading) {
  button.disabled = loading;
  const btnText = button.querySelector('.btn-text');
  const btnLoading = button.querySelector('.btn-loading');
  btnText.classList.toggle('hidden', loading);
  btnLoading.classList.toggle('hidden', !loading);
}

// Set loading state for all buttons
function setLoading(loading) {
  downloadBtn.disabled = loading;
  downloadBudgetBakersBtn.disabled = loading;
}

// Handle download
async function handleDownload() {
  hideStatus();

  const fromDate = fromDateInput.value;
  const toDate = toDateInput.value;

  if (!fromDate || !toDate) {
    showStatus('Please select both dates', 'error');
    return;
  }

  if (new Date(fromDate) > new Date(toDate)) {
    showStatus('From date must be before To date', 'error');
    return;
  }

  setLoading(true);
  setButtonLoading(downloadBtn, true);

  try {
    const { from, to } = formatDateRange(fromDate, toDate);

    // Request operations from service worker
    const response = await chrome.runtime.sendMessage({
      action: 'fetchOperations',
      fromDate: from,
      toDate: to
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    const data = response.data;

    // Filter operations based on checkboxes
    const includeTopups = includeTopupsCheckbox.checked;
    const includeRejected = includeRejectedCheckbox.checked;
    const includeWelfare = includeWelfareCheckbox.checked;
    const includeMeals = includeMealsCheckbox.checked;

    const filteredData = {
      ...data,
      operations: {
        ...data.operations,
        list: data.operations.list.filter(op => {
          // Filter out topups if not included
          if (!includeTopups && op.type === 'topup') return false;
          // Filter out rejected if not included
          if (!includeRejected && op.status === 'rejected') return false;

          // Filter by transaction type
          const pocketType = op.pocket?.type;
          if (pocketType === 'benefits' && !includeWelfare) return false;
          if (pocketType === 'meals' && !includeMeals) return false;

          return true;
        })
      }
    };

    const operationCount = filteredData?.operations?.list?.length || 0;

    if (operationCount === 0) {
      showStatus('No transactions found for this period', 'error');
      return;
    }

    const csv = operationsToCSV(filteredData);
    const filename = generateFilename(from, to);

    downloadCSV(csv, filename);
    showStatus(`Downloaded ${operationCount} transactions`, 'success');

  } catch (error) {
    console.error('Download error:', error);
    showStatus(error.message, 'error');
  } finally {
    setLoading(false);
    setButtonLoading(downloadBtn, false);
  }
}

// Handle BudgetBakers download
async function handleBudgetBakersDownload() {
  hideStatus();

  const fromDate = fromDateInput.value;
  const toDate = toDateInput.value;

  if (!fromDate || !toDate) {
    showStatus('Please select both dates', 'error');
    return;
  }

  if (new Date(fromDate) > new Date(toDate)) {
    showStatus('From date must be before To date', 'error');
    return;
  }

  setLoading(true);
  setButtonLoading(downloadBudgetBakersBtn, true);

  try {
    const { from, to } = formatDateRange(fromDate, toDate);

    // Request operations from service worker
    const response = await chrome.runtime.sendMessage({
      action: 'fetchOperations',
      fromDate: from,
      toDate: to
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    const data = response.data;

    // BudgetBakers: always exclude rejected, optionally include topups
    const includeTopups = includeTopupsCheckbox.checked;
    const includeWelfare = includeWelfareCheckbox.checked;
    const includeMeals = includeMealsCheckbox.checked;

    const filteredData = {
      ...data,
      operations: {
        ...data.operations,
        list: data.operations.list.filter(op => {
          // Always exclude rejected for BudgetBakers
          if (op.status === 'rejected') return false;
          // Filter out topups if not included
          if (!includeTopups && op.type === 'topup') return false;

          // Filter by transaction type
          const pocketType = op.pocket?.type;
          if (pocketType === 'benefits' && !includeWelfare) return false;
          if (pocketType === 'meals' && !includeMeals) return false;

          return true;
        })
      }
    };

    const operationCount = filteredData?.operations?.list?.length || 0;

    if (operationCount === 0) {
      showStatus('No transactions found for this period', 'error');
      return;
    }

    const csv = operationsToBudgetBakersCSV(filteredData);
    const filename = generateBudgetBakersFilename(from, to);

    downloadBudgetBakersCSV(csv, filename);
    showStatus(`Downloaded ${operationCount} transactions for BudgetBakers`, 'success');

  } catch (error) {
    console.error('BudgetBakers download error:', error);
    showStatus(error.message, 'error');
  } finally {
    setLoading(false);
    setButtonLoading(downloadBudgetBakersBtn, false);
  }
}

// Initialize
setDefaultDates();
downloadBtn.addEventListener('click', handleDownload);
downloadBudgetBakersBtn.addEventListener('click', handleBudgetBakersDownload);
