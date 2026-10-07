import React, { useState, useRef, useEffect } from 'react';
import { X, User as UserIcon, Camera, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const { user, updateUserProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const photoKey = user ? `mf_profile_photo_${user.uid}` : 'mf_profile_photo';

  useEffect(() => {
    if (isOpen) {
      setDisplayName(user?.displayName || '');
      setErrorMessage(null);
      // Carrega foto salva localmente
      const savedPhoto = localStorage.getItem(photoKey);
      setPhotoDataUrl(savedPhoto || user?.photoURL || null);
    }
  }, [isOpen, user, photoKey]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Redimensionar e recortar quadrado 256x256 via canvas
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;

        ctx.drawImage(img, startX, startY, size, size, 0, 0, 256, 256);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPhotoDataUrl(compressedDataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset file input
    e.target.value = '';
  };

  const handleRemovePhoto = () => {
    setPhotoDataUrl(null);
  };

  const handleSave = async () => {
    if (!displayName.trim()) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      // 1. Atualiza nome no Firebase Auth (visível tanto na Web quanto no app Android)
      await updateUserProfile(displayName.trim());

      /**
       * NOTA ARQUITETURAL IMPORTANTE:
       * NÃO gravamos a foto no documento /users/{uid} do Firestore porque o app Android
       * sobrescreve o documento inteiro a cada sincronização e apagaria o campo.
       * A foto fica armazenada apenas neste aparelho (localStorage) por enquanto;
       * quando entrarmos com Firebase Storage (junto com os comprovantes), ela passará a sincronizar na nuvem.
       */
      if (photoDataUrl) {
        localStorage.setItem(photoKey, photoDataUrl);
      } else {
        localStorage.removeItem(photoKey);
      }

      onSuccessToast('Perfil atualizado!');
      onClose();
    } catch (err: any) {
      console.error('[EditProfileModal] Erro ao salvar perfil:', err);
      setErrorMessage('Não foi possível salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-6 shadow-xl space-y-5 animate-in zoom-in-95 duration-150 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topo do modal */}
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-[#111827] dark:text-[#F5F7F7]">
            Editar Perfil
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Círculo de Foto (72px) */}
        <div className="flex flex-col items-center gap-3 py-1">
          <div className="relative w-[72px] h-[72px] rounded-full bg-[#22A45D]/15 dark:bg-[#39D47A]/15 border-2 border-[#22A45D]/30 flex items-center justify-center overflow-hidden shrink-0">
            {photoDataUrl ? (
              <img
                src={photoDataUrl}
                alt="Foto de perfil"
                className="w-full h-full object-cover"
              />
            ) : (
              <UserIcon className="w-8 h-8 text-[#22A45D] dark:text-[#39D47A]" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/5 dark:bg-white/10 text-[#111827] dark:text-[#F5F7F7] hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Alterar foto</span>
            </button>

            {photoDataUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#EF4444] dark:text-[#FF4D55] hover:bg-[#EF4444]/10 transition-colors cursor-pointer"
                title="Remover foto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remover</span>
              </button>
            )}
          </div>
        </div>

        {/* Formulário */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
              Nome completo
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome completo"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:border-[#22A45D] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
              E-mail (não editável)
            </label>
            <input
              type="email"
              disabled
              value={user?.email || 'Autenticado via Google'}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-[#ECEFF1] dark:border-[#263233] text-[#6B7280] dark:text-[#A9B1B1] cursor-not-allowed select-none"
            />
          </div>

          {errorMessage && (
            <p className="text-xs font-semibold text-[#EF4444] dark:text-[#FF4D55]">
              {errorMessage}
            </p>
          )}
        </div>

        {/* Botões do rodapé */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#ECEFF1] dark:border-[#263233]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!displayName.trim() || isSaving}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              !displayName.trim() || isSaving
                ? 'opacity-50 cursor-not-allowed bg-black/10 dark:bg-white/10 text-[#6B7280]'
                : 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] hover:brightness-105 active:scale-98'
            }`}
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Salvar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
