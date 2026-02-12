import React, { useMemo, useState } from 'react';
import { Plus, FileText, Globe, Shield, X } from 'lucide-react';
import type { DocumentMetadata, DocumentTag } from '../types';

const TAG_STYLES: Record<DocumentTag['color'], { dot: string; pill: string }> = {
  blue: { dot: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700 border-blue-100' },
  orange: { dot: 'bg-orange-500', pill: 'bg-orange-50 text-orange-700 border-orange-100' },
  purple: { dot: 'bg-purple-500', pill: 'bg-purple-50 text-purple-700 border-purple-100' },
  red: { dot: 'bg-red-500', pill: 'bg-red-50 text-red-700 border-red-100' },
  gray: { dot: 'bg-gray-500', pill: 'bg-gray-50 text-gray-700 border-gray-200' },
  green: { dot: 'bg-green-500', pill: 'bg-green-50 text-green-700 border-green-100' },
};

const SettingsSection: React.FC<{ title: string; children: React.ReactNode; extra?: React.ReactNode }> = ({ title, children, extra }) => (
  <div className="py-6 border-b border-gray-100 last:border-0">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      {extra}
    </div>
    {children}
  </div>
);

interface RightPanelProps {
  doc: DocumentMetadata;
  primaryStatLabel: string;
  primaryStatValue: number;
  secondaryStatLabel: string;
  secondaryStatValue: number;
  onAddTag: (tag: Omit<DocumentTag, 'id'>) => void;
  onRemoveTag: (tagId: string) => void;
  onSetPublicVisibility: (enabled: boolean) => void;
  onSetTeamAccess: (enabled: boolean) => void;
  onRequestReview: () => void;
}

const RightPanel: React.FC<RightPanelProps> = ({
  doc,
  primaryStatLabel,
  primaryStatValue,
  secondaryStatLabel,
  secondaryStatValue,
  onAddTag,
  onRemoveTag,
  onSetPublicVisibility,
  onSetTeamAccess,
  onRequestReview,
}) => {
  const [showTagsMenu, setShowTagsMenu] = useState(false);

  const availableTags = useMemo(
    () => [
      { label: 'Review', color: 'red' as const },
      { label: 'Archived', color: 'gray' as const },
      { label: 'Public', color: 'green' as const },
    ].filter((tag) => !doc.tags.some((docTag) => docTag.label.toLowerCase() === tag.label.toLowerCase())),
    [doc.tags],
  );

  return (
    <aside className="w-80 border-l border-gray-200 bg-white h-screen flex flex-col overflow-y-auto hidden xl:flex">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 border border-blue-100">
            <FileText size={16} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Doc Properties</h2>
            <p className="text-xs text-gray-400">Manage metadata</p>
          </div>
        </div>

        <SettingsSection title="Statistics">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{primaryStatLabel}</p>
              <p className="text-lg font-semibold text-gray-900">{primaryStatValue}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{secondaryStatLabel}</p>
              <p className="text-lg font-semibold text-gray-900">{secondaryStatValue}</p>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Tags"
          extra={(
            <div className="relative">
              <button
                onClick={() => setShowTagsMenu(!showTagsMenu)}
                className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-900 transition-colors"
              >
                <Plus size={14} />
              </button>
              {showTagsMenu && (
                <div className="absolute top-6 right-0 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2">
                  <div className="px-2 py-1.5 border-b border-gray-50 mb-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Available Tags</span>
                  </div>
                  {availableTags.length === 0 && <p className="px-2 py-1 text-xs text-gray-400">No more tags to add.</p>}
                  {availableTags.map((tag) => (
                    <button
                      key={tag.label}
                      onClick={() => {
                        onAddTag(tag);
                        setShowTagsMenu(false);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full ${TAG_STYLES[tag.color].dot}`}></div>
                      {tag.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        >
          <div className="flex flex-wrap gap-2">
            {doc.tags.map((tag) => (
              <span key={tag.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${TAG_STYLES[tag.color].pill}`}>
                {tag.label}
                <button onClick={() => onRemoveTag(tag.id)} className="hover:opacity-80">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title="Permissions">
          <div className="space-y-3">
            <button
              onClick={() => onSetPublicVisibility(!doc.publicVisibility)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-gray-400" />
                <span className="text-sm text-gray-700">Public visibility</span>
              </div>
              <div className={`w-8 h-4 rounded-full relative cursor-pointer ${doc.publicVisibility ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${doc.publicVisibility ? 'right-0.5' : 'left-0.5'}`}></div>
              </div>
            </button>
            <button
              onClick={() => onSetTeamAccess(!doc.teamAccess)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-gray-400" />
                <span className="text-sm text-gray-700">Team access</span>
              </div>
              <div className={`w-8 h-4 rounded-full relative cursor-pointer ${doc.teamAccess ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${doc.teamAccess ? 'right-0.5' : 'left-0.5'}`}></div>
              </div>
            </button>
          </div>
        </SettingsSection>

        <SettingsSection title="Activity">
          <div className="space-y-4">
            {doc.activity.map((event) => (
              <div key={event.id} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">{event.actor[0]}</div>
                <div>
                  <p className="text-xs font-bold text-gray-900">{event.actor} {event.action}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">{event.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </SettingsSection>
      </div>

      <div className="mt-auto p-6 border-t border-gray-100">
        <button onClick={onRequestReview} className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors shadow-lg shadow-black/5 active:scale-95">
          Request Review
        </button>
      </div>
    </aside>
  );
};

export default RightPanel;
