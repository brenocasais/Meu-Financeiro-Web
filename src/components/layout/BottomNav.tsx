import React from 'react';
import { Home, ArrowLeftRight, Layers, BarChart3, Target } from 'lucide-react';

export type TabType = 'home' | 'transactions' | 'planning' | 'metrics' | 'goals';

interface BottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'transactions', label: 'Transações', icon: ArrowLeftRight },
  { id: 'planning', label: 'Planejamento', icon: Layers },
  { id: 'metrics', label: 'Métricas', icon: BarChart3 },
  { id: 'goals', label: 'Metas', icon: Target },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  return (
    <nav
      id="bottom-navigation-bar"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF]/95 dark:bg-[#172021]/95 backdrop-blur-md border-t border-[#E5E7EB] dark:border-[#222E30] transition-colors"
      aria-label="Navegação Principal"
    >
      <div className="max-w-2xl mx-auto px-2 flex items-center justify-around h-16 pb-safe">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'text-[#22A45D] dark:text-[#39D47A]'
                  : 'text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7]'
              }`}
            >
              <div className={`relative p-1 rounded-full transition-transform ${isActive ? 'scale-110' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={`text-[11px] tracking-tight truncate mt-0.5 ${
                  isActive ? 'font-semibold' : 'font-normal'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
