import React, { useState, useEffect } from 'react';
import {
  Palette,
  Languages,
  CircleDollarSign,
  Landmark,
  LayoutGrid,
  Repeat,
  RefreshCw,
  Share2,
  Trash2,
  ShieldCheck,
  Eye,
  Info,
  HelpCircle,
  Smartphone,
  LogOut,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { StandardScreenHeader } from '../components/common/StandardScreenHeader';
import { SettingsItemRow } from '../components/settings/SettingsItemRow';
import { usePWAInstall } from '../components/pwa/usePWAInstall';
import { isSecurityEnabled } from '../lib/securityHelper';

// Modais da Fase 8
import { EditProfileModal } from '../components/settings/EditProfileModal';
import { AppearanceModal } from '../components/settings/AppearanceModal';
import { ManageAccountsModal } from '../components/settings/ManageAccountsModal';
import { ManageCategoriesModal } from '../components/settings/ManageCategoriesModal';
import { RecurringTransactionsModal } from '../components/settings/RecurringTransactionsModal';
import { BackupSyncModal } from '../components/settings/BackupSyncModal';
import { ExportDataModal } from '../components/settings/ExportDataModal';
import { ClearAllDataModal } from '../components/settings/ClearAllDataModal';
import { SecurityModal } from '../components/settings/SecurityModal';
import { FaqModal } from '../components/settings/FaqModal';
import { SignOutConfirmModal } from '../components/settings/SignOutConfirmModal';

interface SettingsScreenProps {
  onClose?: () => void;
}

type ActiveDialog =
  | 'NONE'
  | 'PROFILE'
  | 'APPEARANCE'
  | 'ACCOUNTS'
  | 'CATEGORIES'
  | 'RECURRING'
  | 'BACKUP_SYNC'
  | 'EXPORT'
  | 'CLEAR_DATA'
  | 'SECURITY'
  | 'FAQ'
  | 'SIGN_OUT';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { data, hideValues, toggleHideValues } = useFinance();
  const { theme } = useTheme();
  const { isInstalled, isInstallable, isIOS, install } = usePWAInstall();

  // Estado único de diálogo ativo na tela (conforme regra 3)
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>('NONE');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Foto do perfil salva localmente
  const [savedPhoto, setSavedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const key = `mf_profile_photo_${user.uid}`;
      const localPhoto = localStorage.getItem(key);
      setSavedPhoto(localPhoto || user.photoURL || null);
    }
  }, [user, activeDialog]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // 1.1 Dados do perfil
  const emailPart = user?.email ? user.email.split('@')[0] : '';
  const profileName = user?.displayName || emailPart || 'Usuário';
  const profileEmail = user?.email || 'Autenticado via Google';

  // Iniciais: 2 primeiras letras do nome em maiúsculas
  const initials = profileName
    .replace(/[^a-zA-ZÀ-ÿ]/g, '')
    .slice(0, 2)
    .toUpperCase() || 'MF';

  // 1.2 Subtítulo de Aparência
  const appearanceSubtitle =
    theme === 'system'
      ? 'Seguir Sistema'
      : theme === 'light'
      ? 'Claro'
      : 'Escuro';

  // 1.3 Contagens
  const accountsCount = (data.accounts || []).length;
  const categoriesCount = (data.categories || []).length;
  const subcategoriesCount = (data.subcategories || []).length;
  const recurringActiveCount = (data.recurrence_rules || []).filter(
    (r) => r.active !== false
  ).length;

  // 1.5 Subtítulo de Segurança
  const securitySubtitle = isSecurityEnabled()
    ? 'Proteção ativa (PIN)'
    : 'Proteção desativada';

  // 1.6 Versão do aplicativo
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';

  const handlePwaClick = () => {
    if (isInstallable) {
      install();
    }
  };

  return (
    <div className="space-y-4 px-5 pb-8 animate-in fade-in duration-150">
      {/* Toast flutuante de sucesso */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-70 bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] font-bold text-xs py-2 px-4 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Cabeçalho da tela */}
      <StandardScreenHeader
        title="Ajustes"
        subtitle="Gerencie sua conta e preferências"
        showMonthPicker={false}
        showHideValues={false}
        titleClassName="text-[26px] font-bold text-[#111827] dark:text-[#F5F7F7]"
        rightAction={
          onClose ? (
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-[#ECEFF1] dark:border-[#263233] text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar</span>
            </button>
          ) : null
        }
      />

      {/* 1.1 Card de perfil (clicável, abre Editar Perfil) */}
      <div
        id="card-user-profile"
        onClick={() => setActiveDialog('PROFILE')}
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-[16px_14px] flex items-center justify-between cursor-pointer hover:border-[#22A45D]/40 transition-all shadow-2xs select-none"
      >
        <div className="flex items-center gap-3.5 min-w-0 pr-2">
          {/* Círculo 48px com fundo verde 15% e iniciais (ou foto salva) */}
          <div className="w-12 h-12 rounded-full bg-[#22A45D]/15 dark:bg-[#39D47A]/15 border border-[#22A45D]/30 flex items-center justify-center shrink-0 overflow-hidden">
            {savedPhoto ? (
              <img
                src={savedPhoto}
                alt={profileName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[18px] font-bold text-[#22A45D] dark:text-[#39D47A]">
                {initials}
              </span>
            )}
          </div>

          <div className="space-y-0.5 min-w-0">
            <h2 className="text-[16px] font-semibold text-[#111827] dark:text-[#F5F7F7] truncate">
              {profileName}
            </h2>
            <p className="text-[13px] text-[#6B7280] dark:text-[#A9B1B1] truncate">
              {profileEmail}
            </p>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-[#6B7280]/60 dark:text-[#A9B1B1]/60 shrink-0" />
      </div>

      {/* 1.2 Seção PREFERÊNCIAS */}
      <div className="space-y-2 mt-[22px]">
        <div className="text-[13px] font-semibold text-[#6B7280] dark:text-[#A9B1B1] uppercase tracking-wider mb-2">
          PREFERÊNCIAS
        </div>

        <div className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] divide-y divide-[#ECEFF1] dark:divide-[#263233] overflow-hidden shadow-2xs">
          <SettingsItemRow
            icon={Palette}
            title="Aparência"
            subtitle={appearanceSubtitle}
            onClick={() => setActiveDialog('APPEARANCE')}
          />
          <SettingsItemRow
            icon={Languages}
            title="Idioma"
            subtitle="Português (Brasil)"
            showChevron={false}
          />
          <SettingsItemRow
            icon={CircleDollarSign}
            title="Moeda padrão"
            subtitle="Real (R$)"
            showChevron={false}
          />
        </div>
      </div>

      {/* 1.3 Seção FINANÇAS E ORGANIZAÇÃO */}
      <div className="space-y-2 mt-[22px]">
        <div className="text-[13px] font-semibold text-[#6B7280] dark:text-[#A9B1B1] uppercase tracking-wider mb-2">
          FINANÇAS E ORGANIZAÇÃO
        </div>

        <div className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] divide-y divide-[#ECEFF1] dark:divide-[#263233] overflow-hidden shadow-2xs">
          <SettingsItemRow
            icon={Landmark}
            title="Contas e cartões"
            subtitle={`${accountsCount} cadastradas`}
            onClick={() => setActiveDialog('ACCOUNTS')}
          />
          <SettingsItemRow
            icon={LayoutGrid}
            title="Categorias e subcategorias"
            subtitle={`${categoriesCount} categorias | ${subcategoriesCount} subcategorias`}
            onClick={() => setActiveDialog('CATEGORIES')}
          />
          <SettingsItemRow
            icon={Repeat}
            title="Transações recorrentes"
            subtitle={`${recurringActiveCount} regras ativas`}
            onClick={() => setActiveDialog('RECURRING')}
          />
        </div>
      </div>

      {/* 1.4 Seção DADOS E BACKUP */}
      <div className="space-y-2 mt-[22px]">
        <div className="text-[13px] font-semibold text-[#6B7280] dark:text-[#A9B1B1] uppercase tracking-wider mb-2">
          DADOS E BACKUP
        </div>

        <div className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] divide-y divide-[#ECEFF1] dark:divide-[#263233] overflow-hidden shadow-2xs">
          <SettingsItemRow
            icon={RefreshCw}
            title="Backup e sincronização"
            subtitle="Sincronização cloud e auditoria"
            onClick={() => setActiveDialog('BACKUP_SYNC')}
          />
          <SettingsItemRow
            icon={Share2}
            title="Exportar dados"
            subtitle="JSON, CSV e PDF"
            onClick={() => setActiveDialog('EXPORT')}
          />
          <SettingsItemRow
            icon={Trash2}
            title="Limpar dados"
            subtitle="Ação destrutiva - apaga todos os dados"
            isDestructive={true}
            onClick={() => setActiveDialog('CLEAR_DATA')}
          />
        </div>
      </div>

      {/* 1.5 Seção SEGURANÇA */}
      <div className="space-y-2 mt-[22px]">
        <div className="text-[13px] font-semibold text-[#6B7280] dark:text-[#A9B1B1] uppercase tracking-wider mb-2">
          SEGURANÇA
        </div>

        <div className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] divide-y divide-[#ECEFF1] dark:divide-[#263233] overflow-hidden shadow-2xs">
          <SettingsItemRow
            icon={ShieldCheck}
            title="Proteger com senha/biometria"
            subtitle={securitySubtitle}
            onClick={() => setActiveDialog('SECURITY')}
          />
          <SettingsItemRow
            icon={Eye}
            title="Ocultar valores"
            subtitle="Oculta saldos e quantias na tela inicial"
            onClick={toggleHideValues}
            trailing={
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleHideValues();
                }}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  hideValues
                    ? 'bg-[#22A45D] dark:bg-[#39D47A]'
                    : 'bg-[#6B7280]/30 dark:bg-[#A9B1B1]/30'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    hideValues ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
            }
          />
        </div>
      </div>

      {/* 1.6 Seção SOBRE */}
      <div className="space-y-2 mt-[22px]">
        <div className="text-[13px] font-semibold text-[#6B7280] dark:text-[#A9B1B1] uppercase tracking-wider mb-2">
          SOBRE
        </div>

        <div className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] divide-y divide-[#ECEFF1] dark:divide-[#263233] overflow-hidden shadow-2xs">
          <SettingsItemRow
            icon={Info}
            title="Sobre o app"
            subtitle={`Versão v${appVersion}`}
            showChevron={false}
          />
          <SettingsItemRow
            icon={HelpCircle}
            title="Central de ajuda"
            subtitle="Perguntas frequentes e suporte"
            onClick={() => setActiveDialog('FAQ')}
          />
          {!isInstalled && (
            <SettingsItemRow
              icon={Smartphone}
              title="Instalar no celular (PWA)"
              subtitle={
                isIOS
                  ? 'Toque em Compartilhar e Adicionar à Tela de Início'
                  : 'Acesse offline com experiência de app nativo'
              }
              onClick={handlePwaClick}
              showChevron={isInstallable}
            />
          )}
        </div>
      </div>

      {/* 1.7 Sair da conta */}
      <div className="pt-4 pb-8">
        <div className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#EF4444]/30 dark:border-[#FF4D55]/30 overflow-hidden shadow-2xs">
          <SettingsItemRow
            icon={LogOut}
            title="Sair da conta"
            subtitle="Encerrar sessão no aplicativo"
            isDestructive={true}
            onClick={() => setActiveDialog('SIGN_OUT')}
          />
        </div>
      </div>

      {/* Modais de Ajustes */}
      <EditProfileModal
        isOpen={activeDialog === 'PROFILE'}
        onClose={() => setActiveDialog('NONE')}
        onSuccessToast={showToast}
      />

      <AppearanceModal
        isOpen={activeDialog === 'APPEARANCE'}
        onClose={() => setActiveDialog('NONE')}
      />

      <ManageAccountsModal
        isOpen={activeDialog === 'ACCOUNTS'}
        onClose={() => setActiveDialog('NONE')}
        onSuccessToast={showToast}
      />

      <ManageCategoriesModal
        isOpen={activeDialog === 'CATEGORIES'}
        onClose={() => setActiveDialog('NONE')}
        onSuccessToast={showToast}
      />

      <RecurringTransactionsModal
        isOpen={activeDialog === 'RECURRING'}
        onClose={() => setActiveDialog('NONE')}
        onSuccessToast={showToast}
      />

      <BackupSyncModal
        isOpen={activeDialog === 'BACKUP_SYNC'}
        onClose={() => setActiveDialog('NONE')}
      />

      <ExportDataModal
        isOpen={activeDialog === 'EXPORT'}
        onClose={() => setActiveDialog('NONE')}
        onSuccessToast={showToast}
      />

      <ClearAllDataModal
        isOpen={activeDialog === 'CLEAR_DATA'}
        onClose={() => setActiveDialog('NONE')}
        onSuccessToast={showToast}
      />

      <SecurityModal
        isOpen={activeDialog === 'SECURITY'}
        onClose={() => setActiveDialog('NONE')}
        onSuccessToast={showToast}
      />

      <FaqModal
        isOpen={activeDialog === 'FAQ'}
        onClose={() => setActiveDialog('NONE')}
      />

      <SignOutConfirmModal
        isOpen={activeDialog === 'SIGN_OUT'}
        onClose={() => setActiveDialog('NONE')}
      />
    </div>
  );
};
