// --- Export Functionality ---
document.addEventListener('DOMContentLoaded', function() {
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const exportExcelBtn = document.getElementById('exportExcelBtn');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', function() {
      const data = JSON.stringify(services, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dashboard-services.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    });
  }
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', function() {
      // Use SheetJS to export to Excel
      const ws = XLSX.utils.json_to_sheet(services);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Services');
      XLSX.writeFile(wb, 'dashboard-services.xlsx');
    });
  }
});
// Render the pie chart on page load with all services
function renderInitialPieChart() {
  let allServices = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!allServices || !Array.isArray(allServices)) {
    allServices = [
      { name: "Service A", status: "Operational" },
      { name: "Service B", status: "Partial Outage" },
      { name: "Service C", status: "Down" },
      { name: "Service D", status: "Operational" }
    ];
  }
  const statusCounts = {
    Operational: allServices.filter(s => s.status === 'Operational').length,
    'Partial Outage': allServices.filter(s => s.status === 'Partial Outage').length,
    Down: allServices.filter(s => s.status === 'Down').length
  };
  updatePieChart(statusCounts);
}
// Chart.js pie chart rendering for analytics
function updatePieChart(statusCounts) {
  const ctx = document.getElementById('statusPieChart').getContext('2d');
  const data = {
    labels: ['Operational', 'Partial Outage', 'Down'],
    datasets: [{
      data: [statusCounts['Operational'], statusCounts['Partial Outage'], statusCounts['Down']],
      backgroundColor: [
        '#2ecc40',
        '#f1c40f',
        '#e74c3c'
      ],
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
// Service data with localStorage persistence
const STORAGE_KEY = 'ussm_services';
const CUSTOMIZE_KEY = 'ussm_user_services';
let services = JSON.parse(localStorage.getItem(STORAGE_KEY));
if (!services || !Array.isArray(services) || services.length === 0) {
  services = [
    { name: 'GoDaddy', type: 'External', status: 'Operational', lastUpdated: '2025-10-28 10:00' },
    { name: 'AWS', type: 'External', status: 'Partial Outage', lastUpdated: '2025-10-28 09:55' },
    { name: 'Internal CRM', type: 'Internal', status: 'Down', lastUpdated: '2025-10-28 09:50' },
    { name: 'Cloudflare', type: 'External', status: 'Operational', lastUpdated: '2025-10-28 09:45' },
    { name: 'Internal HR', type: 'Internal', status: 'Operational', lastUpdated: '2025-10-28 09:40' },
    { name: 'GitHub', type: 'External', status: 'Operational', lastUpdated: '2025-10-28 09:35' },
    { name: 'Internal Payroll', type: 'Internal', status: 'Partial Outage', lastUpdated: '2025-10-28 09:30' },
    { name: 'Azure', type: 'External', status: 'Down', lastUpdated: '2025-10-28 09:25' }
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(services));
}
function saveServices() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(services));
}

const statusMap = {
  'Operational': { class: 'status-operational', icon: 'fa-circle-check', color: '#2ecc40' },
  'Partial Outage': { class: 'status-partial', icon: 'fa-triangle-exclamation', color: '#f1c40f' },
  'Down': { class: 'status-down', icon: 'fa-circle-xmark', color: '#e74c3c' }
};

function renderServices(list) {
  const container = document.getElementById('serviceCards');
  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = '<div class="col-12 text-center text-muted">No services found.</div>';
    return;
  }
  const role = localStorage.getItem('ussm_role') || 'user';
  list.forEach((s, idx) => {
    const st = statusMap[s.status];
    container.innerHTML += `
      <div class="col-md-4 mb-4">
        <div class="card shadow-sm">
          <div class="card-body">
            <h5 class="card-title d-flex justify-content-between align-items-center">
              <span>${s.name}</span>
              ${role === 'admin' || role === 'developer' ? `<button class="btn btn-sm btn-outline-primary edit-btn" data-idx="${idx}" title="Edit"><i class="fa fa-edit"></i></button>` : ''}
            </h5>
            <h6 class="card-subtitle mb-2 text-muted">${s.type}</h6>
            <span class="status-badge ${st.class}">
              <i class="fa-solid ${st.icon} me-1"></i> ${s.status}
            </span>
            <div class="mt-2 text-secondary" style="font-size:0.95em;">
              <i class="fa-regular fa-clock me-1"></i> Last updated: ${s.lastUpdated}
            </div>
          </div>
        </div>
      </div>
    `;
  });
  // Attach edit button listeners only if admin/developer
  if (role === 'admin' || role === 'developer') {
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        openServiceModal('edit', parseInt(this.getAttribute('data-idx')));
      });
    });
  }
}

function getCustomizedServices() {
  const selected = JSON.parse(localStorage.getItem(CUSTOMIZE_KEY));
  if (!selected) return services;
  return services.filter((s, idx) => selected.includes(idx));
}
function filterServices() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  let filtered = getCustomizedServices();
  filtered = filtered.filter(s =>
    (!search || s.name.toLowerCase().includes(search)) &&
    (!status || s.status === status)
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
  if (mode === 'edit' && typeof idx === 'number') {
    editIdx = idx;
    const s = services[idx];
    document.getElementById('serviceName').value = s.name;
    document.getElementById('serviceType').value = s.type;
    document.getElementById('serviceStatus').value = s.status;
  }
  serviceModal.show();
}

// Unified add/edit handler: update services, update customized list if needed, rerender all
serviceForm.onsubmit = function(e) {
  e.preventDefault();
  const name = document.getElementById('serviceName').value.trim();
  const type = document.getElementById('serviceType').value;
  const status = document.getElementById('serviceStatus').value;
  const now = new Date().toISOString().slice(0,16).replace('T',' ');
  if (editIdx !== null) {
    services[editIdx] = { name, type, status, lastUpdated: now };
  } else {
    services.push({ name, type, status, lastUpdated: now });
    // Add new service index to customized list for current user
    let customized = JSON.parse(localStorage.getItem(CUSTOMIZE_KEY)) || [];
    const newIdx = services.length - 1;
    if (!customized.includes(newIdx)) {
      customized.push(newIdx);
      localStorage.setItem(CUSTOMIZE_KEY, JSON.stringify(customized));
    }
  }
  saveServices();
  serviceModal.hide();
  rerenderAll();
};


// Customize Dashboard Modal logic
const customizeBtn = document.getElementById('customizeBtn');
const customizeModal = new bootstrap.Modal(document.getElementById('customizeModal'));
const customizeForm = document.getElementById('customizeForm');
const customizeList = document.getElementById('customizeList');

customizeBtn.addEventListener('click', () => {
  customizeList.innerHTML = '';
  services.forEach((s, idx) => {
    const checked = (JSON.parse(localStorage.getItem(CUSTOMIZE_KEY)) || []).includes(idx);
    customizeList.innerHTML += `
      <div class="form-check mb-2">
        <input class="form-check-input" type="checkbox" value="${idx}" id="customApp${idx}" ${checked ? 'checked' : ''}>
        <label class="form-check-label" for="customApp${idx}">${s.name} <span class="text-muted">(${s.type})</span></label>
      </div>
    `;
  });
  customizeModal.show();
});

serviceForm.onsubmit = function(e) {
  e.preventDefault();
  const name = document.getElementById('serviceName').value.trim();
  const type = document.getElementById('serviceType').value;
  const status = document.getElementById('serviceStatus').value;
  const now = new Date().toISOString().slice(0,16).replace('T',' ');
  if (editIdx !== null) {
    services[editIdx] = { name, type, status, lastUpdated: now };
  } else {
    services.push({ name, type, status, lastUpdated: now });
    // Add new service index to customized list for current user
    let customized = JSON.parse(localStorage.getItem(CUSTOMIZE_KEY)) || [];
    const newIdx = services.length - 1;
    if (!customized.includes(newIdx)) {
      customized.push(newIdx);
      localStorage.setItem(CUSTOMIZE_KEY, JSON.stringify(customized));
    }
  }
  saveServices();
  serviceModal.hide();
  rerenderAll();
}
  

// Always render dashboard data and chart on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  filterServices();
  if (typeof renderInitialPieChart === 'function') {
    renderInitialPieChart();
  }
});

// Interactive pie chart filter state
let pieStatusFilter = null;

// Always update analytics with ALL services, not just filtered/customized
function rerenderAll() {
  filterServices();
  if (typeof updatePieChart === 'function') {
    let allServices = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!allServices) {
      allServices = [
        { name: "Service A", status: "Operational" },
        { name: "Service B", status: "Partial Outage" },
        { name: "Service C", status: "Down" },
        { name: "Service D", status: "Operational" }
      ];
    }
    updatePieChart(allServices);
  }
}

// Patch filterServices to respect pie chart filter
const origFilterServices = filterServices;
filterServices = function() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  let filtered = getCustomizedServices();
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
      const statusArr = ['Operational', 'Partial Outage', 'Down'];
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

// Patch add/edit service to rerender analytics
serviceForm.onsubmit = function(e) {
  e.preventDefault();
  const name = document.getElementById('serviceName').value.trim();
  const type = document.getElementById('serviceType').value;
  const status = document.getElementById('serviceStatus').value;
  const now = new Date().toISOString().slice(0,16).replace('T',' ');
  if (editIdx !== null) {
    services[editIdx] = { name, type, status, lastUpdated: now };
  } else {
    services.push({ name, type, status, lastUpdated: now });
  }
  saveServices();
  serviceModal.hide();
  rerenderAll();
};

// Patch customize dashboard to rerender analytics
customizeForm.onsubmit = function(e) {
  e.preventDefault();
  const checked = Array.from(customizeList.querySelectorAll('input[type=checkbox]:checked')).map(cb => parseInt(cb.value));
  localStorage.setItem(CUSTOMIZE_KEY, JSON.stringify(checked));
  customizeModal.hide();
  rerenderAll();
};

// Optional: Simulate auto-refresh (randomize status every 3 min)
setInterval(() => {
  services.forEach(s => {
    if (Math.random() < 0.2) {
      const statuses = ['Operational', 'Partial Outage', 'Down'];
      s.status = statuses[Math.floor(Math.random() * statuses.length)];
      s.lastUpdated = new Date().toISOString().slice(0,16).replace('T',' ');
    }
  });
  saveServices();
  rerenderAll();
}, 180000);
