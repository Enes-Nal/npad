import React, { useEffect, useMemo, useRef, useState } from 'react';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditorNs } from 'monaco-editor';
import { Braces, Check, ChevronDown, Code2, Eraser, Play, ZoomIn, ZoomOut } from 'lucide-react';
import type { CodeLanguage } from '../types';

interface CodeEditorProps {
  content: string;
  setContent: (val: string) => void;
  language: CodeLanguage;
  onLanguageChange: (lang: CodeLanguage) => void;
  darkMode: boolean;
  onRun: () => void;
  onClearOutput: () => void;
  terminalStatus: 'idle' | 'running' | 'success' | 'error';
  terminalOutput: string;
  terminalTimestamp: string;
}

const STARTER_SNIPPETS: Record<CodeLanguage, string> = {
  plaintext: 'Notes:\n- Requirements\n- Decisions\n',
  javascript: "function greet(name) {\n  return `Hello, ${name}`;\n}\n\nconsole.log(greet('world'));\n",
  typescript: "type User = {\n  id: string;\n  name: string;\n};\n\nconst user: User = { id: '1', name: 'Nal' };\nconsole.log(user);\n",
  python: "def greet(name: str) -> str:\n    return f'Hello, {name}'\n\nprint(greet('world'))\n",
  json: '{\n  "name": "notepad",\n  "version": 1\n}\n',
  html: '<!doctype html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n    <title>Code Notepad</title>\n  </head>\n  <body>\n    <h1>Hello</h1>\n  </body>\n</html>\n',
  css: ':root {\n  --accent: #2563eb;\n}\n\nbody {\n  font-family: system-ui, sans-serif;\n  color: #111827;\n}\n',
  markdown: '# Code Notes\n\n```ts\nconst value = 42;\n```\n',
  bash: '#!/usr/bin/env bash\nset -euo pipefail\n\necho "hello"\n',
  mips: '.data\nmessage: .asciiz "Hello, world!\\n"\n\n.text\n.globl main\nmain:\n  li $v0, 4\n  la $a0, message\n  syscall\n\n  li $v0, 10\n  syscall\n',
};

const LABELS: Record<CodeLanguage, string> = {
  plaintext: 'Plain text',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  json: 'JSON',
  html: 'HTML',
  css: 'CSS',
  markdown: 'Markdown',
  bash: 'Bash',
  mips: 'MIPS',
};

const LANGUAGE_OPTIONS = Object.entries(LABELS) as [CodeLanguage, string][];

const FONT_SIZE_STORAGE_KEY = 'npad-code-font-size-v1';
const MIN_FONT_SIZE = 11;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 14;
const NPAD_THEME_DARK = 'npad-vibrant-dark';
const NPAD_THEME_LIGHT = 'npad-vibrant-light';

type Monaco = Parameters<OnMount>[1];

const defineNpadThemes = (monaco: Monaco) => {
  monaco.editor.defineTheme(NPAD_THEME_DARK, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6EE7B7' },
      { token: 'keyword', foreground: 'FF7AB2' },
      { token: 'keyword.control', foreground: 'FF7AB2' },
      { token: 'type', foreground: 'C4B5FD' },
      { token: 'type.identifier', foreground: 'C4B5FD' },
      { token: 'string', foreground: '86EFAC' },
      { token: 'string.escape', foreground: 'FDE68A' },
      { token: 'number', foreground: '93C5FD' },
      { token: 'regexp', foreground: 'FDE68A' },
      { token: 'variable', foreground: 'BFDBFE' },
      { token: 'identifier', foreground: 'E5E7EB' },
      { token: 'function', foreground: 'FCA5A5' },
      { token: 'delimiter', foreground: '93A4C3' },
    ],
    colors: {
      'editor.background': '#0B1220',
      'editor.foreground': '#E6EDF7',
      'editorLineNumber.foreground': '#5B6B85',
      'editorLineNumber.activeForeground': '#9FB3D9',
      'editorCursor.foreground': '#F59E0B',
      'editor.selectionBackground': '#1D4ED899',
      'editor.inactiveSelectionBackground': '#1D4ED855',
      'editor.lineHighlightBackground': '#172237',
      'editorIndentGuide.background1': '#24334F',
      'editorIndentGuide.activeBackground1': '#4368B5',
      'editorSuggestWidget.background': '#0F172A',
      'editorSuggestWidget.selectedBackground': '#1E3A8A',
      'editorWidget.background': '#0F172A',
    },
  });

  monaco.editor.defineTheme(NPAD_THEME_LIGHT, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '0E7490' },
      { token: 'keyword', foreground: 'C026D3' },
      { token: 'keyword.control', foreground: 'C026D3' },
      { token: 'type', foreground: '7C3AED' },
      { token: 'type.identifier', foreground: '7C3AED' },
      { token: 'string', foreground: '059669' },
      { token: 'string.escape', foreground: 'D97706' },
      { token: 'number', foreground: '2563EB' },
      { token: 'regexp', foreground: 'D97706' },
      { token: 'variable', foreground: '1D4ED8' },
      { token: 'identifier', foreground: '111827' },
      { token: 'function', foreground: 'EA580C' },
      { token: 'delimiter', foreground: '64748B' },
    ],
    colors: {
      'editor.background': '#F8FAFC',
      'editor.foreground': '#0F172A',
      'editorLineNumber.foreground': '#94A3B8',
      'editorLineNumber.activeForeground': '#334155',
      'editorCursor.foreground': '#D97706',
      'editor.selectionBackground': '#BFDBFEAA',
      'editor.inactiveSelectionBackground': '#BFDBFE66',
      'editor.lineHighlightBackground': '#E2E8F0',
      'editorIndentGuide.background1': '#CBD5E1',
      'editorIndentGuide.activeBackground1': '#60A5FA',
      'editorSuggestWidget.background': '#FFFFFF',
      'editorSuggestWidget.selectedBackground': '#DBEAFE',
      'editorWidget.background': '#FFFFFF',
    },
  });
};

const toMonacoLanguage = (language: CodeLanguage): string => {
  if (language === 'bash') return 'shell';
  if (language === 'mips') return 'mips';
  return language;
};

const CodeEditor: React.FC<CodeEditorProps> = ({
  content,
  setContent,
  language,
  onLanguageChange,
  darkMode,
  onRun,
  onClearOutput,
  terminalStatus,
  terminalOutput,
  terminalTimestamp,
}) => {
  const monacoEditorRef = useRef<MonacoEditorNs.IStandaloneCodeEditor | null>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const onRunRef = useRef(onRun);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    const parsed = Number(saved);
    if (Number.isFinite(parsed)) {
      return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, parsed));
    }
    return DEFAULT_FONT_SIZE;
  });

  const lineCount = useMemo(() => Math.max(1, content.split('\n').length), [content]);

  const applyStarter = () => {
    setContent(STARTER_SNIPPETS[language]);
  };

  const onLanguageSelect = (lang: CodeLanguage) => {
    onLanguageChange(lang);
    setContent(STARTER_SNIPPETS[lang]);
  };

  const clearEditor = () => {
    setContent('');
    monacoEditorRef.current?.focus();
  };

  const updateZoom = (delta: number) => {
    setFontSize((prev) => {
      const bounded = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, prev + delta));
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(bounded));
      monacoEditorRef.current?.updateOptions({ fontSize: bounded });
      return bounded;
    });
  };

  const onZoomIn = () => updateZoom(1);
  const onZoomOut = () => updateZoom(-1);
  const isRunning = terminalStatus === 'running';

  const terminalTone = terminalStatus === 'error'
    ? 'text-red-400'
    : terminalStatus === 'success'
      ? 'text-emerald-400'
      : terminalStatus === 'running'
        ? 'text-amber-400'
        : darkMode ? 'text-gray-400' : 'text-gray-500';

  const terminalStatusLabel = terminalStatus === 'error'
    ? 'Error'
    : terminalStatus === 'success'
      ? 'Completed'
      : terminalStatus === 'running'
        ? 'Running'
        : 'Idle';

  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  const onBeforeMount = (monaco: Monaco) => {
    defineNpadThemes(monaco);
  };

  const onMount: OnMount = (editor, monaco) => {
    monacoEditorRef.current = editor;
    editor.updateOptions({ fontSize });

    if (!monaco.languages.getLanguages().some((lang) => lang.id === 'mips')) {
      monaco.languages.register({ id: 'mips' });
      monaco.languages.setMonarchTokensProvider('mips', {
        tokenizer: {
          root: [
            [/#.*$/, 'comment'],
            [/\.(?:data|text|globl|word|byte|half|asciiz|ascii|space|align)\b/, 'keyword'],
            [/\b(?:add|addi|addu|sub|subu|mul|div|divu|mfhi|mflo|and|andi|or|ori|xor|xori|nor|sll|srl|sra|slt|slti|sltiu|lw|sw|lb|lbu|sb|lh|lhu|sh|la|li|lui|move|beq|bne|blt|ble|bgt|bge|j|jal|jr|syscall)\b/, 'keyword'],
            [/\$(?:zero|at|v[01]|a[0-3]|t[0-9]|s[0-7]|k[01]|gp|sp|fp|ra|\d+)\b/, 'variable'],
            [/-?(?:0x[0-9a-fA-F]+|\d+)/, 'number'],
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
            [/[A-Za-z_.$][\w.$]*:/, 'type.identifier'],
            [/[A-Za-z_.$][\w.$]*/, 'identifier'],
            [/[,:()]/, 'delimiter'],
          ],
          string: [
            [/[^\\"]+/, 'string'],
            [/\\./, 'string.escape'],
            [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
          ],
        },
      });
      monaco.languages.setLanguageConfiguration('mips', {
        comments: { lineComment: '#' },
        brackets: [['(', ')']],
        autoClosingPairs: [{ open: '"', close: '"' }, { open: '(', close: ')' }],
      });
    }

    editor.addAction({
      id: 'npad.zoom-in',
      label: 'Zoom In',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal, monaco.KeyMod.CtrlCmd | monaco.KeyCode.NumpadAdd],
      run: () => {
        updateZoom(1);
      },
    });

    editor.addAction({
      id: 'npad.zoom-out',
      label: 'Zoom Out',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus, monaco.KeyMod.CtrlCmd | monaco.KeyCode.NumpadSubtract],
      run: () => {
        updateZoom(-1);
      },
    });

    editor.addAction({
      id: 'npad.run-code',
      label: 'Run Code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        onRunRef.current();
      },
    });
  };

  useEffect(() => {
    if (!isLanguageMenuOpen) return;

    const onDocumentPointerDown = (event: MouseEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
    };

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLanguageMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocumentPointerDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentPointerDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [isLanguageMenuOpen]);

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
      <div className={`h-12 border-b px-4 flex items-center justify-between gap-3 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className={`flex items-center gap-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          <Code2 size={16} className="text-blue-500" />
          <span className="font-medium">Code Notepad</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={languageMenuRef}>
            <button
              type="button"
              onClick={() => setIsLanguageMenuOpen((prev) => !prev)}
              className={`h-8 min-w-36 px-2.5 inline-flex items-center justify-between gap-2 border rounded-md text-sm ${
                darkMode
                  ? 'border-gray-700 text-gray-200 bg-gray-800 hover:bg-gray-700'
                  : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
              }`}
              aria-label="Language"
              aria-haspopup="listbox"
              aria-expanded={isLanguageMenuOpen}
            >
              <span>{LABELS[language]}</span>
              <ChevronDown size={14} className={isLanguageMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {isLanguageMenuOpen && (
              <div className={`absolute right-0 top-full mt-1 z-20 w-44 overflow-hidden rounded-md border shadow-lg ${
                darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
              }`}>
                <ul className="py-1" role="listbox" aria-label="Language options">
                  {LANGUAGE_OPTIONS.map(([value, label]) => (
                    <li key={value}>
                      <button
                        type="button"
                        onClick={() => {
                          onLanguageSelect(value);
                          setIsLanguageMenuOpen(false);
                        }}
                        className={`w-full h-8 px-2.5 text-sm flex items-center justify-between ${
                          darkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                        role="option"
                        aria-selected={language === value}
                      >
                        <span>{label}</span>
                        {language === value ? <Check size={14} className="text-blue-600" /> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button
            onClick={onRun}
            disabled={isRunning}
            className={`h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-xs font-semibold ${
              isRunning
                ? 'bg-emerald-300 text-white cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            <Play size={13} />
            {isRunning ? 'Running…' : 'Run'}
          </button>
          <button
            onClick={applyStarter}
            className={`h-8 px-2.5 inline-flex items-center gap-1.5 border rounded-md text-xs font-semibold ${
              darkMode
                ? 'border-gray-700 text-gray-200 hover:bg-gray-800'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Braces size={13} />
            Starter
          </button>
          <button
            onClick={clearEditor}
            className={`h-8 px-2.5 inline-flex items-center gap-1.5 border rounded-md text-xs font-semibold ${
              darkMode
                ? 'border-gray-700 text-gray-200 hover:bg-gray-800'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Eraser size={13} />
            Clear
          </button>
          <div className={`w-px h-5 mx-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
          <button
            onClick={onZoomOut}
            className={`h-8 w-8 inline-flex items-center justify-center border rounded-md ${
              darkMode
                ? 'border-gray-700 text-gray-200 hover:bg-gray-800'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
            aria-label="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <span className={`text-xs font-semibold w-9 text-center ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{fontSize}px</span>
          <button
            onClick={onZoomIn}
            className={`h-8 w-8 inline-flex items-center justify-center border rounded-md ${
              darkMode
                ? 'border-gray-700 text-gray-200 hover:bg-gray-800'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
            aria-label="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          height="100%"
          value={content}
          language={toMonacoLanguage(language)}
          onChange={(value) => setContent(value ?? '')}
          beforeMount={onBeforeMount}
          onMount={onMount}
          options={{
            minimap: { enabled: false },
            smoothScrolling: true,
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            tabSize: 2,
            insertSpaces: true,
            automaticLayout: true,
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            inlineSuggest: { enabled: true },
            parameterHints: { enabled: true },
            wordBasedSuggestions: 'allDocuments',
            formatOnType: true,
            formatOnPaste: true,
            mouseWheelZoom: true,
            fontSize,
          }}
          theme={darkMode ? NPAD_THEME_DARK : NPAD_THEME_LIGHT}
        />
      </div>

      <div className={`h-40 border-t px-4 py-3 flex flex-col ${darkMode ? 'border-gray-700 bg-gray-950' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold uppercase tracking-wide ${terminalTone}`}>Terminal • {terminalStatusLabel}</span>
            {terminalTimestamp ? (
              <span className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{terminalTimestamp}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClearOutput}
            className={`text-[11px] font-semibold ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Clear output
          </button>
        </div>
        <pre className={`flex-1 overflow-auto rounded-md border p-2 text-xs leading-5 font-mono whitespace-pre-wrap ${
          darkMode ? 'border-gray-800 bg-black text-gray-200' : 'border-gray-200 bg-white text-gray-800'
        }`}>
          {terminalOutput || 'Press Run or use Cmd/Ctrl + Enter to execute this code.'}
        </pre>
      </div>

      <div className={`h-8 border-t px-4 flex items-center justify-between text-[11px] font-medium ${
        darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'
      }`}>
        <span>{LABELS[language]}</span>
        <span>{lineCount} lines • {content.length} chars</span>
      </div>
    </div>
  );
};

export default CodeEditor;
