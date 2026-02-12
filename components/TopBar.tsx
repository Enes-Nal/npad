
import React from 'react';
import { Share2, MoreHorizontal, FileText, ChevronRight, Download, Eye, Edit3, Settings, PenLine, Code2, LayoutTemplate, Save } from 'lucide-react';
import type { EditorMode } from '../types';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface TopBarProps {
  title: string;
  onTitleChange: (val: string) => void;
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode) => void;
  activeTab: 'editor' | 'preview';
  onTabChange: (tab: 'editor' | 'preview') => void;
  activeView: string;
  breadcrumbs: BreadcrumbItem[];
  statusLabel: string;
  onExportClick: () => void;
  onShareClick: () => void;
  onSettingsClick: () => void;
  onOpenTemplates: () => void;
  onSaveTemplateClick: () => void;
  hasActiveDocument: boolean;
}

const TopBar: React.FC<TopBarProps> = ({ 
  title,
  onTitleChange,
  editorMode,
  onEditorModeChange,
  activeTab,
  onTabChange,
  activeView,
  breadcrumbs,
  statusLabel,
  onExportClick,
  onShareClick,
  onSettingsClick,
  onOpenTemplates,
  onSaveTemplateClick,
  hasActiveDocument,
}) => {
  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 sticky top-0 z-20">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 whitespace-nowrap overflow-x-auto">
          <FileText size={16} className="text-blue-500" />
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const isClickable = Boolean(crumb.onClick) && !isLast;
            return (
              <React.Fragment key={`${crumb.label}-${index}`}>
                {index > 0 ? <ChevronRight size={14} className="text-gray-300" /> : null}
                {isLast && activeView === 'editor' && hasActiveDocument ? (
                  <input
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    className="font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-50/50 rounded px-1 min-w-[120px]"
                  />
                ) : isClickable ? (
                  <button
                    type="button"
                    onClick={crumb.onClick}
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className={`${isLast ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
        
        {activeView === 'editor' && (
          <div className="flex items-center gap-4 h-full pt-0.5">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 border border-gray-200">
              <button
                onClick={() => onEditorModeChange('rich')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${editorMode === 'rich' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <PenLine size={13} />
                Write
              </button>
              <button
                onClick={() => onEditorModeChange('code')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${editorMode === 'code' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <Code2 size={13} />
                Code
              </button>
            </div>
            <button 
              onClick={() => onTabChange('editor')}
              className={`h-13 border-b-2 px-2 py-4 text-sm font-semibold flex items-center gap-1.5 transition-all ${activeTab === 'editor' ? 'border-black text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              <Edit3 size={14} />
              Editor
            </button>
            <button 
              onClick={() => onTabChange('preview')}
              className={`h-13 border-b-2 px-2 py-4 text-sm font-semibold flex items-center gap-1.5 transition-all ${activeTab === 'preview' ? 'border-black text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              <Eye size={14} />
              Preview
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-600 rounded text-[10px] font-bold uppercase tracking-wider">
          {statusLabel}
        </div>

        <div className="h-6 w-px bg-gray-200 mx-2"></div>

        <div className="flex items-center gap-2 text-gray-500">
            <button 
                onClick={onShareClick}
                className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-100 rounded-md transition-colors text-sm font-medium active:scale-95"
            >
                <Share2 size={14} />
                Share
            </button>
            <button 
                onClick={onExportClick}
                className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-100 rounded-md transition-colors text-sm font-medium active:scale-95"
            >
                <Download size={14} />
                Export
            </button>
            <button
                onClick={onOpenTemplates}
                className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-100 rounded-md transition-colors text-sm font-medium active:scale-95"
            >
                <LayoutTemplate size={14} />
                Templates
            </button>
            <button
                onClick={onSaveTemplateClick}
                disabled={!hasActiveDocument}
                className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-100 rounded-md transition-colors text-sm font-medium active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <Save size={14} />
                Save Template
            </button>
            <button 
                onClick={onSettingsClick}
                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors active:scale-95"
            >
                <Settings size={18} />
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
                <MoreHorizontal size={18} />
            </button>
        </div>

      </div>
    </header>
  );
};

export default TopBar;
