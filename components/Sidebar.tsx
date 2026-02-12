
import React from 'react';
import { 
  Search, FileText, Star, Clock, Trash2, 
  Plus, Settings, Folder, Command, 
  ChevronDown, Archive, ChevronLeft, ChevronRight
} from 'lucide-react';

const SidebarItem: React.FC<{ 
  icon: React.ReactNode, 
  label: string, 
  badge?: string, 
  active?: boolean, 
  isCollapsed?: boolean,
  onClick?: () => void 
}> = ({ icon, label, badge, active, isCollapsed, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex items-center px-3 py-1.5 rounded-lg cursor-pointer transition-all ${active ? 'bg-gray-100 shadow-sm' : 'hover:bg-gray-50'} ${isCollapsed ? 'justify-center px-0' : 'justify-between'}`}
  >
    <div className={`flex items-center ${isCollapsed ? '' : 'gap-2.5'}`}>
      <span className={`${active ? 'text-gray-900' : 'text-gray-500'}`}>{icon}</span>
      {!isCollapsed && <span className={`text-sm font-medium ${active ? 'text-gray-900' : 'text-gray-600'}`}>{label}</span>}
    </div>
    {!isCollapsed && badge && (
      <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{badge}</span>
    )}
  </div>
);

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  activeView: string;
  workspaceName?: string;
  collections?: string[];
  activeCollection?: string | null;
  onViewChange: (view: 'editor' | 'drafts' | 'recent' | 'starred' | 'archived' | 'trash' | 'collection') => void;
  onCreateDraftClick?: () => void;
  onCollectionSelect?: (name: string) => void;
  onCreateCollectionClick?: () => void;
  onWorkspaceClick: (e: React.MouseEvent) => void;
  onQuickActionsClick: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isCollapsed, 
  setIsCollapsed, 
  activeView, 
  workspaceName = 'Workspace',
  collections = [],
  activeCollection = null,
  onViewChange, 
  onCreateDraftClick,
  onCollectionSelect,
  onCreateCollectionClick,
  onWorkspaceClick, 
  onQuickActionsClick 
}) => {
  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-64'} flex-shrink-0 border-r border-gray-200 bg-white h-screen flex flex-col transition-all duration-300 relative group`}>
      <div className="p-4 flex items-center justify-between overflow-hidden">
        {!isCollapsed && (
          <div
            onClick={onWorkspaceClick}
            className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors active:scale-95 whitespace-nowrap"
          >
            <img src="/npad-logo.png" alt="NPad logo" className="w-6 h-6 rounded object-cover" />
            <span className="text-sm font-semibold">{workspaceName}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </div>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1.5 hover:bg-gray-100 rounded-md transition-colors border border-transparent hover:border-gray-200 flex items-center justify-center ${isCollapsed ? 'w-full' : ''}`}
        >
           {isCollapsed ? <ChevronRight size={16} className="text-gray-500" /> : <ChevronLeft size={16} className="text-gray-500" />}
        </button>
      </div>

      <div className="px-3 mb-4">
        <button 
          onClick={onQuickActionsClick}
          className={`w-full flex items-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-all shadow-sm active:scale-[0.98] ${isCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-1.5'}`}
        >
          <div className="flex items-center gap-2">
            <Search size={14} />
            {!isCollapsed && <span className="text-xs font-medium">Search</span>}
          </div>
          {!isCollapsed && (
            <div className="flex items-center gap-1 opacity-50">
              <Command size={10} />
              <span className="text-[10px]">K</span>
            </div>
          )}
        </button>
      </div>

      <nav className={`flex-1 px-3 space-y-1 overflow-y-auto ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
        <SidebarItem isCollapsed={isCollapsed} onClick={() => onViewChange('recent')} icon={<Clock size={18} />} label="Recent" active={activeView === 'recent'} />
        <SidebarItem isCollapsed={isCollapsed} onClick={() => onViewChange('starred')} icon={<Star size={18} />} label="Starred" active={activeView === 'starred'} />
        {isCollapsed ? (
          <SidebarItem isCollapsed onClick={() => onViewChange('drafts')} icon={<FileText size={18} />} label="All drafts" active={activeView === 'drafts'} />
        ) : (
          <div className={`flex items-center px-3 py-1.5 rounded-lg transition-all ${activeView === 'drafts' ? 'bg-gray-100 shadow-sm' : 'hover:bg-gray-50'}`}>
            <button
              type="button"
              onClick={() => onViewChange('drafts')}
              className="flex-1 flex items-center gap-2.5 text-left"
            >
              <span className={`${activeView === 'drafts' ? 'text-gray-900' : 'text-gray-500'}`}>
                <FileText size={18} />
              </span>
              <span className={`text-sm font-medium ${activeView === 'drafts' ? 'text-gray-900' : 'text-gray-600'}`}>All drafts</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateDraftClick?.();
              }}
              aria-label="Create new draft"
              className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 transition-colors"
            >
              <Plus size={13} />
            </button>
          </div>
        )}
        <SidebarItem isCollapsed={isCollapsed} onClick={() => onViewChange('archived')} icon={<Archive size={18} />} label="Archived" active={activeView === 'archived'} />
        <SidebarItem isCollapsed={isCollapsed} onClick={() => onViewChange('trash')} icon={<Trash2 size={18} />} label="Trash" active={activeView === 'trash'} />
        
        <div className={`pt-4 pb-1 ${isCollapsed ? 'w-full flex flex-col items-center' : ''}`}>
          {!isCollapsed && (
            <div className="px-3 py-1 flex items-center justify-between group">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Collections</span>
              <button onClick={onCreateCollectionClick} aria-label="Create collection">
                <Plus size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 cursor-pointer" />
              </button>
            </div>
          )}
          {collections.map((collection) => (
            <SidebarItem
              key={collection}
              isCollapsed={isCollapsed}
              onClick={() => onCollectionSelect?.(collection)}
              icon={<Folder size={18} className="text-blue-400" />}
              label={collection}
              active={activeView === 'collection' && activeCollection === collection}
            />
          ))}
          {collections.length === 0 && !isCollapsed && (
            <p className="px-3 py-1.5 text-xs text-gray-400">No collections yet</p>
          )}
        </div>
      </nav>

      <div className="mt-auto p-4 border-t border-gray-100">
         <SidebarItem isCollapsed={isCollapsed} icon={<Settings size={18} />} label="Workspace Settings" />
      </div>
    </aside>
  );
};

export default Sidebar;
