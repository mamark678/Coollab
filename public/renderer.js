// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBTNSAB2HCcP69xoD9KagqTpKwawvQQHts",
  authDomain: "collaboration-app-b3c91.firebaseapp.com",
  databaseURL: "https://collaboration-app-b3c91-default-rtdb.firebaseio.com",
  projectId: "collaboration-app-b3c91",
  storageBucket: "collaboration-app-b3c91.firebasestorage.app",
  messagingSenderId: "251672582118",
  appId: "1:251672582118:web:c30e00c78aee116db72827",
  measurementId: "G-EXMQ52N0N9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==========================================
// STATE MANAGEMENT
// ==========================================
let currentNoteId = null;
let ydoc = new Y.Doc();
let provider = null;
let editor = null; // TipTap editor instance

const { Doc } = Y;
const { WebrtcProvider } = YWebRTC;

// ==========================================
// TOOLBAR LOGIC (Connecting to TipTap)
// ==========================================
function exec(command, value = null) {
  if (!editor) return;

  // Map our simple toolbar commands to TipTap's API
  switch (command) {
    case 'bold': editor.chain().focus().toggleBold().run(); break;
    case 'italic': editor.chain().focus().toggleItalic().run(); break;
    case 'underline': editor.chain().focus().toggleUnderline().run(); break;
    case 'strikeThrough': editor.chain().focus().toggleStrike().run(); break;
    case 'formatBlock':
      if (value === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
      else if (value === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
      else editor.chain().focus().setParagraph().run();
      break;
    case 'insertUnorderedList': editor.chain().focus().toggleBulletList().run(); break;
    case 'insertOrderedList': editor.chain().focus().toggleOrderedList().run(); break;
    case 'justifyLeft': editor.chain().focus().setTextAlign('left').run(); break;
    case 'justifyCenter': editor.chain().focus().setTextAlign('center').run(); break;
    case 'justifyRight': editor.chain().focus().setTextAlign('right').run(); break;
  }
  triggerSave();
}

// ==========================================
// CORE FUNCTIONS
// ==========================================

async function createNewNote() {
  const id = 'note_' + Date.now();
  const title = 'Untitled Note';

  await db.collection('notes').doc(id).set({
    title: title,
    content: '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  loadNote(id);
  refreshNotesList();
}

async function refreshNotesList() {
  const listElement = document.getElementById('notes-list');
  listElement.innerHTML = '';

  const snapshot = await db.collection('notes').orderBy('updatedAt', 'desc').get();

  snapshot.forEach(doc => {
    const data = doc.data();
    const li = document.createElement('li');
    li.className = `note-item ${doc.id === currentNoteId ? 'active' : ''}`;
    li.textContent = data.title || 'Untitled';
    li.onclick = () => loadNote(doc.id);
    listElement.appendChild(li);
  });
}

async function loadNote(id) {
  currentNoteId = id;

  // Cleanup
  if (provider) provider.destroy();
  if (editor) editor.destroy();
  ydoc.destroy();

  ydoc = new Doc();
  provider = new WebrtcProvider(id, ydoc);

  // Initialize TipTap Editor
  editor = new Editor({
    element: document.getElementById('editor'),
    extensions: [
      StarterKit,
      Collaboration.configure({ document: ydoc }),
    ],
    content: '',
  });

  const doc = await db.collection('notes').doc(id).get();
  if (doc.exists) {
    const data = doc.data();
    document.getElementById('note-title').value = data.title || 'Untitled Note';

    if (data.content) {
      const binaryState = Uint8Array.from(atob(data.content), c => c.charCodeAt(0));
      Y.applyUpdate(ydoc, binaryState);
    }
  }

  refreshNotesList();
}

// ==========================================
// PERSISTENCE
// ==========================================

async function saveToFirebase() {
  if (!currentNoteId) return;

  const state = Y.encodeStateAsUpdate(ydoc);
  const base64State = btoa(String.fromCharCode(...state));
  const title = document.getElementById('note-title').value;

  try {
    await db.collection('notes').doc(currentNoteId).update({
      content: base64State,
      title: title,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error('Error saving:', e);
  }
}

let saveTimeout;
function triggerSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveToFirebase, 1000);
}

// ==========================================
// UI INITIALIZATION
// ==========================================

document.getElementById('add-note-btn').onclick = createNewNote;
document.getElementById('note-title').oninput = triggerSave;

// Handle editor updates
if (editor) {
  editor.on('update', () => {
    triggerSave();
  });
}

// Global listener for Yjs updates (collaboration)
ydoc.on('update', () => {
  triggerSave();
});

refreshNotesList();
db.collection('notes').orderBy('updatedAt', 'desc').limit(1).get().then(snapshot => {
  if (!snapshot.empty) {
    loadNote(snapshot.docs[0].id);
  } else {
    createNewNote();
  }
});
