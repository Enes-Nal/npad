import React, { useEffect, useRef, useState } from 'react';
import { FileText, MoreHorizontal, ArrowLeft, Star, Trash2, Archive, Folder, Clock } from 'lucide-react';
import type { DocumentMetadata } from '../types';

interface ListViewProps {
  type: string;
  documents: DocumentMetadata[];
  collections: string[];
  onBack: () => void;
  onOpenDocument: (id: string) => void;
  onArchiveDocument: (id: string) => void;
  onDeleteDocument: (id: string) => void;
  onMoveDocument: (id: string, targetCollection: string) => void;
}

const ListView: React.FC<ListViewProps> = ({
  type,
  documents,
  collections,
  onBack,
  onOpenDocument,
  onArchiveDocument,
  onDeleteDocument,
  onMoveDocument,
}) => {
  const isRecentView = type === 'recent';
  const [openMenuDocumentId, setOpenMenuDocumentId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuDocumentId) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      const target = event.target as Node;
      if (!menuRef.current.contains(target)) {
        setOpenMenuDocumentId(null);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuDocumentId]);

  const extractPreviewLines = (doc: DocumentMetadata) => {
    const source = doc.content
      .replace(/^#\s+/gm, '')
      .replace(/[`*_>#\-]+/g, '')
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .trim();

    const fallback = source.length > 0 ? source : `${doc.title}\n\nOpen this note to continue writing.`;

    return fallback
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 7);
  };

  const getHeaderInfo = () => {
    switch (type) {
      case 'starred':
        return { icon: <Star size={24} className="text-yellow-500" />, title: 'Starred Documents' };
      case 'recent':
        return { icon: <Clock size={24} className="text-blue-500" />, title: 'Recent' };
      case 'trash':
        return { icon: <Trash2 size={24} className="text-red-500" />, title: 'Trash' };
      case 'archived':
        return { icon: <Archive size={24} className="text-gray-500" />, title: 'Archived' };
      default:
        return type === 'editor'
          ? { icon: <FileText size={24} className="text-blue-500" />, title: 'Documents' }
          : { icon: <Folder size={24} className="text-blue-500" />, title: type };
    }
  };

  const { icon, title } = getHeaderInfo();

  const renderDocumentMenu = (doc: DocumentMetadata, positionClassName: string) => (
    <div className={`relative ${positionClassName}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpenMenuDocumentId((prev) => (prev === doc.id ? null : doc.id));
        }}
        className="p-1 hover:bg-white border border-transparent hover:border-gray-200 rounded-md transition-all opacity-0 group-hover:opacity-100"
      >
        <MoreHorizontal size={14} className="text-gray-400" />
      </button>
      {openMenuDocumentId === doc.id ? (
        <div
          ref={menuRef}
          className="absolute right-0 top-8 z-20 min-w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onArchiveDocument(doc.id);
              setOpenMenuDocumentId(null);
            }}
            className="w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50"
          >
            Archive
          </button>
          <button
            onClick={() => {
              onDeleteDocument(doc.id);
              setOpenMenuDocumentId(null);
            }}
            className="w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
          <div className="my-1 border-t border-gray-100" />
          <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Move to Collection
          </div>
          {collections
            .filter((collection) => collection !== doc.collection)
            .map((collection) => (
              <button
                key={`${doc.id}-${collection}`}
                onClick={() => {
                  onMoveDocument(doc.id, collection);
                  setOpenMenuDocumentId(null);
                }}
                className="w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50"
              >
                {collection}
              </button>
            ))}
          {collections.filter((collection) => collection !== doc.collection).length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">No other collections</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex-1 bg-[#f9fafb] p-12 overflow-y-auto">
      <div className={`${isRecentView ? 'max-w-6xl' : 'max-w-4xl'} mx-auto`}>
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Editor
        </button>

        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
            {icon}
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        </div>

        {isRecentView ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {documents.map((doc) => {
              const previewLines = extractPreviewLines(doc);
              const cardAccent = doc.editorMode === 'code' ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white';

              return (
                <div
                  key={doc.id}
                  className="group cursor-pointer"
                  onClick={() => onOpenDocument(doc.id)}
                >
                  <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
                    <div className={`h-44 border-b px-4 py-3 ${cardAccent}`}>
                      <div className="h-full rounded-md border border-gray-200 bg-white p-3 overflow-hidden">
                        <div className="space-y-1.5">
                          {previewLines.map((line, index) => (
                            <p
                              key={`${doc.id}-preview-${index}`}
                              className={`${doc.editorMode === 'code' ? 'font-mono text-[10px]' : 'text-[11px]'} text-gray-600 leading-tight truncate`}
                            >
                              {line}
                            </p>
                          ))}
                          {previewLines.length < 7 &&
                            Array.from({ length: 7 - previewLines.length }).map((_, idx) => (
                              <div
                                key={`${doc.id}-skeleton-${idx}`}
                                className="h-2 rounded bg-gray-100"
                                style={{ width: `${75 - idx * 6}%` }}
                              />
                            ))}
                        </div>
                      </div>
                    </div>

                    <div className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600 transition-colors">{doc.title}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs text-gray-500 truncate">{doc.updatedAt}</p>
                        <div className="flex items-center gap-1.5 shrink-0 ml-3">
                          {renderDocumentMenu(doc, '')}
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600">
                            {doc.owner[0]}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : documents.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-visible">
            <div className="grid grid-cols-12 px-6 py-3 border-b border-gray-100 bg-gray-50/50">
              <div className="col-span-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Name</div>
              <div className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Last Modified</div>
              <div className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Owner</div>
              <div className="col-span-1"></div>
            </div>

            <div className="divide-y divide-gray-50">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="grid grid-cols-12 px-6 py-4 items-center hover:bg-gray-50 transition-colors cursor-pointer group"
                  onClick={() => onOpenDocument(doc.id)}
                >
                  <div className="col-span-6 flex items-center gap-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <FileText size={16} className="text-blue-500" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">{doc.title}</span>
                  </div>
                  <div className="col-span-3 text-sm text-gray-500 text-center">{doc.updatedAt}</div>
                  <div className="col-span-2 flex justify-center">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600">
                      {doc.owner[0]}
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {renderDocumentMenu(doc, '')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {documents.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText size={24} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-500 font-medium">No documents found in this view.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListView;
