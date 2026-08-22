import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request all required Google Sheets scopes
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'consent select_account',
});

const ACCESS_TOKEN_KEY = 'google_sheets_access_token';

let isSigningIn = false;
let memoryAccessToken: string | null = sessionStorage.getItem(ACCESS_TOKEN_KEY);

// Track auth state
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const storedToken = sessionStorage.getItem(ACCESS_TOKEN_KEY) || memoryAccessToken;
      if (storedToken) {
        memoryAccessToken = storedToken;
        if (onAuthSuccess) onAuthSuccess(user, storedToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      memoryAccessToken = null;
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso com permissão do Google Sheets. Por favor, tente novamente e aceite todas as permissões solicitadas.');
    }

    memoryAccessToken = credential.accessToken;
    sessionStorage.setItem(ACCESS_TOKEN_KEY, credential.accessToken);
    return { user: result.user, accessToken: memoryAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return memoryAccessToken || sessionStorage.getItem(ACCESS_TOKEN_KEY);
};

export const setAccessToken = (token: string | null) => {
  memoryAccessToken = token;
  if (token) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(ACCESS_KEY_CLEAN);
  }
};

const ACCESS_KEY_CLEAN = ACCESS_TOKEN_KEY;

export const logout = async () => {
  await signOut(auth);
  memoryAccessToken = null;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
};
