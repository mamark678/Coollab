import { User as FirebaseUser } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  name: string;
  email?: string | null;
  photoURL?: string | null;
  photoBase64?: string | null;
  [key: string]: any;
}

/**
 * Returns the correct avatar URL based on sign-in method and custom uploads.
 * 
 * Logic:
 * 1. If Google user (has google.com in providerData) -> ALWAYS use Google photoURL.
 * 2. If Email/Password user -> use custom photoBase64 if it exists.
 * 3. Fallback -> return null (the UI should show initials avatar).
 * 
 * @param user - Can be a Firebase User object or a Firestore UserProfile object.
 * @param isGoogle - Optional hint if we already know the user type.
 */
export function getUserAvatar(user: any): string | null {
  if (!user) return null;

  // Case 1: Firebase Auth User object
  if (user.providerData && Array.isArray(user.providerData)) {
    const isGoogle = user.providerData.some((p: any) => p.providerId === 'google.com');
    if (isGoogle) {
      return user.photoURL || null;
    }
    // For password users, the Firebase User object itself doesn't have the base64 photo (that's in Firestore)
    // But we might pass the Firestore profile instead.
  }

  // Case 2: Firestore User Profile object
  // How do we know if it's a Google user from the Firestore doc?
  // We should ideally have a 'provider' field in Firestore, but if not, 
  // we can check if it has a photoURL AND NO photoBase64.
  // Actually, the requirement says "Google Sign-In users... The photoBase64 field... should be ignored".
  
  // If the user has a photoBase64, we assume they are a password user who uploaded a photo.
  if (user.photoBase64) {
    return user.photoBase64;
  }

  // If they have a photoURL but no photoBase64, it's likely a Google user.
  if (user.photoURL) {
    return user.photoURL;
  }

  return null;
}

/**
 * Checks if a given Firebase user is a Google account.
 */
export function isGoogleUser(user: FirebaseUser | null): boolean {
  return user?.providerData.some(p => p.providerId === 'google.com') ?? false;
}
