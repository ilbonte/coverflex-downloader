// Service worker for Coverflex Transaction Downloader
// Manages token storage and API interception

let cachedToken = null;

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'setToken') {
    cachedToken = request.token;
    chrome.storage.local.set({ authToken: request.token });
    sendResponse({ success: true });
  } else if (request.action === 'getToken') {
    getToken().then(token => sendResponse({ token }));
    return true; // Keep channel open for async response
  } else if (request.action === 'fetchOperations') {
    fetchOperations(request.fromDate, request.toDate)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Get token from cache or storage
async function getToken() {
  if (cachedToken) return cachedToken;

  const result = await chrome.storage.local.get('authToken');
  if (result.authToken) {
    cachedToken = result.authToken;
    return cachedToken;
  }

  return null;
}

// Fetch operations from Coverflex API
async function fetchOperations(fromDate, toDate) {
  const token = await getToken();

  if (!token) {
    throw new Error('No authentication token available. Please visit the Coverflex activity page first.');
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    const results = {
      operations: {
        list: []
      }
    };

    // 1. Fetch Welfare (Benefits) Operations
    const welfareParams = new URLSearchParams({
      'pagination': 'no',
      'usage': 'all',
      'filters[executed_from]': fromDate,
      'filters[executed_to]': toDate
    });

    const welfareUrl = `https://menhir-api.coverflex.com/api/employee/operations?${welfareParams}`;
    const welfareResponse = await fetch(welfareUrl, { method: 'GET', headers });

    if (welfareResponse.ok) {
      const welfareData = await welfareResponse.json();
      if (welfareData.operations?.list) {
        // Tag them as benefits
        const welfareList = welfareData.operations.list.map(op => ({
          ...op,
          pocket: { ...op.pocket, type: 'benefits' } // Ensure type is set
        }));
        results.operations.list.push(...welfareList);
      }
    } else if (welfareResponse.status === 401) {
      throw new Error('Authentication expired');
    }

    // 2. Fetch Pockets to find Meal ID
    const pocketsUrl = `https://menhir-api.coverflex.com/api/employee/pockets`;
    const pocketsResponse = await fetch(pocketsUrl, { method: 'GET', headers });

    if (pocketsResponse.ok) {
      const pocketsData = await pocketsResponse.json();
      const mealPocket = pocketsData.pockets?.find(p => p.type === 'meals');

      if (mealPocket) {
        // 3. Fetch Meal Movements
        const mealsParams = new URLSearchParams({
          'pocket_id': mealPocket.id,
          'pagination': 'no',
          'filters[movement_from]': fromDate.split('T')[0], // API expects YYYY-MM-DD
          'filters[movement_to]': toDate.split('T')[0]
        });

        const mealsUrl = `https://menhir-api.coverflex.com/api/employee/movements?${mealsParams}`;
        const mealsResponse = await fetch(mealsUrl, { method: 'GET', headers });

        if (mealsResponse.ok) {
          const mealsData = await mealsResponse.json();
          if (mealsData.movements?.list) {
            // Tag them as meals and normalize specific fields if necessary
            const mealsList = mealsData.movements.list.map(m => ({
              ...m,
              pocket: { ...m.pocket, type: 'meals' }
            }));
            results.operations.list.push(...mealsList);
          }
        }
      }
    }

    if (results.operations.list.length === 0 && !welfareResponse.ok) {
      // If we got nothing and the main call failed, throw the error
      throw new Error(`API error: ${welfareResponse.status}`);
    }

    // Sort by executed_at descending
    results.operations.list.sort((a, b) => new Date(b.executed_at) - new Date(a.executed_at));

    return results;

  } catch (error) {
    if (error.message === 'Authentication expired') {
      cachedToken = null;
      await chrome.storage.local.remove('authToken');
      throw new Error('Authentication expired. Please log in to Coverflex and try again.');
    }
    throw error;
  }
}

// Intercept requests to capture auth token from Coverflex's own API calls
chrome.webRequest?.onBeforeSendHeaders?.addListener(
  (details) => {
    const authHeader = details.requestHeaders?.find(h => h.name.toLowerCase() === 'authorization');
    if (authHeader && authHeader.value.startsWith('Bearer ')) {
      const token = authHeader.value.substring(7);
      if (token !== cachedToken) {
        cachedToken = token;
        chrome.storage.local.set({ authToken: token });
      }
    }
  },
  { urls: ['https://menhir-api.coverflex.com/*'] },
  ['requestHeaders']
);
