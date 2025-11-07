
// --- Dependencies ---
const express = require('express');
const XLSX = require('xlsx');
const cors = require('cors');
const fs = require('fs');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;
const FILES = {
    SERVICES: 'ussm_services.xlsx',
    USERS: 'ussm_users.xlsx',
    FAVOURITES: 'favourites.xlsx',
    DASHBOARDS: 'ussm_dashboards.xlsx',
    SHARED_BOARDS: 'shared_boards.xlsx'
};

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- Helper Functions ---
const ExcelHelpers = {
    readFile: (filename, sheetName = null) => {
        if (!fs.existsSync(filename)) return [];
        const wb = XLSX.readFile(filename);
        const ws = sheetName ? wb.Sheets[sheetName] : wb.Sheets[wb.SheetNames[0]];
        return ws ? XLSX.utils.sheet_to_json(ws, { defval: '' }) : [];
    },

    writeFile: (filename, data, headers, sheetName) => {
        const ws = XLSX.utils.json_to_sheet(data, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1');
        XLSX.writeFile(wb, filename);
    }
};

// --- Data Access Functions ---
const DataAccess = {
    users: {
        read: () => ExcelHelpers.readFile(FILES.USERS),
        write: (users) => ExcelHelpers.writeFile(
            FILES.USERS,
            users,
            ['id', 'username', 'password', 'role'],
            'users'
        )
    },

    services: {
        read: () => ExcelHelpers.readFile(FILES.SERVICES, 'Services'),
        write: (services) => ExcelHelpers.writeFile(
            FILES.SERVICES,
            services,
            ['name', 'type', 'status', 'lastUpdated', 'maintenanceStart', 'maintenanceEnd', 'url'],
            'Services'
        )
    },

    dashboards: {
        read: () => ExcelHelpers.readFile(FILES.DASHBOARDS, 'dashboards'),
        write: (dashboards) => ExcelHelpers.writeFile(
            FILES.DASHBOARDS,
            dashboards,
            ['userId', 'layout'],
            'dashboards'
        )
    },

    favourites: {
        read: () => ExcelHelpers.readFile(FILES.FAVOURITES),
        write: (favourites) => ExcelHelpers.writeFile(
            FILES.FAVOURITES,
            favourites,
            ['userId', 'serviceName'],
            'favourites'
        )
    },

    sharedBoards: {
        read: () => ExcelHelpers.readFile(FILES.SHARED_BOARDS, 'shared'),
        write: (boards) => ExcelHelpers.writeFile(
            FILES.SHARED_BOARDS,
            boards,
            ['ownerUserId', 'sharedWithUserId', 'layout'],
            'shared'
        )
    }
}

// --- Real-time Google.com status check endpoint ---
app.get('/api/check-google', (req, res) => {
  
  let responded = false;
  try {
    const reqGoogle = https.get('https://www.google.com', (resp) => {
      let data = '';
      resp.on('data', (chunk) => { data += chunk; });
      resp.on('end', () => {
        if (!responded) {
          responded = true;
          if (resp.statusCode === 200) {
            res.json({ status: 'Operational' });
          } else {
            res.json({ status: 'Down' });
          }
        }
      });
    });
    reqGoogle.on('error', (err) => {
      if (!responded) {
        responded = true;
        res.json({ status: 'Down' });
      }
    });
    reqGoogle.setTimeout(5000, () => {
      if (!responded) {
        responded = true;
        reqGoogle.abort();
        res.json({ status: 'Down' });
      }
    });
  } catch (err) {
    if (!responded) {
      responded = true;
      res.json({ status: 'Down' });
    }
  }
});

  // --- Routes ---
  // Authentication
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = DataAccess.users.read();
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
      res.json({
        success: true,
        role: user.role,
        id: user.id,
        username: user.username
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });

  // Users
  app.get('/api/users', (_, res) => {
    const users = DataAccess.users.read();
    // Remove passwords before sending
    const safeUsers = users.map(({ password, ...user }) => user);
    res.json(safeUsers);
  });

  app.post('/api/users', (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    let users = DataAccess.users.read();
    if (users.find(u => u.username === username)) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    const newUser = {
      id: uuidv4(),
      username,
      password,
      role
    };

    users.push(newUser);
    DataAccess.users.write(users);

    // Return success without password
    const { password: _, ...safeUser } = newUser;
    res.json({ success: true, user: safeUser });
  });

  // Services
  app.get('/api/services', (_, res) => {
    const services = DataAccess.services.read();
    res.json(services);
  });

  app.post('/api/services', (req, res) => {
    const { name, type, status, url } = req.body;
    if (!name || !type || !status) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    let services = DataAccess.services.read();
    const newService = {
      name,
      type,
      status,
      url: url || '',
      lastUpdated: new Date().toISOString()
    };

    const index = services.findIndex(s => s.name === name);
    if (index !== -1) {
      services[index] = { ...services[index], ...newService };
    } else {
      services.push(newService);
    }

    DataAccess.services.write(services);
    res.json({ success: true, service: newService });
  });

  app.delete('/api/services/:name', (req, res) => {
    const services = DataAccess.services.read()
      .filter(s => s.name !== req.params.name);
    DataAccess.services.write(services);
    res.json({ success: true });
  });

  // Dashboards
  app.get('/api/dashboard/:userId', (req, res) => {
    const dashboards = DataAccess.dashboards.read();
    const dashboard = dashboards.find(d => d.userId === req.params.userId);
    res.json(dashboard ? JSON.parse(dashboard.layout) : []);
  });

  app.post('/api/dashboard/:userId', (req, res) => {
    const { layout } = req.body;
    if (!layout) {
      return res.status(400).json({ success: false, message: 'Missing layout data' });
    }

    let dashboards = DataAccess.dashboards.read();
    const index = dashboards.findIndex(d => d.userId === req.params.userId);
    
    if (index !== -1) {
      dashboards[index].layout = JSON.stringify(layout);
    } else {
      dashboards.push({
        userId: req.params.userId,
        layout: JSON.stringify(layout)
      });
    }

    DataAccess.dashboards.write(dashboards);
    res.json({ success: true });
  });

  // Shared Boards
  app.post('/api/share-board', (req, res) => {
  const { ownerUserId, sharedWithUserId, layout } = req.body;
  if (!ownerUserId || !sharedWithUserId || !layout) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }
  let sharedBoards = readSharedBoards();
  // Prevent duplicate shares
  if (sharedBoards.find(b => b.ownerUserId === ownerUserId && b.sharedWithUserId === sharedWithUserId)) {
    return res.status(409).json({ success: false, message: 'Already shared' });
  }
  sharedBoards.push({ ownerUserId, sharedWithUserId, layout: JSON.stringify(layout) });
  writeSharedBoards(sharedBoards);
  res.json({ success: true });
});

// GET: Get boards shared with user
app.get('/api/shared-board/:userId', (req, res) => {
  const userId = req.params.userId;
  const sharedBoards = readSharedBoards().filter(b => b.sharedWithUserId === userId);
  // Parse layout JSON for each board
  sharedBoards.forEach(b => { b.layout = JSON.parse(b.layout); });
  res.json(sharedBoards);
  });

  // Favourites
  app.post('/api/favourites', (req, res) => {
    const { userId, serviceName } = req.body;
    if (!userId || !serviceName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    let favourites = DataAccess.favourites.read();
    if (favourites.find(f => f.userId === userId && f.serviceName === serviceName)) {
      return res.status(409).json({ success: false, message: 'Already in favourites' });
    }

    favourites.push({ userId, serviceName });
    DataAccess.favourites.write(favourites);
    res.json({ success: true });
  });

  app.get('/api/favourites/:userId', (req, res) => {
    const userId = req.params.userId;
    const favourites = DataAccess.favourites.read()
      .filter(f => f.userId === userId);
    res.json(favourites);
  });

  app.delete('/api/favourites', (req, res) => {
    const { userId, serviceName } = req.body;
    if (!userId || !serviceName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    let favourites = DataAccess.favourites.read()
      .filter(f => !(f.userId === userId && f.serviceName === serviceName));
    DataAccess.favourites.write(favourites);
    res.json({ success: true });
  });

  // Error Handling
  // --- Error Handling and Server Startup ---
  // Error middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred'
    });
  });

  // Print uncaught exceptions and unhandled promise rejections
  process.on('uncaughtException', function (err) {
    console.error('Uncaught Exception:', err);
  });

  process.on('unhandledRejection', function (reason, promise) {
    console.error('Unhandled Rejection:', reason);
  });

  // Start Server
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Excel files used:');
    Object.entries(FILES).forEach(([key, file]) => {
      console.log(`- ${key}: ${file}`);
    });
});
app.get('/api/users', (req, res) => {
  const users = readUsers();
  res.json(users);
});

// GET: Retrieve user dashboard layout
app.get('/api/dashboard/:userId', (req, res) => {
  const dashboards = readDashboards();
  const entry = dashboards.find(d => d.userId === req.params.userId);
  res.json(entry ? JSON.parse(entry.layout) : []);
});

// POST: Save/update user dashboard layout
app.post('/api/dashboard/:userId', (req, res) => {
  const { layout } = req.body; // layout: array of service names
  let dashboards = readDashboards();
  const idx = dashboards.findIndex(d => d.userId === req.params.userId);
  if (idx >= 0) {
    dashboards[idx].layout = JSON.stringify(layout);
  } else {
    dashboards.push({ userId: req.params.userId, layout: JSON.stringify(layout) });
  }
  writeDashboards(dashboards);
  res.json({ success: true });
});

// Call this after all require and variable initializations
// (Removed duplicate FAVOURITES_FILE and uuidv4 declarations)

// Print uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', function (err) {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', function (reason, promise) {
  console.error('Unhandled Rejection:', reason);
});

// POST: Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    res.json({ success: true, role: user.role });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// POST: Add a new user (admin only)
app.post('/api/users', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }
  let users = readUsers();
  if (users.find(u => u.username === username)) {
    return res.status(409).json({ success: false, message: 'User already exists' });
  }
  const id = uuidv4();
  users.push({ id, username, password, role });
  const ws = XLSX.utils.json_to_sheet(users, { header: ['id', 'username', 'password', 'role'] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'users');
  XLSX.writeFile(wb, USERS_FILE);
  res.json({ success: true, id });
});

// Helper: Read all favourites from Excel
function readFavourites() {
  if (!fs.existsSync(FAVOURITES_FILE)) return [];
  const wb = XLSX.readFile(FAVOURITES_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

// POST: Add a favourite for a user
app.post('/api/favourites', (req, res) => {
  const { userId, serviceName } = req.body;
  if (!userId || !serviceName) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }
  let favourites = readFavourites();
  if (favourites.find(f => f.userId === userId && f.serviceName === serviceName)) {
    return res.status(409).json({ success: false, message: 'Already favourited' });
  }
  favourites.push({ userId, serviceName });
  const ws = XLSX.utils.json_to_sheet(favourites, { header: ['userId', 'serviceName'] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'favourites');
  XLSX.writeFile(wb, FAVOURITES_FILE);
  res.json({ success: true });
});

// GET: Get all favourites for a user
app.get('/api/favourites/:userId', (req, res) => {
  const userId = req.params.userId;
  const favourites = readFavourites().filter(f => f.userId === userId);
  res.json(favourites);
});

// Helper: Read all services from Excel
function readServices() {
  if (!fs.existsSync(EXCEL_FILE)) return [];
  const wb = XLSX.readFile(EXCEL_FILE);
  const ws = wb.Sheets['Services'];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

// Helper: Write all services to Excel
function writeServices(services) {
  // Enforce correct header order
  const HEADERS = ['name', 'type', 'status', 'lastUpdated', 'maintenanceStart', 'maintenanceEnd', 'url'];
  const normalized = services.map(s => {
    const obj = {};
    HEADERS.forEach(h => { obj[h] = s[h] || ''; });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(normalized, { header: HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Services');
  XLSX.writeFile(wb, EXCEL_FILE);
}

// GET all services
app.get('/api/services', (req, res) => {
  res.json(readServices());
});

// POST: Add or update a service
app.post('/api/services', (req, res) => {
  const services = readServices();
  const newService = req.body;
  // If service with same name exists, update it
  const idx = services.findIndex(s => s.name === newService.name);
  if (idx >= 0) {
    services[idx] = newService;
  } else {
    services.push(newService);
  }
  writeServices(services);
  res.json({ success: true });
});

// DELETE: Remove a service by name
app.delete('/api/services/:name', (req, res) => {
  let services = readServices();
  services = services.filter(s => s.name !== req.params.name);
  writeServices(services);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`USSM backend running at http://localhost:${PORT}`);
});
