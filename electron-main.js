const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;

const START_PORT = 3000;
const URL = `http://localhost:${START_PORT}`;

function startServer() {
    console.log('Starting Express Server...');
    const serverPath = path.join(__dirname, 'server.js');

    // Check if we are in development or production (packaged)
    // In dev, we use 'node'. In production, we might need a bundled node or similar solution.
    // For simplicity with electron-builder, we often rely on the fact that we ship node_modules.
    // However, spawning 'node' requires node to be in system PATH for the user if not bundled.
    // A better approach for packaged apps usually involves main process handling logic or bundling everything.
    // NOTE: For 'tikdown-auto', users likely have Node installed if running source. 
    // To make it truly standalone, we would bundle the server into the executable or use 'pkg'.
    // Here we assume 'node' is available or we are in a dev environment for the "Wrap" phase.

    serverProcess = spawn('node', [serverPath], {
        cwd: __dirname,
        env: Object.assign({}, process.env, { PORT: START_PORT, IS_ELECTRON: 'true' }),
        stdio: 'inherit' // Pipe logs to main process
    });

    serverProcess.on('error', (err) => {
        console.error('Failed to start server:', err);
    });

    serverProcess.on('close', (code) => {
        console.log(`Server process exited with code ${code}`);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: 'TikDown Auto',
        icon: path.join(__dirname, 'public/favicon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js') // Optional if we need it later
        }
    });

    // Remove menu bar for cleaner look
    mainWindow.setMenuBarVisibility(false);

    // Wait for server to be ready
    const checkServer = () => {
        http.get(URL, (res) => {
            if (res.statusCode === 200) {
                mainWindow.loadURL(URL);
            } else {
                setTimeout(checkServer, 1000);
            }
        }).on('error', (err) => {
            setTimeout(checkServer, 1000);
        });
    };

    checkServer();

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http:') || url.startsWith('https:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    startServer();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    if (serverProcess) {
        console.log('Killing server process...');
        serverProcess.kill();
    }
});
