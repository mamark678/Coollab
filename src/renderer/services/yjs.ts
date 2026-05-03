import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { IndexeddbPersistence } from 'y-indexeddb'

export interface YjsServiceConfig {
  roomName: string
}

export class YjsService {
  private static instance: YjsService
  private doc: Y.Doc | null = null
  private currentRoomName: string | null = null
  private provider: WebrtcProvider | null = null
  private persistence: IndexeddbPersistence | null = null
  private initPromise: Promise<void> | null = null

  private constructor() {}

  public static getInstance(): YjsService {
    if (!YjsService.instance) {
      YjsService.instance = new YjsService()
    }
    return YjsService.instance
  }

  /** Idempotent — safe to call multiple times. Returns the same Promise. */
  public init(config: YjsServiceConfig): Promise<void> {
    if (this.currentRoomName === config.roomName && this.initPromise) {
      return this.initPromise
    }
    
    // If room changed, destroy old session first
    if (this.currentRoomName !== config.roomName && this.currentRoomName !== null) {
       this.destroy();
    }

    this.currentRoomName = config.roomName;
    this.initPromise = this.doInit(config)
    return this.initPromise
  }

  private async doInit(config: YjsServiceConfig): Promise<void> {
    this.doc = new Y.Doc({ gc: true });

    // 1. Local persistence — loads from IndexedDB instantly, even offline
    try {
      this.persistence = new IndexeddbPersistence(config.roomName, this.doc)
      // sometimes whenSynced rejects if indexeddb is corrupted
      await this.persistence.whenSynced
    } catch (dbErr) {
      console.warn('[Yjs] IndexedDB persistence failed/locked. Running memory-only:', dbErr)
      this.persistence = null
    }

    // 2. Real-time P2P sync — using public community signaling servers for internet P2P
    this.provider = new WebrtcProvider(config.roomName, this.doc, {
      signaling: [
        'wss://y-webrtc-cw7h.onrender.com',
        'wss://y-webrtc.fly.dev'
      ],
    })

    // 5. WebRTC peer limit warning
    this.provider.on('peers', (event: { webrtcPeers: string[] }) => {
      const peerCount = event.webrtcPeers.length;
      if (peerCount > 10) {
        console.warn(`[Yjs] Peer limit exceeded (${peerCount}). Switching to Firestore-only sync mode for this session to preserve performance.`);
        this.provider?.disconnect();
      }
    });

    this.provider.on('status', (event: { connected: boolean }) => {
      console.log(`[Yjs] [DEBUG] Room: "${config.roomName}" | Connected: ${event.connected} | Peers: ${this.provider?.connected ? 'active' : 'searching'}`);
    });

    console.log(`[Yjs] Initialized room: "${config.roomName}" with signaling:`, this.provider.signalingUrls)
  }

  public getDoc(): Y.Doc {
    if (!this.doc) throw new Error('[YjsService] getDoc called before init');
    return this.doc
  }

  /** Only valid after init() resolves. */
  public getProvider(): WebrtcProvider {
    if (!this.provider) {
      throw new Error('[YjsService] getProvider() called before init() resolved.')
    }
    return this.provider
  }

  public onStatus(callback: (status: 'offline' | 'syncing' | 'synced') => void): () => void {
    if (!this.provider) {
      callback('offline');
      return () => {};
    }

    const handler = (event: { connected: boolean }) => {
      if (event.connected) callback('synced');
      else callback('syncing');
    };

    this.provider.on('status', handler);
    // Initial call
    handler({ connected: this.provider.connected });

    return () => this.provider?.off('status', handler);
  }

  public destroy(): void {
    this.provider?.destroy()
    this.persistence?.destroy()
    this.doc?.destroy()
    this.doc = null
    this.provider = null
    this.persistence = null
    this.initPromise = null
    this.currentRoomName = null
  }

  public async clearAllPersistence(): Promise<void> {
    this.destroy();
    if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
      try {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name) {
            console.log(`[YjsService] Deleting database: ${db.name}`);
            indexedDB.deleteDatabase(db.name);
          }
        }
      } catch (err) {
        console.error('[YjsService] Failed to clear IndexedDB:', err);
      }
    }
  }
}
