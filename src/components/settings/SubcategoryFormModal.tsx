import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { updateUserDocSafe } from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { Subcategory, Category } from '../../types/finance';
import { generateUniqueNumericId, collectAllExistingNumericIds } from '../../lib/financeLogic';
import { EMOJI_OPTIONS } from './CategoryFormModal';

interface SubcategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  subcategoryToEdit?: Subcategory | null;
  defaultCategoryId?: number | null;
  onSuccess: (msg: string) => void;
}

export const SubcategoryFormModal: React.FC<SubcategoryFormModalProps> = ({
  isOpen,
  onClose,
  subcategoryToEdit,
  defaultCategoryId,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { data } = useFinance();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEditing = !!subcategoryToEdit;
  const categories = data.categories || [];

  // Categorias elegíveis: todas as NÃO arquivadas, mais a categoria atual se na edição
  const eligibleCategories = categories.filter((c) => {
    if (!c.archived) return true;
    if (isEditing && subcategoryToEdit && Number(c.id) === Number(subcategoryToEdit.category_id)) {
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (subcategoryToEdit) {
        setName(subcategoryToEdit.name);
        setIcon(subcategoryToEdit.icon || '');
        setSelectedCategoryId(Number(subcategoryToEdit.category_id));
      } else {
        setName('');
        setIcon('');
        if (defaultCategoryId && categories.some((c) => Number(c.id) === Number(defaultCategoryId))) {
          setSelectedCategoryId(Number(defaultCategoryId));
        } else if (eligibleCategories.length > 0) {
          setSelectedCategoryId(Number(eligibleCategories[0].id));
        } else {
          setSelectedCategoryId(null);
        }
      }
    }
  }, [isOpen, subcategoryToEdit, defaultCategoryId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim() || selectedCategoryId == null || !user) return;

    if (eligibleCategories.length === 0) {
      setErrorMessage('Crie uma categoria primeiro.');
      return;
    }

    const trimmedName = name.trim();
    const currentSubcategories = data.subcategories || [];

    // Checar duplicidade na MESMA categoria
    const isDuplicate = currentSubcategories.some(
      (s) =>
        Number(s.category_id) === Number(selectedCategoryId) &&
        s.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        (!isEditing || Number(s.id) !== Number(subcategoryToEdit?.id))
    );

    if (isDuplicate) {
      setErrorMessage('Já existe uma subcategoria com esse nome nesta categoria.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const iconValue = icon.trim() || null;
      let updatedSubcategories: Subcategory[];

      if (isEditing && subcategoryToEdit) {
        updatedSubcategories = currentSubcategories.map((s) =>
          Number(s.id) === Number(subcategoryToEdit.id)
            ? { ...s, name: trimmedName, category_id: selectedCategoryId, icon: iconValue }
            : s
        );
      } else {
        const usedIds = collectAllExistingNumericIds(data);
        const newSubId = generateUniqueNumericId(usedIds);
        const newSub: Subcategory = {
          id: newSubId,
          category_id: selectedCategoryId,
          name: trimmedName,
          archived: false,
          icon: iconValue,
        };
        updatedSubcategories = [...currentSubcategories, newSub];
      }

      await updateUserDocSafe(user.uid, {
        subcategories: updatedSubcategories,
      });

      onSuccess(isEditing ? 'Subcategoria atualizada!' : 'Subcategoria criada com sucesso!');
      onClose();
    } catch (err: any) {
      console.error('[SubcategoryFormModal] Erro ao salvar subcategoria:', err);
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
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-[#111827] dark:text-[#F5F7F7]">
            {isEditing ? 'Editar Subcategoria' : 'Nova Subcategoria'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Categoria Pai */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
              Categoria
            </label>
            {eligibleCategories.length === 0 ? (
              <p className="text-xs text-[#EF4444] dark:text-[#FF4D55] font-semibold">
                Crie uma categoria primeiro.
              </p>
            ) : (
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                {eligibleCategories.map((c) => {
                  const isSelected = selectedCategoryId === Number(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(Number(c.id))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                        isSelected
                          ? 'border-[#22A45D] dark:border-[#39D47A] bg-[#22A45D]/15 dark:bg-[#39D47A]/20 text-[#22A45D] dark:text-[#39D47A]'
                          : 'border-[#ECEFF1] dark:border-[#263233] bg-[#FAFAFB] dark:bg-[#0D1315] text-[#6B7280] dark:text-[#A9B1B1]'
                      }`}
                    >
                      {c.icon ? `${c.icon} ` : ''}{c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
              Nome da Subcategoria
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Supermercado, Farmácia, Combustível"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:border-[#22A45D] transition-colors"
            />
          </div>

          {/* Emoji / Ícone */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
              Ícone (Emoji)
            </label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="Ex: 🛒"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:border-[#22A45D] transition-colors"
            />

            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
              {EMOJI_OPTIONS.map((emoji) => {
                const isSelected = icon === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`w-9 h-9 rounded-xl text-base flex items-center justify-center shrink-0 border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#22A45D] dark:border-[#39D47A] bg-[#22A45D]/15 dark:bg-[#39D47A]/20 scale-105 shadow-xs'
                        : 'border-[#ECEFF1] dark:border-[#263233] bg-[#FAFAFB] dark:bg-[#0D1315] hover:border-[#6B7280]/40'
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs font-semibold text-[#EF4444] dark:text-[#FF4D55]">
              {errorMessage}
            </p>
          )}
        </div>

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
            disabled={!name.trim() || selectedCategoryId == null || eligibleCategories.length === 0 || isSaving}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              !name.trim() || selectedCategoryId == null || eligibleCategories.length === 0 || isSaving
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
