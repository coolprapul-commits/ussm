// Helper for customize dashboard localStorage key
function getCustomizeKey() {
  return `customize_${userId}`;
}

// Patch service rendering to use customized selection
async function loadAndRenderServices() {
  let filteredServices = services;
  const customIdxs = JSON.parse(localStorage.getItem(getCustomizeKey()) || 'null');
  if (Array.isArray(customIdxs)) {
    filteredServices = customIdxs.map(idx => services[idx]).filter(Boolean);
  }
  renderServices(filteredServices);
  renderAnalytics(filteredServices);
}

// Replace initial renderServices call with loadAndRenderServices
document.addEventListener('DOMContentLoaded', async () => {
  await fetchServices();
  await loadAndRenderServices();
});
// --- Real-time Google.com status check ---
async function fetchGoogleStatus() {
  try {
    // Use a public API or fetch google.com homepage (CORS may block direct fetch from frontend)
    // For demo, use backend endpoint: /api/check-google
    const res = await fetch('http://localhost:3001/api/check-google');
    const data = await res.json();
    // Find google.com service in dashboard
    const idx = services.findIndex(s => s.name.toLowerCase().includes('google'));
    if (idx !== -1) {
      services[idx].status = data.status;
      services[idx].lastUpdated = new Date().toISOString().slice(0,16).replace('T',' ');
      await saveService(services[idx]);
      filterServices();
    }
  } catch (err) {
    console.error('Error fetching Google.com status:', err);
  }
}

// Poll Google.com status every 1 minute
setInterval(fetchGoogleStatus, 60000);
// Initial fetch on page load
window.addEventListener('DOMContentLoaded', fetchGoogleStatus);

// Helper to get IST time string
function getISTTimeString() {
  const now = new Date();
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
  return istDate.toISOString().slice(0,16).replace('T',' ');
}

// Update fetchGoogleStatus to use IST time for lastUpdated
async function fetchGoogleStatus() {
  try {
    const res = await fetch('http://localhost:3001/api/check-google');
    const data = await res.json();
    const idx = services.findIndex(s => s.name.toLowerCase().includes('google'));
    if (idx !== -1) {
      services[idx].status = data.status;
      services[idx].lastUpdated = getISTTimeString();
      await saveService(services[idx]);
      filterServices();
    }
  } catch (err) {
    console.error('Error fetching Google.com status:', err);
  }
}
// Store and retrieve userId after login
let userId = localStorage.getItem('ussm_userId') || '';
let services = [];

// Fetch userId from backend after login (call this after login or page load)
async function fetchUserId() {
  const username = localStorage.getItem('ussm_user');
  if (!username) return '';
  const res = await fetch('http://localhost:3001/api/users');
  const users = await res.json();
  const user = users.find(u => u.username === username);
  if (user) {
    userId = user.id;
    localStorage.setItem('ussm_userId', userId);
  }
  return userId;
}
// Key for storing customized dashboard selection in localStorage
function getCustomizeKey() {
  const user = localStorage.getItem('ussm_user') || '';
  return `ussm_customize_list_${user}`;
}
// Utility to fetch and render all services (fixes ReferenceError)
async function loadAndRenderServices() {
  services = await fetchServices();
  filterServices();
  if (typeof updatePieChart === 'function') {
    const statusTypes = Object.keys(statusMap);
    const statusCounts = {};
    statusTypes.forEach(type => {
      statusCounts[type] = services.filter(s => s.status === type).length;
    });
    updatePieChart(statusCounts);
  }
}
// API base URL
const API_BASE = 'http://localhost:3001/api/services';

// Fetch all services from backend
async function fetchServices() {
  const res = await fetch(API_BASE);
  const data = await res.json();
  console.log('Fetched services:', data);
  return data;
}

// Save (add/update) a service to backend
async function saveService(service) {
  await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(service)
  });
}

// Delete a service by name
async function deleteServiceByName(name) {
  await fetch(`${API_BASE}/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

// Render the pie chart on page load with all services
async function renderInitialPieChart() {
  services = await fetchServices();
  const statusTypes = Object.keys(statusMap);
  const statusCounts = {};
  statusTypes.forEach(type => {
    statusCounts[type] = services.filter(s => s.status === type).length;
  });
  updatePieChart(statusCounts);
}

//create a function to get all data from excel



// Chart.js pie chart rendering for analytics
// Navbar interactivity: highlight active, show/hide sections
document.addEventListener('DOMContentLoaded', function() {
  const navLinks = document.querySelectorAll('.nav-link');
  const dashboardSection = document.querySelector('.container');
  const favouritesSection = document.getElementById('favouritesSection');
  const settingsSection = document.getElementById('settingsSection');

  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      navLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');
      // Show/hide sections
      if (this.textContent.includes('Dashboard')) {
        dashboardSection.style.display = '';
        if (favouritesSection) favouritesSection.style.display = 'none';
        if (settingsSection) settingsSection.style.display = 'none';
      } else if (this.textContent.includes('Favourites')) {
        dashboardSection.style.display = 'none';
        if (favouritesSection) favouritesSection.style.display = '';
        if (settingsSection) settingsSection.style.display = 'none';
      } else if (this.textContent.includes('Settings')) {
        dashboardSection.style.display = 'none';
        if (favouritesSection) favouritesSection.style.display = 'none';
        if (settingsSection) settingsSection.style.display = '';
      }
    });
  });
  // Initial state: show dashboard, hide others
  if (dashboardSection) dashboardSection.style.display = '';
  if (favouritesSection) favouritesSection.style.display = 'none';
  if (settingsSection) settingsSection.style.display = 'none';
});
function updatePieChart(statusCounts) {
  const ctx = document.getElementById('statusPieChart').getContext('2d');
  const statusTypes = Object.keys(statusMap);
  const data = {
    labels: statusTypes,
    datasets: [{
      data: statusTypes.map(type => statusCounts[type] || 0),
      backgroundColor: statusTypes.map(type => statusMap[type].color),
      borderWidth: 0
    }]
  };
  if (window.pieChart) {
    window.pieChart.data = data;
    window.pieChart.update();
    return;
  }
  window.pieChart = new Chart(ctx, {
    type: 'pie',
    data,
    options: {
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: { size: 14 } } }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

const statusMap = {
  'Operational': { class: 'status-operational', icon: 'fa-circle-check', color: '#2ecc40' },
  'Partial Outage': { class: 'status-partial', icon: 'fa-triangle-exclamation', color: '#f1c40f' },
  'Down': { class: 'status-down', icon: 'fa-circle-xmark', color: '#e74c3c' },
  'Planned Maintenance': { class: 'status-maintenance', icon: 'fa-screwdriver-wrench', color: '#3498db' },
  'Under Investigation': { class: 'status-investigation', icon: 'fa-magnifying-glass', color: '#232a34' }
};

function getCurrentUser() {
  return localStorage.getItem('ussm_user') || '';
}
// Get favourites from backend
async function getFavourites() {
  if (!userId) await fetchUserId();
  if (!userId) return [];
  const res = await fetch(`http://localhost:3001/api/favourites/${userId}`);
  const data = await res.json();
  return data.map(f => f.serviceName);
}
// Save favourites to backend
async function setFavourites(favs) {
  if (!userId) userId = await fetchUserId();
  if (!userId) {
    console.error('No userId found, cannot save favourites');
    return;
  }
  console.log('Saving favourites for userId:', userId, favs);
  // Delete all current favourites for user
  await fetch(`http://localhost:3001/api/favourites/${userId}`, { method: 'DELETE' });
  // Add new favourites
  for (const name of favs) {
    await fetch('http://localhost:3001/api/favourites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, serviceName: name })
    });
  }
}

async function renderServices(list) {
  const container = document.getElementById('serviceCards');
  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = '<div class="col-12 text-center text-muted">No services found.</div>';
    return;
  }
  const role = localStorage.getItem('ussm_role') || 'user';
  let favs = [];
  if (role === 'user') {
    favs = await getFavourites();
  }
  list.forEach((s, idx) => {
    const st = statusMap[s.status];
    let maintenanceInfo = '';
    if (s.status === 'Planned Maintenance' && (s.maintenanceStart || s.maintenanceEnd)) {
      maintenanceInfo = `<div class='mt-2' style='font-size:1.05em;color:#800000;font-weight:bold;'><i class='fa fa-clock me-1'></i>Maintenance: ${s.maintenanceStart ? s.maintenanceStart.replace('T',' ') : ''} - ${s.maintenanceEnd ? s.maintenanceEnd.replace('T',' ') : ''}</div>`;
    }
    let urlInfo = '';
    if (s.url) {
      urlInfo = `<div class='mt-2'><a href='${s.url}' target='_blank' rel='noopener noreferrer' style='word-break:break-all;font-size:0.98em;'><i class='fa fa-link me-1'></i>${s.url}</a></div>`;
    }
    let actionBtns = '';
    if (role === 'admin' || role === 'developer') {
      actionBtns = `
        <button class="btn btn-sm btn-outline-primary edit-btn" data-idx="${idx}" title="Edit"><i class="fa fa-edit"></i></button>
        <button class="btn btn-sm btn-outline-danger ms-2 delete-btn" data-idx="${idx}" title="Delete"><i class="fa fa-trash"></i></button>
      `;
    }
    // Star icon for favourite
    let star = '';
    if (role === 'user') {
      const isFav = favs.includes(s.name);
      star = `<span class="fav-star" data-name="${s.name}" style="cursor:pointer;font-size:1.3em;color:${isFav ? '#FFD700' : '#bbb'};" title="${isFav ? 'Remove from' : 'Add to'} favourites"><i class="fa${isFav ? 's' : 'r'} fa-star"></i></span>`;
    }
    container.innerHTML += `
      <div class="col-md-4 mb-4">
        <div class="card shadow-sm">
          <div class="card-body">
            <h5 class="card-title d-flex justify-content-between align-items-center">
              <span>${s.name} ${star}</span>
              <span>${actionBtns}</span>
            </h5>
            <h6 class="card-subtitle mb-2 text-muted">${s.type}</h6>
            <span class="status-badge ${st.class}">
              <i class="fa-solid ${st.icon} me-1"></i> ${s.status}
            </span>
            ${maintenanceInfo}
            ${urlInfo}
            <div class="mt-2 text-secondary" style="font-size:0.95em;">
              <i class="fa-regular fa-clock me-1"></i> Last updated: ${s.lastUpdated}
            </div>
          </div>
        </div>
      </div>
    `;
  });
  // Attach edit/delete button listeners only if admin/developer
  if (role === 'admin' || role === 'developer') {
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        openServiceModal('edit', parseInt(this.getAttribute('data-idx')));
      });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const idx = parseInt(this.getAttribute('data-idx'));
        deleteService(idx);
      });
    });
  }
  // Attach favourite star listeners for users
  if (role === 'user') {
    document.querySelectorAll('.fav-star').forEach(star => {
      star.addEventListener('click', async function() {
        const name = this.getAttribute('data-name');
        let favs = await getFavourites();
        if (favs.includes(name)) {
          favs = favs.filter(f => f !== name);
        } else {
          favs.push(name);
        }
        await setFavourites(favs);
        // Re-fetch favourites and re-render services to update UI
        favs = await getFavourites();
        renderFavouriteToggle();
        let filtered = await getCustomizedServices();
        renderServices(filtered);
      });
    });
  }
}

async function getCustomizedServices() {
  const role = localStorage.getItem('ussm_role') || 'user';
  if (role === 'user') {
    const favs = await getFavourites();
    if (window.showAllServices || favs.length === 0) {
      return services;
    }
    // If user has favourites and showAllServices is false, show only favourites
    return services.filter(s => favs.includes(s.name));
  }
  const selected = JSON.parse(localStorage.getItem(getCustomizeKey()));
  if (!selected) return services;
  const filtered = services.filter((s, idx) => selected.includes(idx));
  console.log('Custom dashboard selection:', selected, 'Filtered services:', filtered);
  return filtered;
}
filterServices = async function() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  let filtered = await getCustomizedServices();
  filtered = filtered.filter(s =>
    (!search || s.name.toLowerCase().includes(search)) &&
    (!status || s.status === status) &&
    (!pieStatusFilter || s.status === pieStatusFilter)
  );
  renderServices(filtered);
}

function logout() {
  localStorage.removeItem('ussm_logged_in');
  window.location.href = 'index.html';
}

// Auth check
if (localStorage.getItem('ussm_logged_in') !== '1') {
  window.location.href = 'index.html';
}

// Logout function for dashboard
window.logout = function() {
  localStorage.removeItem('ussm_logged_in');
  localStorage.removeItem('ussm_role');
  window.location.href = 'index.html';
};

// Ensure logout button works
document.addEventListener('DOMContentLoaded', function() {
  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      window.logout();
    });
  }
});

document.getElementById('statusFilter').addEventListener('change', filterServices);
document.getElementById('searchInput').addEventListener('input', filterServices);
document.getElementById('statusFilter').addEventListener('change', filterServices);



// Add Service Modal logic (FAB always visible for admin/developer)
const addServiceBtn = document.getElementById('addServiceBtn');
const serviceModal = new bootstrap.Modal(document.getElementById('serviceModal'));
const serviceForm = document.getElementById('serviceForm');
let editIdx = null;

addServiceBtn.addEventListener('click', (e) => {
  e.preventDefault();
  if (['admin','developer'].includes(localStorage.getItem('ussm_role'))) {
    openServiceModal('add');
  }
});
addServiceBtn.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && ['admin','developer'].includes(localStorage.getItem('ussm_role'))) {
    e.preventDefault();
    openServiceModal('add');
  }
});

function openServiceModal(mode, idx) {
  document.getElementById('serviceModalTitle').textContent = mode === 'add' ? 'Add Service' : 'Edit Service';
  serviceForm.reset();
  editIdx = null;
  document.getElementById('maintenanceTimeFields').style.display = 'none';
  if (mode === 'edit' && typeof idx === 'number') {
    editIdx = idx;
    const s = services[idx];
    document.getElementById('serviceName').value = s.name;
    document.getElementById('serviceType').value = s.type;
    document.getElementById('serviceStatus').value = s.status;
    document.getElementById('serviceUrl').value = s.url || '';
    if (s.status === 'Planned Maintenance') {
      document.getElementById('maintenanceTimeFields').style.display = '';
      document.getElementById('maintenanceStart').value = s.maintenanceStart || '';
      document.getElementById('maintenanceEnd').value = s.maintenanceEnd || '';
    }
  }
  serviceModal.show();
}

// Unified add/edit handler: update services, update customized list if needed, rerender all
serviceForm.onsubmit = async function(e) {
  e.preventDefault();
  try {
    const name = document.getElementById('serviceName').value.trim();
    const type = document.getElementById('serviceType').value;
    const status = document.getElementById('serviceStatus').value;
    const url = document.getElementById('serviceUrl') ? document.getElementById('serviceUrl').value.trim() : '';
    const now = new Date().toISOString().slice(0,16).replace('T',' ');
    let maintenanceStart = '';
    let maintenanceEnd = '';
    if (status === 'Planned Maintenance') {
      maintenanceStart = document.getElementById('maintenanceStart').value;
      maintenanceEnd = document.getElementById('maintenanceEnd').value;
    }
    const serviceObj = { name, type, status, lastUpdated: now, maintenanceStart, maintenanceEnd, url };
    await saveService(serviceObj);
    serviceModal.hide();
    setTimeout(() => {
      document.body.classList.remove('modal-open');
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    }, 300);
    await loadAndRenderServices();
    // Optionally, restore focus to Add Service button for accessibility
    const addBtn = document.getElementById('addServiceBtn');
    if (addBtn) addBtn.focus();
  } catch (err) {
    alert('Error adding service: ' + (err.message || err));
    serviceModal.hide();
    document.body.classList.remove('modal-open');
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
  }
};


// Customize Dashboard Modal logic
const customizeBtn = document.getElementById('customizeBtn');
const customizeModal = new bootstrap.Modal(document.getElementById('customizeModal'));
const customizeForm = document.getElementById('customizeForm');
const customizeList = document.getElementById('customizeList');

customizeBtn.addEventListener('click', () => {
  customizeList.innerHTML = '';
  services.forEach((s, idx) => {
  const checked = (JSON.parse(localStorage.getItem(getCustomizeKey())) || []).includes(idx);
    customizeList.innerHTML += `
      <div class="form-check mb-2">
        <input class="form-check-input" type="checkbox" value="${idx}" id="customApp${idx}" ${checked ? 'checked' : ''}>
        <label class="form-check-label" for="customApp${idx}">${s.name} <span class="text-muted">(${s.type})</span></label>
      </div>
    `;
  });
  customizeModal.show();
});

// Patch deleteService to use API
async function deleteService(idx) {
  if (!confirm('Are you sure you want to delete this service?')) return;
  const name = services[idx].name;
  await deleteServiceByName(name);
  await loadAndRenderServices();
}

// Patch customize dashboard to rerender analytics
customizeForm.onsubmit = async function(e) {
  e.preventDefault();
  // Save customized selection for current user
  const selected = Array.from(customizeList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
  localStorage.setItem(getCustomizeKey(), JSON.stringify(selected));
  customizeModal.hide();
  await loadAndRenderServices();
};

// Always render dashboard data and chart on DOMContentLoaded
window.addEventListener('DOMContentLoaded', async () => {
  // Fetch and display boards shared with the user
  const sharedRes = await fetch(`http://localhost:3001/api/shared-board/${userId}`);
  const sharedBoards = await sharedRes.json();
  if (sharedBoards.length > 0) {
    // Add a dropdown to select which board to view
    let select = document.getElementById('sharedBoardSelect');
    if (!select) {
      select = document.createElement('select');
      select.id = 'sharedBoardSelect';
      select.className = 'form-select mb-3';
      select.style.maxWidth = '320px';
      select.innerHTML = `<option value="my">My Board</option>`;
      document.querySelector('.container').insertBefore(select, document.getElementById('serviceCards'));
    }
    sharedBoards.forEach((b, idx) => {
      select.innerHTML += `<option value="shared${idx}">Shared by ${b.ownerUserId}</option>`;
    });
    select.onchange = function() {
      if (select.value === 'my') {
        filterServices();
      } else {
        const idx = parseInt(select.value.replace('shared',''));
        const board = sharedBoards[idx];
        // Show shared board layout
        const sharedList = services.filter(s => board.layout.includes(s.name));
        renderServices(sharedList);
      }
    };
  }
  await fetchUserId();
  services = await fetchServices();
  let favs = await getFavourites();
  window.showAllServices = favs.length > 0 ? false : true;
  let initialList = window.showAllServices ? services : services.filter(s => favs.includes(s.name));
  renderServices(initialList);
  renderFavouriteToggle();
  if (typeof renderInitialPieChart === 'function') {
    await renderInitialPieChart();
  }
});

// Interactive pie chart filter state
let pieStatusFilter = null;

// Always update analytics with ALL services, not just filtered/customized
async function rerenderAll() {
  services = await fetchServices();
  filterServices();
  if (typeof updatePieChart === 'function') {
    const statusTypes = Object.keys(statusMap);
    const statusCounts = {};
    statusTypes.forEach(type => {
      statusCounts[type] = services.filter(s => s.status === type).length;
    });
    updatePieChart(statusCounts);
  }
}

// Patch filterServices to respect pie chart filter
const origFilterServices = filterServices;
filterServices = async function() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  let filtered = await getCustomizedServices();
  filtered = filtered.filter(s =>
    (!search || s.name.toLowerCase().includes(search)) &&
    (!status || s.status === status) &&
    (!pieStatusFilter || s.status === pieStatusFilter)
  );
  renderServices(filtered);
};

// Pie chart click handler
window.addEventListener('DOMContentLoaded', () => {
  const chartCanvas = document.getElementById('statusPieChart');
  if (!chartCanvas) return;
  chartCanvas.onclick = function(evt) {
    if (!window.pieChart) return;
    const points = window.pieChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
    if (points.length) {
      const idx = points[0].index;
      const statusArr = Object.keys(statusMap);
      pieStatusFilter = statusArr[idx];
      filterServices();
    }
    evt.stopPropagation();
  };
  // Reset filter on click outside chart
  document.body.addEventListener('click', function(e) {
    if (pieStatusFilter && !chartCanvas.contains(e.target)) {
      pieStatusFilter = null;
      filterServices();
    }
  });
});

// Patch add/edit service to use API

// Patch customize dashboard to rerender analytics
customizeForm.onsubmit = async function(e) {
  e.preventDefault();
  // No change needed for customize logic
  customizeModal.hide();
  await loadAndRenderServices();
};

function autoUpdatePlannedMaintenance() {
  const now = new Date();
  let changed = false;
  services.forEach(async s => {
    if (s.status === 'Planned Maintenance' && s.maintenanceEnd) {
      const end = new Date(s.maintenanceEnd);
      if (end < now) {
        s.status = 'Operational';
        s.maintenanceStart = '';
        s.maintenanceEnd = '';
        changed = true;
        await saveService(s);
      }
    }
  });
}

// Optional: Simulate auto-refresh (randomize status every 3 min)
setInterval(() => {
  autoUpdatePlannedMaintenance();
  services.forEach(async s => {
    if (Math.random() < 0.2) {
      const statuses = ['Operational', 'Partial Outage', 'Down', 'Planned Maintenance', 'Under Investigation'];
      s.status = statuses[Math.floor(Math.random() * statuses.length)];
      s.lastUpdated = new Date().toISOString().slice(0,16).replace('T',' ');
      await saveService(s);
    }
  });
  rerenderAll();
}, 180000);

// Add toggle for users to show all or only favourites
window.showAllServices = true;
function renderFavouriteToggle() {
  const role = localStorage.getItem('ussm_role') || 'user';
  const toggle = document.getElementById('favToggle');
  if (!toggle) return;
  if (role !== 'user') {
    toggle.style.display = 'none';
    return;
  }
  toggle.style.display = '';
  // Always show the toggle for all users, regardless of favourites
  toggle.textContent = window.showAllServices ? 'Show My Favourites' : 'Show All Services';
  toggle.onclick = function() {
    window.showAllServices = !window.showAllServices;
    toggle.textContent = window.showAllServices ? 'Show My Favourites' : 'Show All Services';
    filterServices();
  };
}

// --- User Dashboard Layout Logic ---
let dashboardLayout = [];
let allServices = [];

async function fetchDashboardLayout() {
  if (!userId) await fetchUserId();
  if (!userId) return [];
  const res = await fetch(`http://localhost:3001/api/dashboard/${userId}`);
  return await res.json();
}

async function saveDashboardLayout(layout) {
  if (!userId) await fetchUserId();
  if (!userId) return;
  await fetch(`http://localhost:3001/api/dashboard/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layout })
  });
}

// Render dashboard with user layout or default
async function renderDashboard() {
  allServices = await fetchServices();
  dashboardLayout = await fetchDashboardLayout();
  let servicesToShow = dashboardLayout.length
    ? dashboardLayout.map(name => allServices.find(s => s.name === name)).filter(Boolean)
    : allServices;
  renderServices(servicesToShow);
}

// Call renderDashboard on login/page load
// Remove duplicate dashboard layout initialization

// Add/Remove/Reset logic (example)
window.resetDashboardLayout = async function() {
  await saveDashboardLayout([]);
  await renderDashboard();
};
// You can add a button in HTML: <button onclick="resetDashboardLayout()">Reset Dashboard</button>

// For reordering, use a drag-and-drop library and call saveDashboardLayout(newOrder) on change.
// For add/remove, show a modal with all services and update dashboardLayout, then save.
