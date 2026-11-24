import { createContext, useContext, useEffect, useState } from 'react';
import { watchAuth, configMissing } from '../firebase';

const AuthContext = createContext({ user: null, ready: false });

/** Tracks the signed-in user. Nobody is signed in automatically: the sign-in screen asks first. */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, ready: false });

  useEffect(() => {
    if (configMissing) {
      setState({ user: null, ready: true });
      return undefined;
    }
    return watchAuth((user) => setState({ user, ready: true }));
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
