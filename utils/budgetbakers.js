// BudgetBakers CSV format utilities for Coverflex Transaction Downloader

// Format date as DD/MM/YYYY (unambiguous format for BudgetBakers)
function formatDateBudgetBakers(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Convert amount from cents to euros
function centsToEuros(cents) {
  if (cents === undefined || cents === null) return '';
  return (cents / 100).toFixed(2);
}

// Escape CSV field for semicolon delimiter
function escapeCSVField(field) {
  const str = String(field);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Get note description from operation
function getNote(op) {
  const parts = [];

  // Add type description
  if (op.type === 'topup') {
    parts.push('Topup');
  } else if (op.type === 'refund') {
    parts.push('Refund');
  } else if (op.type === 'benefit_expense') {
    parts.push('Expense');
  }

  // Add category if available
  if (op.category_slug) {
    parts.push(op.category_slug);
  }

  // Add product if available and different from category
  if (op.product_slug && op.product_slug !== op.category_slug) {
    parts.push(op.product_slug);
  }

  return parts.join(' - ');
}

// Convert a single operation to BudgetBakers CSV row
function operationToBudgetBakersRow(op) {
  const amount = op.amount?.amount ? centsToEuros(op.amount.amount) : '0.00';
  // BudgetBakers: negative for expenses (debit), positive for income
  const signedAmount = op.is_debit ? `-${amount}` : amount;

  // Payee Logic:
  // 1. Merchant name (if valid)
  // 2. Budget name (if available)
  // 3. Description (fallback)
  let payee = op.merchant_name;
  if (!payee || payee.toLowerCase() === 'unknown') {
    if (op.budget_employee?.budget?.name) {
      payee = op.budget_employee.budget.name;
    } else {
      payee = op.description || '';
    }
  }

  return [
    formatDateBudgetBakers(op.executed_at),  // Date (DD/MM/YYYY)
    signedAmount,                             // Amount (with sign on left)
    payee,                                    // Payee (merchant)
    getNote(op),                              // Note (description)
    op.amount?.currency || 'EUR'              // Currency
  ];
}

// Convert operations data to BudgetBakers CSV string
export function operationsToBudgetBakersCSV(data) {
  const operations = data?.operations?.list || [];

  // Filter: only confirmed transactions (exclude rejected)
  const confirmedOps = operations.filter(op => op.status === 'confirmed');

  if (confirmedOps.length === 0) {
    return '';
  }

  const headers = ['Date', 'Amount', 'Payee', 'Note', 'Currency'];

  const lines = [
    headers.map(escapeCSVField).join(';'),
    ...confirmedOps.map(op => operationToBudgetBakersRow(op).map(escapeCSVField).join(';'))
  ];

  return lines.join('\n');
}

// Trigger CSV file download
export function downloadBudgetBakersCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// Generate filename for BudgetBakers export
export function generateBudgetBakersFilename(fromDate, toDate) {
  const from = fromDate.split('T')[0];
  const to = toDate.split('T')[0];
  return `coverflex-budgetbakers_${from}_${to}.csv`;
}
