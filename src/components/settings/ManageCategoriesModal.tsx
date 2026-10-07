import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { updateUserDocSafe } from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { Category, Subcategory } from '../../types/finance';
import { CategoryFormModal } from './CategoryFormModal';
import { SubcategoryFormModal } from './SubcategoryFormModal';
import { SuggestedCategoriesModal } from './SuggestedCategoriesModal';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
}

export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const { user } = useAuth();
  const { data } = useFinance();

  // Modais filhos
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);

  const [subcategoryToEdit, setSubcategoryToEdit] = useState<Subcategory | null>(null);
  const [isSubcategoryFormOpen, setIsSubcategoryFormOpen] = useState(false);

  const [isSuggestedModalOpen, setIsSuggestedModalOpen] = useState(false);

  // Estados de confirmação/bloqueio de exclusão
  const [deleteTargetCategory, setDeleteTargetCategory] = useState<Category | null>(null);
  const [deleteTargetSubcategory, setDeleteTargetSubcategory] = useState<Subcategory | null>(null);
  const [isCategoryBlocked, setIsCategoryBlocked] = useState(false);
  const [isSubcategoryBlocked, setIsSubcategoryBlocked] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = data.categories || [];
  const subcategories = data.subcategories || [];

  const catMap = new Map<number, string>();
  categories.forEach((c) => catMap.set(Number(c.id), c.name));

  // --- Ações de Categoria ---
  const handleToggleArchiveCategory = async (cat: Category) => {
    if (!user) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const nextArchived = !cat.archived;
      const updated = categories.map((c) =>
        Number(c.id) === Number(cat.id) ? { ...c, archived: nextArchived } : c
      );

      await updateUserDocSafe(user.uid, { categories: updated });
      onSuccessToast(nextArchived ? 'Categoria arquivada!' : 'Categoria desarquivada!');
    } catch (err: any) {
      console.error('[ManageCategoriesModal] Erro ao arquivar categoria:', err);
      setErrorMessage('Não foi possível salvar. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteCategoryClick = (cat: Category) => {
    setErrorMessage(null);
    const catId = Number(cat.id);

    // Bloquear se tiver subcategorias, transações, budget_allocations ou regras recorrentes
    const hasSubcats = subcategories.some((s) => Number(s.category_id) === catId);
    const hasTxs = (data.transactions || []).some((t) => Number(t.category_id) === catId);
    const hasAlloc = (data.budget_allocations || []).some((b) => Number(b.category_id) === catId);
    const hasRecurr = (data.recurrence_rules || []).some((r) => Number(r.category_id) === catId);

    const isBlocked = hasSubcats || hasTxs || hasAlloc || hasRecurr;
    setDeleteTargetCategory(cat);
    setIsCategoryBlocked(isBlocked);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!user || !deleteTargetCategory) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const updated = categories.filter((c) => Number(c.id) !== Number(deleteTargetCategory.id));
      await updateUserDocSafe(user.uid, { categories: updated });

      onSuccessToast('Categoria excluída!');
      setDeleteTargetCategory(null);
    } catch (err: any) {
      console.error('[ManageCategoriesModal] Erro ao excluir categoria:', err);
      setErrorMessage('Não foi possível salvar. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Ações de Subcategoria ---
  const handleToggleArchiveSubcategory = async (sub: Subcategory) => {
    if (!user) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const nextArchived = !sub.archived;
      const updated = subcategories.map((s) =>
        Number(s.id) === Number(sub.id) ? { ...s, archived: nextArchived } : s
      );

      await updateUserDocSafe(user.uid, { subcategories: updated });
      onSuccessToast(nextArchived ? 'Subcategoria arquivada!' : 'Subcategoria desarquivada!');
    } catch (err: any) {
      console.error('[ManageCategoriesModal] Erro ao arquivar subcategoria:', err);
      setErrorMessage('Não foi possível salvar. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSubcategoryClick = (sub: Subcategory) => {
    setErrorMessage(null);
    const subId = Number(sub.id);

    const hasTxs = (data.transactions || []).some((t) => Number(t.subcategory_id) === subId);
    const hasAlloc = (data.budget_allocations || []).some((b) => Number(b.subcategory_id) === subId);
    const hasRecurr = (data.recurrence_rules || []).some((r) => Number(r.subcategory_id) === subId);

    const isBlocked = hasTxs || hasAlloc || hasRecurr;
    setDeleteTargetSubcategory(sub);
    setIsSubcategoryBlocked(isBlocked);
  };

  const handleConfirmDeleteSubcategory = async () => {
    if (!user || !deleteTargetSubcategory) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const updated = subcategories.filter((s) => Number(s.id) !== Number(deleteTargetSubcategory.id));
      await updateUserDocSafe(user.uid, { subcategories: updated });

      onSuccessToast('Subcategoria excluída!');
      setDeleteTargetSubcategory(null);
    } catch (err: any) {
      console.error('[ManageCategoriesModal] Erro ao excluir subcategoria:', err);
      setErrorMessage('Não foi possível salvar. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150 transition-colors flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Topo */}
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-[#111827] dark:text-[#F5F7F7]">
              Categorias e Subcategorias
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Botão outline Adicionar do modelo sugerido */}
          <button
            type="button"
            onClick={() => setIsSuggestedModalOpen(true)}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold border border-[#22A45D] dark:border-[#39D47A] text-[#22A45D] dark:text-[#39D47A] hover:bg-[#22A45D]/10 dark:hover:bg-[#39D47A]/10 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>Adicionar do modelo sugerido</span>
          </button>

          {errorMessage && (
            <p className="text-xs font-semibold text-[#EF4444] dark:text-[#FF4D55]">
              {errorMessage}
            </p>
          )}

          {/* Conteúdo com rolagem */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[220px]">
            {/* Seção Categorias */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-[#111827] dark:text-[#F5F7F7]">
                  Categorias
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryToEdit(null);
                    setIsCategoryFormOpen(true);
                  }}
                  className="text-xs font-bold text-[#22A45D] dark:text-[#39D47A] hover:underline cursor-pointer"
                >
                  + Nova Categoria
                </button>
              </div>

              {categories.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#6B7280] dark:text-[#A9B1B1]">
                  Nenhuma categoria criada.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {categories.map((cat) => {
                    const isArchived = !!cat.archived;
                    return (
                      <div
                        key={cat.id}
                        className={`p-2 rounded-[8px] bg-black/[0.04] dark:bg-white/[0.05] border border-[#ECEFF1] dark:border-[#263233] flex items-center justify-between transition-colors ${
                          isArchived ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="text-[13px] font-semibold text-[#111827] dark:text-[#F5F7F7] truncate">
                            {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                          </span>
                          {isArchived && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[#6B7280] dark:text-[#A9B1B1]">
                              Arquivada
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleArchiveCategory(cat)}
                            disabled={isProcessing}
                            className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            title={isArchived ? 'Desarquivar' : 'Arquivar'}
                          >
                            {isArchived ? (
                              <ArchiveRestore className="w-3.5 h-3.5 text-[#22A45D] dark:text-[#39D47A]" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCategoryToEdit(cat);
                              setIsCategoryFormOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-[#22A45D] dark:text-[#39D47A] hover:bg-[#22A45D]/10 transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategoryClick(cat)}
                            className="p-1.5 rounded-lg text-[#EF4444] dark:text-[#FF4D55] hover:bg-[#EF4444]/10 transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Divisor */}
            <div className="border-t border-[#ECEFF1] dark:border-[#263233]" />

            {/* Seção Subcategorias */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-[#111827] dark:text-[#F5F7F7]">
                  Subcategorias
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSubcategoryToEdit(null);
                    setIsSubcategoryFormOpen(true);
                  }}
                  className="text-xs font-bold text-[#22A45D] dark:text-[#39D47A] hover:underline cursor-pointer"
                >
                  + Nova Subcategoria
                </button>
              </div>

              {subcategories.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#6B7280] dark:text-[#A9B1B1]">
                  Nenhuma subcategoria criada.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {subcategories.map((sub) => {
                    const isArchived = !!sub.archived;
                    const catName = catMap.get(Number(sub.category_id)) || 'Sem categoria';
                    return (
                      <div
                        key={sub.id}
                        className={`p-2 rounded-[8px] bg-black/[0.04] dark:bg-white/[0.05] border border-[#ECEFF1] dark:border-[#263233] flex items-center justify-between transition-colors ${
                          isArchived ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-[#111827] dark:text-[#F5F7F7] truncate">
                              {sub.icon ? `${sub.icon} ` : ''}{sub.name}
                            </span>
                            {isArchived && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[#6B7280] dark:text-[#A9B1B1]">
                                Arquivada
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1] truncate">
                            Categoria: {catName}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleArchiveSubcategory(sub)}
                            disabled={isProcessing}
                            className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            title={isArchived ? 'Desarquivar' : 'Arquivar'}
                          >
                            {isArchived ? (
                              <ArchiveRestore className="w-3.5 h-3.5 text-[#22A45D] dark:text-[#39D47A]" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSubcategoryToEdit(sub);
                              setIsSubcategoryFormOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-[#22A45D] dark:text-[#39D47A] hover:bg-[#22A45D]/10 transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubcategoryClick(sub)}
                            className="p-1.5 rounded-lg text-[#EF4444] dark:text-[#FF4D55] hover:bg-[#EF4444]/10 transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Rodapé Concluído */}
          <div className="pt-2 border-t border-[#ECEFF1] dark:border-[#263233] flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-black/5 dark:bg-white/10 text-[#111827] dark:text-[#F5F7F7] hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-pointer"
            >
              Concluído
            </button>
          </div>
        </div>
      </div>

      {/* Formulário de Categoria */}
      <CategoryFormModal
        isOpen={isCategoryFormOpen}
        onClose={() => setIsCategoryFormOpen(false)}
        categoryToEdit={categoryToEdit}
        onSuccess={onSuccessToast}
      />

      {/* Formulário de Subcategoria */}
      <SubcategoryFormModal
        isOpen={isSubcategoryFormOpen}
        onClose={() => setIsSubcategoryFormOpen(false)}
        subcategoryToEdit={subcategoryToEdit}
        onSuccess={onSuccessToast}
      />

      {/* Modelo Sugerido de Categorias */}
      <SuggestedCategoriesModal
        isOpen={isSuggestedModalOpen}
        onClose={() => setIsSuggestedModalOpen(false)}
        onSuccessToast={onSuccessToast}
      />

      {/* Confirmação / Bloqueio de Exclusão de Categoria */}
      {deleteTargetCategory && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setDeleteTargetCategory(null)}
        >
          <div
            className="w-full max-w-sm rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#EF4444]/15 dark:bg-[#FF4D55]/20 text-[#EF4444] dark:text-[#FF4D55] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F7]">
                {isCategoryBlocked ? 'Categoria com histórico' : 'Excluir categoria'}
              </h3>
            </div>

            {isCategoryBlocked ? (
              <div className="space-y-3">
                <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
                  Esta categoria já tem histórico. Arquive em vez de excluir.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ECEFF1] dark:border-[#263233]">
                  <button
                    type="button"
                    onClick={() => setDeleteTargetCategory(null)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleToggleArchiveCategory(deleteTargetCategory);
                      setDeleteTargetCategory(null);
                    }}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] hover:brightness-105 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Arquivar</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
                  Excluir a categoria '{deleteTargetCategory.name}'?
                </p>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ECEFF1] dark:border-[#263233]">
                  <button
                    type="button"
                    onClick={() => setDeleteTargetCategory(null)}
                    disabled={isProcessing}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteCategory}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#EF4444] dark:bg-[#FF4D55] text-white hover:brightness-105 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmação / Bloqueio de Exclusão de Subcategoria */}
      {deleteTargetSubcategory && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setDeleteTargetSubcategory(null)}
        >
          <div
            className="w-full max-w-sm rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#EF4444]/15 dark:bg-[#FF4D55]/20 text-[#EF4444] dark:text-[#FF4D55] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F7]">
                {isSubcategoryBlocked ? 'Subcategoria com histórico' : 'Excluir subcategoria'}
              </h3>
            </div>

            {isSubcategoryBlocked ? (
              <div className="space-y-3">
                <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
                  Esta subcategoria já tem histórico. Arquive em vez de excluir.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ECEFF1] dark:border-[#263233]">
                  <button
                    type="button"
                    onClick={() => setDeleteTargetSubcategory(null)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleToggleArchiveSubcategory(deleteTargetSubcategory);
                      setDeleteTargetSubcategory(null);
                    }}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] hover:brightness-105 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Arquivar</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
                  Excluir a subcategoria '{deleteTargetSubcategory.name}'?
                </p>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ECEFF1] dark:border-[#263233]">
                  <button
                    type="button"
                    onClick={() => setDeleteTargetSubcategory(null)}
                    disabled={isProcessing}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteSubcategory}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#EF4444] dark:bg-[#FF4D55] text-white hover:brightness-105 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
