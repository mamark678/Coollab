import type { User as FirebaseUser } from 'firebase/auth';

export type User = FirebaseUser;

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export type AuthAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

export interface AuthContextType {
  state: AuthState;
  dispatch: React.Dispatch<AuthAction>;
  logout: () => Promise<void>;
}
