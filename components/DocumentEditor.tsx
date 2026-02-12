import React, { useRef } from 'react';
import { Bold, Italic, List, Heading1, Heading2, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import MergeTag from './MergeTag';

interface DocumentEditorProps {
  content: string;
  setContent: (val: string) => void;
  darkMode: boolean;
  typographyClassName?: string;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({ content, setContent, darkMode, typographyClassName = 'font-inter text-lg leading-8' }) => {
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = (prefix: string, suffix = prefix) => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    const next = `${content.slice(0, start)}${prefix}${selected}${suffix}${content.slice(end)}`;
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  };

  const insertLinePrefix = (prefix: string) => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const next = `${content.slice(0, lineStart)}${prefix}${content.slice(lineStart)}`;
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + prefix.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className={`flex-1 overflow-y-auto flex flex-col relative group ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
      <div className={`sticky top-6 left-1/2 -translate-x-1/2 rounded-lg shadow-xl px-2 py-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 scale-95 group-hover:scale-100 w-fit mx-auto h-fit ${
        darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        <ToolbarButton icon={<Heading1 size={14} />} onClick={() => insertLinePrefix('# ')} darkMode={darkMode} />
        <ToolbarButton icon={<Heading2 size={14} />} onClick={() => insertLinePrefix('## ')} darkMode={darkMode} />
        <div className={`w-px h-4 mx-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
        <ToolbarButton icon={<Bold size={14} />} onClick={() => wrapSelection('**')} darkMode={darkMode} />
        <ToolbarButton icon={<Italic size={14} />} onClick={() => wrapSelection('_')} darkMode={darkMode} />
        <ToolbarButton icon={<LinkIcon size={14} />} onClick={() => wrapSelection('[', ']()')} darkMode={darkMode} />
        <div className={`w-px h-4 mx-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
        <ToolbarButton icon={<List size={14} />} onClick={() => insertLinePrefix('- ')} darkMode={darkMode} />
        <ToolbarButton icon={<ImageIcon size={14} />} onClick={() => insertLinePrefix('![]()')} darkMode={darkMode} />
      </div>

      <div className="flex-1 w-full max-w-4xl mx-auto px-12 pb-24 pt-4">
        <textarea
          ref={editorRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={`w-full h-full min-h-[60vh] bg-transparent border-none focus:ring-0 focus:outline-none outline-none ring-0 resize-none font-normal ${typographyClassName} ${
            darkMode ? 'text-gray-100' : 'text-gray-800'
          }`}
        />

        <div className={`mt-12 pt-8 border-t ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Merge Variables</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <MergeTag label="date > today" type="person" />
            <MergeTag label="company > name" type="company" />
            <MergeTag label="author > name" type="person" />
            <MergeTag label="document > version" type="company" />
          </div>
        </div>
      </div>
    </div>
  );
};

const ToolbarButton: React.FC<{ icon: React.ReactNode; onClick: () => void; darkMode: boolean }> = ({ icon, onClick, darkMode }) => (
  <button
    onClick={onClick}
    className={`p-1.5 rounded transition-all active:scale-95 ${
      darkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-100' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
    }`}
  >
    {icon}
  </button>
);

export default DocumentEditor;
