import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  AuthError,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Converte códigos de erro do Firebase Authentication para mensagens amigáveis em português.
 */
export function getAuthErrorMessage(error: any): string {
  const code = error?.code || '';

  switch (code) {
    case 'auth/invalid-email':
      return 'O formato do e-mail informado é inválido.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'E-mail ou senha incorretos. Verifique os dados digitados.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado. Tente entrar ou use outro e-mail.';
    case 'auth/weak-password':
      return 'A senha é muito fraca. Utilize no mínimo 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas sem sucesso. Aguarde alguns instantes e tente novamente.';
    case 'auth/network-request-failed':
      return 'Falha na conexão de rede. Verifique seu acesso à internet.';
    case 'auth/popup-closed-by-user':
      return 'A janela de autenticação do Google foi fechada antes de concluir o login.';
    case 'auth/cancelled-popup-request':
      return 'A solicitação de login com popup foi cancelada.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela pop-up do Google. Permita pop-ups para este site.';
    case 'auth/user-disabled':
      return 'Esta conta de usuário foi desativada pelo administrador.';
    case 'auth/operation-not-allowed':
      return 'Este método de autenticação não está habilitado no Firebase.';
    default:
      if (error?.message && typeof error.message === 'string') {
        return error.message;
      }
      return 'Ocorreu um erro durante a autenticação. Tente novamente.';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Escuta o estado de autenticação do Firebase
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error: any) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const registerWithEmail = async (email: string, password: string): Promise<void> => {
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (error: any) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const loginWithGoogle = async (): Promise<void> => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await fbSignOut(auth);
    } catch (error: any) {
      console.error('[Auth] Erro ao encerrar sessão:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
