import React from 'react';
import { ShieldCheck, FileSpreadsheet, Sparkles, AlertCircle } from 'lucide-react';

interface LoginPromptProps {
  isLoading: boolean;
  error?: string | null;
  onLogin: () => void;
  onContinueDemo: () => void;
}

export const LoginPrompt: React.FC<LoginPromptProps> = ({
  isLoading,
  error,
  onLogin,
  onContinueDemo,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 text-slate-100">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-center">
        {/* Brand Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
          <ShieldCheck className="w-8 h-8" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-xl font-black text-slate-100 tracking-tight">Controle de Acesso</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Credenciamento e validação de entrada de participantes agrupados por empresa expositora,
            com sincronização em tempo real no Google Sheets.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {/* Official Google Sign-In button */}
          <button
            onClick={onLogin}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-xl flex items-center justify-center gap-3 shadow-md active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
            )}
            <span className="text-sm">Entrar com o Google</span>
          </button>

          {/* Test in demo mode */}
          <button
            onClick={onContinueDemo}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Testar em Modo Demonstração</span>
          </button>
        </div>

        {/* Footnote */}
        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500/70" />
          <span>Conexão direta com a sua planilha</span>
        </div>
      </div>
    </div>
  );
};
