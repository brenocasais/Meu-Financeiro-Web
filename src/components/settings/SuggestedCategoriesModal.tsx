import React, { useState, useMemo } from 'react';
import { X, ChevronDown, ChevronRight, Check, Sparkles, Loader2 } from 'lucide-react';
import { updateUserDocSafe } from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { CATEGORY_TEMPLATES, TemplateCategory, TemplateSubcategory } from '../../lib/categoryTemplates';
import { Category, Subcategory } from '../../types/finance';
import { generateUniqueNumericId, collectAllExistingNumericIds } from '../../lib/financeLogic';

interface SuggestedCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
}

export const SuggestedCategoriesModal: React.FC<SuggestedCategoriesModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const { user } = useAuth();
  const { data } = useFinance();

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedSubcategories, setSelectedSubcategories] = useState<Set<string>>(() => new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mapeamento dos itens existentes do usuário
  const existingCategoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    (data.categories || []).forEach((c) => {
      map.set(c.name.trim().toLowerCase(), c);
    });
    return map;
  }, [data.categories]);

  const existingSubcategoryMap = useMemo(() => {
    // chave: "catNameNormalized::subNameNormalized"
    const map = new Map<string, Subcategory>();
    const catIdToName = new Map<number, string>();
    (data.categories || []).forEach((c) => catIdToName.set(Number(c.id), c.name.trim().toLowerCase()));

    (data.subcategories || []).forEach((s) => {
      const catName = catIdToName.get(Number(s.category_id));
      if (catName) {
        map.set(`${catName}::${s.name.trim().toLowerCase()}`, s);
      }
    });
    return map;
  }, [data.categories, data.subcategories]);

  // Inicializa marcadas: todas as subcategorias do modelo que ainda NÃO existem
  React.useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      const initialSelected = new Set<string>();
      CATEGORY_TEMPLATES.forEach((cat) => {
        const catKey = cat.name.trim().toLowerCase();
        cat.subcategories.forEach((sub) => {
          const subKey = sub.name.trim().toLowerCase();
          const compositeKey = `${catKey}::${subKey}`;
          if (!existingSubcategoryMap.has(compositeKey)) {
            initialSelected.add(compositeKey);
          }
        });
      });
      setSelectedSubcategories(initialSelected);
      // Recolhe todas inicialmente
      setExpandedCategories(new Set());
    }
  }, [isOpen, existingSubcategoryMap]);

  if (!isOpen) return null;

  const toggleExpand = (catName: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catName)) {
        next.delete(catName);
      } else {
        next.add(catName);
      }
      return next;
    });
  };

  const isSubcategoryExisting = (catName: string, subName: string): boolean => {
    const key = `${catName.trim().toLowerCase()}::${subName.trim().toLowerCase()}`;
    return existingSubcategoryMap.has(key);
  };

  const isCategoryFullyExisting = (cat: TemplateCategory): boolean => {
    const catKey = cat.name.trim().toLowerCase();
    const hasCat = existingCategoryMap.has(catKey);
    if (!hasCat) return false;
    return cat.subcategories.every((sub) => isSubcategoryExisting(cat.name, sub.name));
  };

  const isCategoryPartiallyExisting = (cat: TemplateCategory): boolean => {
    const catKey = cat.name.trim().toLowerCase();
    const hasCat = existingCategoryMap.has(catKey);
    if (!hasCat) return false;
    const allExist = cat.subcategories.every((sub) => isSubcategoryExisting(cat.name, sub.name));
    return !allExist;
  };

  const handleToggleSubcategory = (catName: string, subName: string) => {
    if (isSubcategoryExisting(catName, subName)) return; // não pode marcar as que já existem
    const compositeKey = `${catName.trim().toLowerCase()}::${subName.trim().toLowerCase()}`;
    setSelectedSubcategories((prev) => {
      const next = new Set(prev);
      if (next.has(compositeKey)) {
        next.delete(compositeKey);
      } else {
        next.add(compositeKey);
      }
      return next;
    });
  };

  const handleToggleCategory = (cat: TemplateCategory) => {
    const catKey = cat.name.trim().toLowerCase();
    const selectableSubs = cat.subcategories.filter((s) => !isSubcategoryExisting(cat.name, s.name));
    if (selectableSubs.length === 0) return;

    const areAllSelected = selectableSubs.every((s) =>
      selectedSubcategories.has(`${catKey}::${s.name.trim().toLowerCase()}`)
    );

    setSelectedSubcategories((prev) => {
      const next = new Set(prev);
      selectableSubs.forEach((s) => {
        const key = `${catKey}::${s.name.trim().toLowerCase()}`;
        if (areAllSelected) {
          next.delete(key);
        } else {
          next.add(key);
        }
      });
      return next;
    });
  };

  const handleSelectAll = () => {
    const next = new Set<string>();
    CATEGORY_TEMPLATES.forEach((cat) => {
      const catKey = cat.name.trim().toLowerCase();
      cat.subcategories.forEach((sub) => {
        if (!isSubcategoryExisting(cat.name, sub.name)) {
          next.add(`${catKey}::${sub.name.trim().toLowerCase()}`);
        }
      });
    });
    setSelectedSubcategories(next);
  };

  const handleDeselectAll = () => {
    setSelectedSubcategories(new Set());
  };

  // Contadores
  const totalSubcategoriesCount = selectedSubcategories.size;
  const categoriesWithSelectedCount = useMemo(() => {
    const cats = new Set<string>();
    selectedSubcategories.forEach((key) => {
      const [catKey] = key.split('::');
      if (catKey) cats.add(catKey);
    });
    return cats.size;
  }, [selectedSubcategories]);

  const handleConfirmAdd = async () => {
    if (selectedSubcategories.size === 0 || !user) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const usedIds = collectAllExistingNumericIds(data);
      let currentCategories = [...(data.categories || [])];
      let currentSubcategories = [...(data.subcategories || [])];

      // Agrupa seleções por categoria
      for (const catTemplate of CATEGORY_TEMPLATES) {
        const catKey = catTemplate.name.trim().toLowerCase();
        const selectedSubsForCat = catTemplate.subcategories.filter((s) =>
          selectedSubcategories.has(`${catKey}::${s.name.trim().toLowerCase()}`)
        );

        if (selectedSubsForCat.length === 0) continue;

        // 1. Reutiliza categoria existente ou cria uma nova
        let targetCategory = currentCategories.find(
          (c) => c.name.trim().toLowerCase() === catKey
        );

        let targetCatId: number;
        if (targetCategory) {
          targetCatId = Number(targetCategory.id);
        } else {
          targetCatId = generateUniqueNumericId(usedIds);
          targetCategory = {
            id: targetCatId,
            name: catTemplate.name.trim(),
            archived: false,
            icon: catTemplate.icon,
          };
          currentCategories.push(targetCategory);
        }

        // 2. Cria as subcategorias selecionadas que não existam
        for (const subTemplate of selectedSubsForCat) {
          const subKey = subTemplate.name.trim().toLowerCase();
          const alreadyExists = currentSubcategories.some(
            (s) =>
              Number(s.category_id) === targetCatId &&
              s.name.trim().toLowerCase() === subKey
          );

          if (!alreadyExists) {
            const newSubId = generateUniqueNumericId(usedIds);
            currentSubcategories.push({
              id: newSubId,
              category_id: targetCatId,
              name: subTemplate.name.trim(),
              archived: false,
              icon: subTemplate.icon,
            });
          }
        }
      }

      // Gravação atômica em /users/{uid}
      await updateUserDocSafe(user.uid, {
        categories: currentCategories,
        subcategories: currentSubcategories,
      });

      onSuccessToast(`${totalSubcategoriesCount} subcategorias adicionadas!`);
      onClose();
    } catch (err: any) {
      console.error('[SuggestedCategoriesModal] Erro ao adicionar modelo:', err);
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
        className="w-full max-w-lg rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150 transition-colors flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#22A45D] dark:text-[#39D47A]" />
            <h2 className="text-[18px] font-bold text-[#111827] dark:text-[#F5F7F7]">
              Modelo Sugerido de Categorias
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] -mt-1">
          Selecione as categorias do modelo para adicionar ao seu aplicativo:
        </p>

        {/* Linha de contadores e botões Marcar/Desmarcar */}
        <div className="flex items-center justify-between text-xs py-1 px-1 border-y border-[#ECEFF1] dark:border-[#263233]">
          <span className="font-semibold text-[#111827] dark:text-[#F5F7F7]">
            {totalSubcategoriesCount} subcategorias em {categoriesWithSelectedCount} categorias
          </span>
          <div className="space-x-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="font-bold text-[#22A45D] dark:text-[#39D47A] hover:underline cursor-pointer"
            >
              Marcar todas
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="font-bold text-[#6B7280] dark:text-[#A9B1B1] hover:underline cursor-pointer"
            >
              Desmarcar todas
            </button>
          </div>
        </div>

        {errorMessage && (
          <p className="text-xs font-semibold text-[#EF4444] dark:text-[#FF4D55]">
            {errorMessage}
          </p>
        )}

        {/* Lista rolável */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          {CATEGORY_TEMPLATES.map((cat) => {
            const isExpanded = expandedCategories.has(cat.name);
            const fullyExists = isCategoryFullyExisting(cat);
            const partiallyExists = isCategoryPartiallyExisting(cat);

            const catKey = cat.name.trim().toLowerCase();
            const selectableSubs = cat.subcategories.filter(
              (s) => !isSubcategoryExisting(cat.name, s.name)
            );
            const selectedCountForCat = cat.subcategories.filter((s) =>
              selectedSubcategories.has(`${catKey}::${s.name.trim().toLowerCase()}`)
            ).length;

            const isAllCatSelected =
              selectableSubs.length > 0 &&
              selectableSubs.every((s) =>
                selectedSubcategories.has(`${catKey}::${s.name.trim().toLowerCase()}`)
              );

            return (
              <div
                key={cat.name}
                className="rounded-xl border border-[#ECEFF1] dark:border-[#263233] bg-[#FAFAFB] dark:bg-[#0D1315] overflow-hidden transition-colors"
              >
                {/* Linha da Categoria */}
                <div className="p-3 flex items-center justify-between gap-2 select-none">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Checkbox da Categoria */}
                    <button
                      type="button"
                      disabled={selectableSubs.length === 0}
                      onClick={() => handleToggleCategory(cat)}
                      className={`w-4.5 h-4.5 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
                        selectableSubs.length === 0
                          ? 'border-[#6B7280]/20 bg-black/5 dark:bg-white/5 cursor-not-allowed'
                          : isAllCatSelected
                          ? 'border-[#22A45D] dark:border-[#39D47A] bg-[#22A45D] dark:bg-[#39D47A] cursor-pointer'
                          : 'border-[#6B7280]/40 dark:border-[#A9B1B1]/40 bg-white dark:bg-[#172021] cursor-pointer'
                      }`}
                    >
                      {isAllCatSelected && (
                        <Check className="w-3 h-3 text-white dark:text-[#0D1214] stroke-[3]" />
                      )}
                    </button>

                    <span className="text-[13px] font-bold text-[#111827] dark:text-[#F5F7F7] truncate">
                      {cat.icon} {cat.name}
                    </span>

                    {/* Etiquetas */}
                    {fullyExists && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[#6B7280] dark:text-[#A9B1B1]">
                        Já existe
                      </span>
                    )}
                    {partiallyExists && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F59E0B]/15 text-[#D97706] dark:text-[#F59E0B]">
                        Existe em parte
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
                      {selectedCountForCat}/{cat.subcategories.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleExpand(cat.name)}
                      className="p-1 text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Subcategorias expandidas */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 space-y-1.5 border-t border-[#ECEFF1] dark:border-[#263233] bg-white dark:bg-[#172021]/50">
                    {cat.subcategories.map((sub) => {
                      const exists = isSubcategoryExisting(cat.name, sub.name);
                      const compositeKey = `${catKey}::${sub.name.trim().toLowerCase()}`;
                      const isSelected = selectedSubcategories.has(compositeKey);

                      return (
                        <div
                          key={sub.name}
                          onClick={() => !exists && handleToggleSubcategory(cat.name, sub.name)}
                          className={`flex items-center justify-between py-1 px-1.5 rounded-lg text-xs transition-colors ${
                            exists
                              ? 'opacity-50 cursor-not-allowed'
                              : 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div
                              className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 ${
                                exists
                                  ? 'border-[#6B7280]/20 bg-black/5 dark:bg-white/5'
                                  : isSelected
                                  ? 'border-[#22A45D] dark:border-[#39D47A] bg-[#22A45D] dark:bg-[#39D47A]'
                                  : 'border-[#6B7280]/40 dark:border-[#A9B1B1]/40'
                              }`}
                            >
                              {isSelected && !exists && (
                                <Check className="w-2.5 h-2.5 text-white dark:text-[#0D1214] stroke-[3]" />
                              )}
                            </div>
                            <span className="text-[#111827] dark:text-[#F5F7F7] truncate">
                              {sub.icon} {sub.name}
                            </span>
                          </div>

                          {exists && (
                            <span className="text-[10px] text-[#6B7280] dark:text-[#A9B1B1] italic">
                              Já existe
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Rodapé com botão de ação */}
        <div className="pt-2 border-t border-[#ECEFF1] dark:border-[#263233] flex items-center justify-end gap-2.5">
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
            onClick={handleConfirmAdd}
            disabled={totalSubcategoriesCount === 0 || isSaving}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              totalSubcategoriesCount === 0 || isSaving
                ? 'opacity-50 cursor-not-allowed bg-black/10 dark:bg-white/10 text-[#6B7280]'
                : 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] hover:brightness-105 active:scale-98'
            }`}
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Adicionar Selecionadas</span>
          </button>
        </div>
      </div>
    </div>
  );
};
