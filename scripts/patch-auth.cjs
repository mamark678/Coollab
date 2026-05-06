const fs = require('fs');
const path = require('path');

const NEW_MOBILE_BLOCK_LOGIN = `    if (isMobile) {
      // Native Google Sign-In via @capawesome/capacitor-google-sign-in
      // signInWithPopup hangs in Android WebViews - use native system account picker instead
      console.log('[AUTH] Starting native GoogleSignIn...');
      setDebugLog(prev => [...prev, 'Calling native GoogleSignIn.signIn()...']);
      try {
        await GoogleSignIn.initialize({ clientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || '' });
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
        setFailedAttempts(0);
        navigate('/');
      } catch (err) {
        const e = err;
        console.error('[AUTH] Native sign-in error:', e);
        const debugMsg = 'ERROR - code: ' + String(e.code || 'none') + ' | msg: ' + String(e.message || 'unknown');
        setDebugLog(prev => [...prev, debugMsg]);
        setError('Auth Error: ' + String(e.code || '') + ' - ' + String(e.message || 'Unknown error'));
        setLoading(false);
      }
`;

const NEW_MOBILE_BLOCK_SIGNUP = `    if (isMobile) {
      // Native Google Sign-In via @capawesome/capacitor-google-sign-in
      // signInWithPopup hangs in Android WebViews - use native system account picker instead
      console.log('[AUTH] Starting native GoogleSignIn...');
      setDebugLog(prev => [...prev, 'Calling native GoogleSignIn.signIn()...']);
      try {
        await GoogleSignIn.initialize({ clientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || '' });
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
        navigate('/');
      } catch (err) {
        const e = err;
        console.error('[AUTH] Native sign-in error:', e);
        const debugMsg = 'ERROR - code: ' + String(e.code || 'none') + ' | msg: ' + String(e.message || 'unknown');
        setDebugLog(prev => [...prev, debugMsg]);
        setError('Auth Error: ' + String(e.code || '') + ' - ' + String(e.message || 'Unknown error'));
        setLoading(false);
      }
`;

function patchFile(filePath, newMobileBlock, elseAnchorFragment) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Normalise to LF for easy manipulation, we'll write back as-is
  const useCRLF = content.includes('\r\n');
  const normalized = content.replace(/\r\n/g, '\n');

  let changed = false;

  // 1. Add GoogleSignIn import
  if (!normalized.includes('@capawesome/capacitor-google-sign-in')) {
    const patched = normalized.replace(
      "import { Capacitor } from '@capacitor/core';",
      "import { Capacitor } from '@capacitor/core';\nimport { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';"
    );
    if (patched !== normalized) { content = patched; changed = true; console.log(filePath + ': added GoogleSignIn import'); }
  } else {
    console.log(filePath + ': GoogleSignIn import already present');
  }

  // Re-read normalized after potential change
  let norm = (changed ? content : normalized);

  // 2. Ensure signInWithCredential is imported
  if (!norm.includes('signInWithCredential')) {
    norm = norm.replace('signInWithEmailAndPassword,', 'signInWithEmailAndPassword,\n  signInWithCredential,');
    norm = norm.replace('createUserWithEmailAndPassword,', 'createUserWithEmailAndPassword, signInWithCredential,');
    changed = true;
    console.log(filePath + ': added signInWithCredential import');
  }

  // 3. Replace mobile block
  const POPUP_ANCHOR = "Starting signInWithPopup (mobile)";
  if (norm.includes(POPUP_ANCHOR)) {
    const popupIdx = norm.indexOf(POPUP_ANCHOR);
    const blockStart = norm.lastIndexOf('    if (isMobile) {', popupIdx);
    const elseIdx = norm.indexOf(elseAnchorFragment, blockStart);

    if (blockStart !== -1 && elseIdx !== -1) {
      // Walk back from elseIdx to find the exact '    } else {' line start
      const elseLineStart = norm.lastIndexOf('\n', elseIdx) + 1;
      norm = norm.slice(0, blockStart) + newMobileBlock + '    ' + norm.slice(elseLineStart);
      changed = true;
      console.log(filePath + ': replaced mobile block with native plugin flow');
    } else {
      console.log(filePath + ': WARN - could not find block boundaries. blockStart=' + blockStart + ' elseIdx=' + elseIdx);
    }
  } else {
    console.log(filePath + ': mobile popup anchor not found (already patched or different content)');
  }

  if (changed) {
    const output = useCRLF ? norm.replace(/\n/g, '\r\n') : norm;
    fs.writeFileSync(filePath, output, 'utf8');
    console.log(filePath + ': saved.\n');
  }
}

patchFile(
  path.join('src', 'renderer', 'pages', 'LoginPage.tsx'),
  NEW_MOBILE_BLOCK_LOGIN,
  '} else {\n      const electronAPI = window.electronAPI;'
);

patchFile(
  path.join('src', 'renderer', 'pages', 'SignupPage.tsx'),
  NEW_MOBILE_BLOCK_SIGNUP,
  '} else {\n      const electronAPI = (window as any).electronAPI;'
);

console.log('All done.');
