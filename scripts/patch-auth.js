const fs = require('fs');
const path = require('path');

const NEW_MOBILE_BLOCK = `    if (isMobile) {
      // Native Google Sign-In via @capawesome/capacitor-google-sign-in
      // signInWithPopup hangs in Android WebViews - use native system account picker instead
      console.log('[AUTH] Starting native GoogleSignIn...');
      setDebugLog(prev => [...prev, 'Calling native GoogleSignIn.signIn()...']);
      try {
        await GoogleSignIn.initialize({ clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '' });
        setDebugLog(prev => [...prev, 'Plugin initialized']);

        const response = await GoogleSignIn.signIn();
        console.log('[AUTH] signIn response, has idToken:', !!response.idToken);
        setDebugLog(prev => [...prev, 'Got idToken: ' + String(!!response.idToken)]);

        if (!response.idToken) throw new Error('No idToken from native Google Sign-In');

        const credential = GoogleAuthProvider.credential(response.idToken);
        const result = await signInWithCredential(auth, credential);
        console.log('[AUTH] signInWithCredential OK:', result.user && result.user.email);
        setDebugLog(prev => [...prev, 'Firebase OK - user: ' + String(result.user && result.user.email)]);

        await FirebaseService.getInstance().handleGoogleSignInResult(result.user);
        setDebugLog(prev => [...prev, 'Profile saved, navigating...']);
`;

// ─────────────────────────────────────────────
// PATCH LoginPage.tsx
// ─────────────────────────────────────────────
function patchLoginPage() {
  const filePath = path.join('src', 'renderer', 'pages', 'LoginPage.tsx');
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // 1. Add GoogleSignIn import
  if (!content.includes('@capawesome/capacitor-google-sign-in')) {
    content = content.replace(
      "import { Capacitor } from '@capacitor/core';",
      "import { Capacitor } from '@capacitor/core';\nimport { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';"
    );
    console.log('LoginPage: added GoogleSignIn import');
    changed = true;
  } else {
    console.log('LoginPage: GoogleSignIn import already present');
  }

  // 2. Ensure signInWithCredential is imported
  if (!content.includes('signInWithCredential')) {
    content = content.replace(
      'signInWithEmailAndPassword,',
      'signInWithEmailAndPassword,\n  signInWithCredential,'
    );
    console.log('LoginPage: added signInWithCredential import');
    changed = true;
  }

  // 3. Replace mobile block
  // Anchor: start at "if (isMobile) {" line that has signInWithPopup nearby
  // End at the "} else {" that handles Electron
  const POPUP_ANCHOR = "Starting signInWithPopup (mobile)";
  const ELSE_ANCHOR = "} else {\n      const electronAPI = window.electronAPI;";

  if (content.includes(POPUP_ANCHOR)) {
    // Find where the if(isMobile) block starts (before the console.log)
    const popupIdx = content.indexOf(POPUP_ANCHOR);
    // Walk back to find the opening "if (isMobile) {"
    const blockStart = content.lastIndexOf('    if (isMobile) {', popupIdx);
    // Find the else clause after it
    const elseIdx = content.indexOf(ELSE_ANCHOR, blockStart);

    if (blockStart !== -1 && elseIdx !== -1) {
      const loginExtra = `        setFailedAttempts(0);\n        navigate('/');\n      } catch (err) {\n        const e = err;\n        console.error('[AUTH] Native sign-in error:', e);\n        const debugMsg = 'ERROR - code: ' + String(e.code || 'none') + ' | msg: ' + String(e.message || 'unknown');\n        setDebugLog(prev => [...prev, debugMsg]);\n        setError('Auth Error: ' + String(e.code || '') + ' - ' + String(e.message || 'Unknown error'));\n        setLoading(false);\n      }\n`;
      const fullNewBlock = NEW_MOBILE_BLOCK + loginExtra;
      content = content.slice(0, blockStart) + fullNewBlock + '    ' + content.slice(elseIdx);
      console.log('LoginPage: replaced mobile block with native plugin flow');
      changed = true;
    } else {
      console.log('LoginPage: could not locate block boundaries, blockStart=' + blockStart + ' elseIdx=' + elseIdx);
    }
  } else {
    console.log('LoginPage: mobile popup anchor not found - may already be patched');
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('LoginPage.tsx saved.\n');
  }
}

// ─────────────────────────────────────────────
// PATCH SignupPage.tsx
// ─────────────────────────────────────────────
function patchSignupPage() {
  const filePath = path.join('src', 'renderer', 'pages', 'SignupPage.tsx');
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // 1. Add GoogleSignIn import
  if (!content.includes('@capawesome/capacitor-google-sign-in')) {
    content = content.replace(
      "import { Capacitor } from '@capacitor/core';",
      "import { Capacitor } from '@capacitor/core';\nimport { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';"
    );
    console.log('SignupPage: added GoogleSignIn import');
    changed = true;
  } else {
    console.log('SignupPage: GoogleSignIn import already present');
  }

  // 2. Ensure signInWithCredential is imported
  if (!content.includes('signInWithCredential')) {
    content = content.replace(
      'createUserWithEmailAndPassword,',
      'createUserWithEmailAndPassword, signInWithCredential,'
    );
    console.log('SignupPage: added signInWithCredential import');
    changed = true;
  }

  // 3. Replace mobile block
  const POPUP_ANCHOR = "Starting signInWithPopup (mobile)";
  const ELSE_ANCHOR = "} else {\n      const electronAPI = (window as any).electronAPI;";

  if (content.includes(POPUP_ANCHOR)) {
    const popupIdx = content.indexOf(POPUP_ANCHOR);
    const blockStart = content.lastIndexOf('    if (isMobile) {', popupIdx);
    const elseIdx = content.indexOf(ELSE_ANCHOR, blockStart);

    if (blockStart !== -1 && elseIdx !== -1) {
      const signupExtra = `        navigate('/');\n      } catch (err) {\n        const e = err;\n        console.error('[AUTH] Native sign-in error:', e);\n        const debugMsg = 'ERROR - code: ' + String(e.code || 'none') + ' | msg: ' + String(e.message || 'unknown');\n        setDebugLog(prev => [...prev, debugMsg]);\n        setError('Auth Error: ' + String(e.code || '') + ' - ' + String(e.message || 'Unknown error'));\n        setLoading(false);\n      }\n`;
      const fullNewBlock = NEW_MOBILE_BLOCK + signupExtra;
      content = content.slice(0, blockStart) + fullNewBlock + '    ' + content.slice(elseIdx);
      console.log('SignupPage: replaced mobile block with native plugin flow');
      changed = true;
    } else {
      console.log('SignupPage: could not locate block boundaries, blockStart=' + blockStart + ' elseIdx=' + elseIdx);
    }
  } else {
    console.log('SignupPage: mobile popup anchor not found - may already be patched');
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('SignupPage.tsx saved.\n');
  }
}

patchLoginPage();
patchSignupPage();
console.log('Done.');
