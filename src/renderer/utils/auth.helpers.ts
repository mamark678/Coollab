export const mapAuthError = (error: any): string => {
  const code = typeof error === 'string' ? error : (error?.code || error?.message);
  
  switch (code) {
    case 'auth/user-not-found':
      return 'No account found with this email';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists';
    case 'auth/weak-password':
      return 'Password must be at least 8 characters';
    case 'auth/invalid-email':
      return 'Please enter a valid email address';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled';
    case 'auth/account-exists-with-different-credential':
      return 'This email is linked to a different sign-in method';
    case 'auth/invalid-credential':
      return 'Invalid credentials. Please try again';
    case 'auth/requires-recent-login':
      return 'Please sign in again to complete this action';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};
