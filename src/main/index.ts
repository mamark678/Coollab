import { electronApp, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, shell, session, dialog } from 'electron'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { join } from 'path'
import { readFileSync } from 'fs'

const PROTOCOL = 'coollabapp'
app.setAsDefaultProtocolClient(PROTOCOL)

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null

  // Create window function modified to return the instance
  function createWindow(): BrowserWindow {
    const preloadPath = join(__dirname, '../preload/index.mjs');
    console.log('[Main] Preload path:', preloadPath);

    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      show: false,
      icon: join(__dirname, '../../resources/icon.png'),
      webPreferences: {
        preload: preloadPath,
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    win.on('ready-to-show', () => {
      win.show()
    })

    // Navigation guard: Prevent in-app navigation to external sites
    win.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('http://localhost') && !url.startsWith('file://') && !url.startsWith('http://127.0.0.1')) {
        event.preventDefault()
        shell.openExternal(url)
      }
    })

    win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })

    const devServerUrl = process.env['ELECTRON_RENDERER_URL']
    if (devServerUrl) {
      win.loadURL(devServerUrl)
      win.webContents.openDevTools()
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'))
    }

    return win
  }

  // Handle incoming deep links (e.g. collabnotesapp://share/123)
  function handleDeepLink(url: string) {
    if (!url.startsWith(`${PROTOCOL}://`)) return;

    // Auth callback check: collabnotesapp://auth?id_token=...&access_token=...
    if (url.includes(`${PROTOCOL}://auth`)) {
      const parsedUrl = new URL(url);
      const idToken = parsedUrl.searchParams.get('id_token');
      const accessToken = parsedUrl.searchParams.get('access_token');
      const error = parsedUrl.searchParams.get('error');

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auth:google-result', { idToken, accessToken, error });
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
      return;
    }

    // Transform collabnotesapp://share/xyz -> /share/xyz
    const hashPath = url.replace(`${PROTOCOL}://`, '/');
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // We inject the hash change to trigger React Router instantly
      mainWindow.webContents.executeJavaScript(`window.location.hash = "${hashPath}"`);
    }
  }

  // IPC Handlers
  ipcMain.on('window:focus', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
  });

  ipcMain.on('auth:google-login', async () => {
    // Use import.meta.env to ensure variables are baked in at build time
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

    console.log('[Main] Client ID:', clientId ? `${clientId.substring(0, 15)}...` : 'undefined');
    console.log('[Main] Client Secret exists:', !!clientSecret);

    if (!clientId || clientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
      const error = 'Google Client ID not configured. Please check your .env file.';
      console.error(`[Main] ${error}`);
      if (mainWindow) mainWindow.webContents.send('auth:google-result', { error });
      return;
    }

    // PKCE Generation
    const { randomBytes, createHash } = require('crypto');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Create a temporary local server to catch the redirect
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);

      // Handle the initial redirect from Google (contains ?code=...)
      if (url.searchParams.has('code')) {
        const code = url.searchParams.get('code')!;
        const error = url.searchParams.get('error');

        if (error) {
          if (mainWindow) mainWindow.webContents.send('auth:google-result', { error });
        } else {
          try {
            console.log('[Main] Exchanging code for tokens...');
            // Exchange authorization code for tokens
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                code,
                client_id: clientId!,
                client_secret: clientSecret || '', // Include client_secret if available
                redirect_uri: `http://127.0.0.1:${STATIC_PORT}`,
                grant_type: 'authorization_code',
                code_verifier: codeVerifier
              })
            });

            const tokens = await tokenResponse.json();
            console.log('[Main] Token exchange response keys:', Object.keys(tokens));

            if (tokens.error) {
              console.error('[Main] Token exchange error:', tokens.error, tokens.error_description);
              if (mainWindow) {
                mainWindow.webContents.send('auth:google-result', { error: tokens.error_description || tokens.error });
              }
            } else if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('auth:google-result', {
                idToken: tokens.id_token,
                accessToken: tokens.access_token
              });
              mainWindow.focus();
            }
          } catch (err: any) {
            console.error('[Main] Token exchange network error:', err);
            if (mainWindow) mainWindow.webContents.send('auth:google-result', { error: err.message });
          }
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0a0a0f; color: white;"><h1>Authentication Successful!</h1><p>You can close this window and return to the app.</p></body></html>');
        server.close();
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    // Use a static port to ensure the redirect URI remains consistent
    const STATIC_PORT = 51730;
    server.listen(STATIC_PORT, '127.0.0.1', () => {
      const address = server.address();
      const port = (address && typeof address !== 'string') ? address.port : 0;
      if (port === 0) return;

      const redirectUri = `http://127.0.0.1:${port}`;
      const params = new URLSearchParams({
        client_id: clientId!,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        nonce: randomBytes(16).toString('base64url')
      });

      shell.openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    });
  });

  ipcMain.handle('canvas:open-image-dialog', async () => {
    if (!mainWindow) throw new Error('No main window');
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }

    try {
      const filePath = filePaths[0];
      
      // Check file size before reading into memory
      const { statSync } = require('fs');
      const stats = statSync(filePath);
      const MAX_SIZE = 750 * 1024; // 750KB limit (Base64 expands by ~33%, keeping it under Firestore's 1MB limit)
      
      if (stats.size > MAX_SIZE) {
        throw new Error('Image exceeds 750KB size limit. Please select a smaller file.');
      }
      
      const buffer = readFileSync(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase();
      let mimeType = 'image/png'; // default
      if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'gif') mimeType = 'image/gif';
      else if (ext === 'webp') mimeType = 'image/webp';

      return {
        base64: buffer.toString('base64'),
        mimeType,
        size: buffer.length
      };
    } catch (error: any) {
      console.error('[Main] canvas:open-image-dialog error:', error);
      throw new Error('Failed to read image file');
    }
  });

  ipcMain.handle('screen:capture', async () => {
    const { desktopCapturer, screen } = require('electron');
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'], thumbnailSize: { width: 1280, height: 720 } });
    
    // Try to find the app window first
    const appSource = sources.find((s: any) => s.name.includes('Coollab') || s.name.includes('Electron'));
    const source = appSource || sources[0];

    if (!source) throw new Error('No screen capture source found');

    const screenshot = source.thumbnail.toPNG();
    const { writeFileSync, existsSync, mkdirSync } = require('fs');
    const { join } = require('path');
    
    const tempDir = app.getPath('temp');
    const fileName = `eval_screenshot_${Date.now()}.png`;
    const filePath = join(tempDir, fileName);

    writeFileSync(filePath, screenshot);

    return {
      filePath,
      base64: screenshot.toString('base64')
    };
  });

  ipcMain.handle('fs:delete-temp-file', async (_, filePath: string) => {
    const { unlinkSync, existsSync } = require('fs');
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      return true;
    }
    return false;
  });

  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our primary window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    // Windows deep linking
    const url = commandLine.find((arg) => arg.startsWith(`${PROTOCOL}://`))
    if (url) {
      handleDeepLink(url)
    }
  })

  // macOS deep linking
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLink(url)
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.coollab.app')

    // Content Security Policy (CSP) Configuration
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://accounts.google.com; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "img-src 'self' data: https://*.googleusercontent.com https://*.googleapis.com; " +
            "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://api.groq.com wss://y-webrtc-cw7h.onrender.com wss://y-webrtc.fly.dev; " +
            "frame-src https://accounts.google.com;"
          ]
        }
      })
    })

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    mainWindow = createWindow()

    // Windows deep linking on first launch
    const url = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`))
    if (url && mainWindow) {
      // Must wait for load to inject javascript
      mainWindow.webContents.on('did-finish-load', () => {
        handleDeepLink(url)
      })
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow()
      }
    })
  })
}

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
