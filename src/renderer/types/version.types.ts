export interface VersionItem {
  id?: string;
  content: string; // snapshot
  savedBy: { uid: string; name: string };
  savedAt: number;
  label: string;
  versionNumber: number;
}
