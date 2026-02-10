// CSV conversion utilities for Coverflex Transaction Downloader

const CSV_COLUMNS = [
  'id',
  'date',
  'type',
  'status',
  'merchant',
  'amount',
  'currency',
  'is_debit',
  'category',
  'product',
  'voucher_count',
  'voucher_amount',
  'rejection_reason'
];

// Extract rejection reason from description_params
function getRejectionReason(descriptionParams) {
  if (!descriptionParams || !Array.isArray(descriptionParams)) return '';
  const param = descriptionParams.find(p => p.key === 'rejection_reason');
  return param ? param.value : '';
}

// Format date from ISO to YYYY-MM-DD
function formatDate(isoDate) {
  if (!isoDate) return '';
  return isoDate.split('T')[0];
}

// Convert amount from cents to euros
function centsToEuros(cents) {
  if (cents === undefined || cents === null) return '';
  return (cents / 100).toFixed(2);
}

// Convert a single operation to CSV row
function operationToRow(op) {
  const amount = op.amount?.amount ? centsToEuros(op.amount.amount) : '';
  const signedAmount = op.is_debit && amount ? `-${amount}` : amount;

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
    op.id || '',
    formatDate(op.executed_at),
    op.type || '',
    op.status || '',
    payee,
    signedAmount,
    op.amount?.currency || '',
    op.is_debit ? 'true' : 'false',
    op.category_slug || '',
    op.product_slug || '',
    op.voucher?.count ?? '',
    op.voucher?.amount?.amount ? centsToEuros(op.voucher.amount.amount) : '',
    getRejectionReason(op.description_params)
  ];
}

// Escape CSV field (handle commas, quotes, newlines)
function escapeCSVField(field) {
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Convert row array to CSV line
function rowToCSVLine(row) {
  return row.map(escapeCSVField).join(',');
}

// Convert operations data to CSV string
export function operationsToCSV(data) {
  const operations = data?.operations?.list || [];

  if (operations.length === 0) {
    return '';
  }

  const lines = [
    rowToCSVLine(CSV_COLUMNS),
    ...operations.map(op => rowToCSVLine(operationToRow(op)))
  ];

  return lines.join('\n');
}

// Trigger CSV file download
export function downloadCSV(csvContent, filename) {
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

// Generate filename with date range
export function generateFilename(fromDate, toDate) {
  const from = fromDate.split('T')[0];
  const to = toDate.split('T')[0];
  return `coverflex-transactions_${from}_${to}.csv`;
}
