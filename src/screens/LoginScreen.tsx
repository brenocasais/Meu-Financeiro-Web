import React, { useState } from 'react';
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const LoginScreen: React.FC = () => {
  const { loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();
  const { theme } = useTheme();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleMode = () => {
    setErrorMessage(null);
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Preencha seu e-mail e sua senha para continuar.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar a autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao entrar com o Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const isAnyLoading = isLoading || isGoogleLoading;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-[#FAFAFB] dark:bg-[#0D1214] text-[#111827] dark:text-[#F5F7F7] transition-colors">
      <div className="w-full max-w-sm">
        {/* Brand identity */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] font-bold text-xl shadow-xs mb-3">
            MF
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#F5F7F7]">
            Meu Financeiro
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] mt-1">
            Controle financeiro pessoal sincronizado em tempo real
          </p>
        </div>

        {/* Main Card with 20px border-radius */}
        <div
          id="card-auth"
          className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] p-6 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] transition-colors"
        >
          <div className="mb-5">
            <h2 className="text-base font-bold text-[#111827] dark:text-[#F5F7F7]">
              {mode === 'login' ? 'Entrar na sua conta' : 'Criar nova conta'}
            </h2>
            <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] mt-0.5">
              {mode === 'login'
                ? 'Insira suas credenciais para acessar seus dados'
                : 'Cadastre-se para sincronizar com o banco de dados'}
            </p>
          </div>

          {/* Error alert */}
          {errorMessage && (
            <div
              id="auth-error-banner"
              className="mb-4 p-3 rounded-xl bg-[#EF4444]/10 dark:bg-[#FF4D55]/10 border border-[#EF4444]/20 dark:border-[#FF4D55]/20 flex items-start gap-2.5 text-xs text-[#EF4444] dark:text-[#FF4D55] animate-in fade-in"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{errorMessage}</div>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="input-auth-email"
                className="block text-xs font-semibold text-[#111827] dark:text-[#F5F7F7] mb-1.5"
              >
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280] dark:text-[#A9B1B1]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="input-auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isAnyLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#222E30] bg-[#FAFAFB] dark:bg-[#0D1214] text-xs text-[#111827] dark:text-[#F5F7F7] placeholder-[#6B7280]/60 dark:placeholder-[#A9B1B1]/60 focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="input-auth-password"
                className="block text-xs font-semibold text-[#111827] dark:text-[#F5F7F7] mb-1.5"
              >
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280] dark:text-[#A9B1B1]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-auth-password"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  disabled={isAnyLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'login' ? 'Digite sua senha' : 'Mínimo de 6 caracteres'}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#222E30] bg-[#FAFAFB] dark:bg-[#0D1214] text-xs text-[#111827] dark:text-[#F5F7F7] placeholder-[#6B7280]/60 dark:placeholder-[#A9B1B1]/60 focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="btn-auth-submit"
              type="submit"
              disabled={isAnyLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-[#22A45D] hover:bg-[#1E9152] dark:bg-[#39D47A] dark:hover:bg-[#2FBD6B] text-white dark:text-[#0D1214] text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{mode === 'login' ? 'Entrando...' : 'Criando conta...'}</span>
                </>
              ) : (
                <span>{mode === 'login' ? 'Entrar' : 'Criar conta'}</span>
              )}
            </button>
          </form>

          {/* Toggle mode link */}
          <div className="mt-4 text-center">
            <button
              id="btn-toggle-auth-mode"
              type="button"
              disabled={isAnyLoading}
              onClick={toggleMode}
              className="text-xs text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#22A45D] dark:hover:text-[#39D47A] transition-colors cursor-pointer"
            >
              {mode === 'login' ? (
                <>
                  Não tem conta?{' '}
                  <span className="font-semibold text-[#22A45D] dark:text-[#39D47A] underline underline-offset-2">
                    Criar uma
                  </span>
                </>
              ) : (
                <>
                  Já tem uma conta?{' '}
                  <span className="font-semibold text-[#22A45D] dark:text-[#39D47A] underline underline-offset-2">
                    Fazer login
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Divider "ou" */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E5E7EB] dark:border-[#222E30]" />
            </div>
            <div className="relative flex justify-center text-[11px]">
              <span className="px-3 bg-[#FFFFFF] dark:bg-[#172021] text-[#6B7280] dark:text-[#A9B1B1] uppercase font-medium">
                ou
              </span>
            </div>
          </div>

          {/* Continue with Google button */}
          <button
            id="btn-login-google"
            type="button"
            disabled={isAnyLoading}
            onClick={handleGoogleLogin}
            className="w-full py-2.5 px-4 rounded-xl border border-[#E5E7EB] dark:border-[#222E30] bg-[#FFFFFF] dark:bg-[#172021] hover:bg-[#FAFAFB] dark:hover:bg-[#1A2526] text-xs font-semibold text-[#111827] dark:text-[#F5F7F7] flex items-center justify-center gap-3 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#6B7280] dark:text-[#A9B1B1]" />
                <span>Conectando com o Google...</span>
              </>
            ) : (
              <>
                {/* Official Google SVG icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continuar com Google</span>
              </>
            )}
          </button>
        </div>

        {/* Security & Sync hint */}
        <div className="mt-6 text-center text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
          <span>Conectado ao Firebase de produção do Meu Financeiro</span>
        </div>
      </div>
    </div>
  );
};
