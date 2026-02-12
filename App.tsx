import React, { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import DocumentEditor from './components/DocumentEditor';
import CodeEditor from './components/CodeEditor';
import RightPanel from './components/RightPanel';
import Modal from './components/Modal';
import ListView from './components/ListView';
import type { DocumentMetadata, DocumentTag, Collaborator, CodeLanguage, EditorMode, DocumentTemplate } from './types';
import {
  Search, Check, Settings, LogOut, Code2,
  Mail, Link as LinkIcon, Shield,
  FileText, Download, Globe, Type, Palette, Zap, Play,
  FolderPlus, LayoutTemplate, Save,
} from 'lucide-react';

type View = 'editor' | 'drafts' | 'recent' | 'starred' | 'archived' | 'trash' | 'collection';
type Tab = 'editor' | 'preview';
type Workspace = { id: string; name: string };
type BreadcrumbItem = { label: string; onClick?: () => void };
type EditorFontFamily = 'inter' | 'mono' | 'serif' | 'system';
type EditorFontSize = 'sm' | 'md' | 'lg';
type EditorLineHeight = 'compact' | 'relaxed' | 'spacious';
type TerminalRunStatus = 'idle' | 'running' | 'success' | 'error';

type TerminalRunState = {
  status: TerminalRunStatus;
  output: string;
  ranAt: string;
};

const CURRENT_USER_NAME = 'Account Owner';
const CURRENT_USER_EMAIL = 'owner@npad.app';
const STORAGE_KEY = 'npad-documents-v2';
const WORKSPACE_KEY = 'npad-workspace-name-v2';
const WORKSPACES_KEY = 'npad-workspaces-v1';
const ACTIVE_WORKSPACE_ID_KEY = 'npad-active-workspace-id-v1';
const COLLECTIONS_KEY = 'npad-collections-v2';
const TEMPLATE_STORAGE_KEY = 'npad-document-templates-v1';
const ONBOARDING_KEY = 'npad-onboarding-complete-v2';
const DARK_MODE_KEY = 'npad-dark-mode-v1';

const CODE_EXPORT_EXT: Record<CodeLanguage, string> = {
  plaintext: 'txt',
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  json: 'json',
  html: 'html',
  css: 'css',
  markdown: 'md',
  bash: 'sh',
  mips: 's',
};

const normalizeCollectionName = (value: string) => value.trim().replace(/\s+/g, ' ');
const JS_RUN_TIMEOUT_MS = 4000;
const PY_RUN_TIMEOUT_MS = 8000;

const JS_RUNNER_WORKER_SOURCE = `
const serialize = (value) => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || value.message || String(value);
  if (typeof value === 'undefined') return 'undefined';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

self.onmessage = async (event) => {
  const code = String(event.data?.code ?? '');
  const timeoutMs = Number(event.data?.timeoutMs ?? 4000);
  const lines = [];
  const push = (args) => {
    lines.push(args.map(serialize).join(' '));
  };
  const consoleProxy = {
    log: (...args) => push(args),
    info: (...args) => push(args),
    warn: (...args) => push(args),
    error: (...args) => push(args),
  };

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Execution timed out after ' + timeoutMs + 'ms.')), timeoutMs);
  });

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const run = new AsyncFunction('console', code);
    const result = await Promise.race([run(consoleProxy), timeoutPromise]);
    if (typeof result !== 'undefined') {
      push(['=>', result]);
    }
    self.postMessage({ status: 'success', output: lines.join('\\n') });
  } catch (error) {
    push([error]);
    self.postMessage({ status: 'error', output: lines.join('\\n') });
  }
};
`;

const getRunTimestamp = () =>
  new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const runJavaScriptLikeCode = (code: string): Promise<{ status: 'success' | 'error'; output: string }> =>
  new Promise((resolve) => {
    const blob = new Blob([JS_RUNNER_WORKER_SOURCE], { type: 'text/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    worker.onmessage = (event: MessageEvent<{ status?: string; output?: string }>) => {
      const status = event.data?.status === 'success' ? 'success' : 'error';
      resolve({
        status,
        output: event.data?.output?.trim() || (status === 'success' ? '(no output)' : 'Execution failed.'),
      });
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };

    worker.onerror = () => {
      resolve({ status: 'error', output: 'Runner crashed before producing output.' });
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };

    worker.postMessage({ code, timeoutMs: JS_RUN_TIMEOUT_MS });
  });

const PYTHON_RUNNER_WORKER_SOURCE = `
let pyodideReadyPromise;

const getPyodideInstance = async () => {
  if (!pyodideReadyPromise) {
    importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js');
    pyodideReadyPromise = loadPyodide();
  }
  return pyodideReadyPromise;
};

self.onmessage = async (event) => {
  const code = String(event.data?.code ?? '');
  const timeoutMs = Number(event.data?.timeoutMs ?? 8000);
  const lines = [];

  try {
    const pyodide = await getPyodideInstance();
    pyodide.setStdout({
      batched: (text) => lines.push(String(text)),
    });
    pyodide.setStderr({
      batched: (text) => lines.push(String(text)),
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Python execution timed out after ' + timeoutMs + 'ms.')), timeoutMs);
    });

    const result = await Promise.race([pyodide.runPythonAsync(code), timeoutPromise]);
    if (typeof result !== 'undefined' && result !== null) {
      lines.push('=> ' + String(result));
    }

    self.postMessage({ status: 'success', output: lines.join('\\n') || '(no output)' });
  } catch (error) {
    lines.push(error instanceof Error ? (error.stack || error.message) : String(error));
    self.postMessage({ status: 'error', output: lines.join('\\n') || 'Python execution failed.' });
  }
};
`;

const runPythonCode = (code: string): Promise<{ status: 'success' | 'error'; output: string }> =>
  new Promise((resolve) => {
    const blob = new Blob([PYTHON_RUNNER_WORKER_SOURCE], { type: 'text/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    worker.onmessage = (event: MessageEvent<{ status?: string; output?: string }>) => {
      const status = event.data?.status === 'success' ? 'success' : 'error';
      resolve({
        status,
        output: event.data?.output?.trim() || (status === 'success' ? '(no output)' : 'Python execution failed.'),
      });
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };

    worker.onerror = () => {
      resolve({ status: 'error', output: 'Python runner crashed before producing output.' });
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };

    worker.postMessage({ code, timeoutMs: PY_RUN_TIMEOUT_MS });
  });

const transpileTypeScriptCode = async (source: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> => {
  try {
    const ts = await import('typescript');
    const result = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ES2020,
      },
      reportDiagnostics: true,
    });

    const diagnostics = result.diagnostics ?? [];
    if (diagnostics.length > 0) {
      const first = diagnostics[0];
      const message = ts.flattenDiagnosticMessageText(first.messageText, '\n');
      return { ok: false, error: `TypeScript transpile error: ${message}` };
    }

    return { ok: true, code: result.outputText };
  } catch (error) {
    return {
      ok: false,
      error: `TypeScript runner failed to load: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const runJsonCode = (source: string): { status: 'success' | 'error'; output: string } => {
  try {
    const parsed = JSON.parse(source);
    return { status: 'success', output: JSON.stringify(parsed, null, 2) };
  } catch (error) {
    return {
      status: 'error',
      output: `JSON parse error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const runMarkdownCode = (source: string): { status: 'success' | 'error'; output: string } => {
  try {
    const html = marked.parse(source, { gfm: true, breaks: true }) as string;
    return { status: 'success', output: html || '(empty markdown)' };
  } catch (error) {
    return {
      status: 'error',
      output: `Markdown render error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const runPlaintextCode = (source: string): { status: 'success' | 'error'; output: string } => ({
  status: 'success',
  output: source || '(empty)',
});

const runHtmlCode = (source: string): { status: 'success' | 'error'; output: string } => ({
  status: 'success',
  output: `HTML validated as text input.\n\n${source || '(empty)'}`,
});

const runCssCode = (source: string): { status: 'success' | 'error'; output: string } => ({
  status: 'success',
  output: `CSS captured.\n\n${source || '(empty)'}`,
});

const runBashCode = (source: string): { status: 'success' | 'error'; output: string } => {
  const lines: string[] = [];
  let hadError = false;
  const scriptLines = source.split('\n');

  for (const rawLine of scriptLines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line === 'pwd') {
      lines.push('/workspace');
      continue;
    }
    if (line === 'whoami') {
      lines.push('npad-user');
      continue;
    }
    if (line === 'date') {
      lines.push(new Date().toString());
      continue;
    }
    if (line.startsWith('echo ')) {
      const text = line.slice(5).trim().replace(/^['"]|['"]$/g, '');
      lines.push(text);
      continue;
    }
    if (line.startsWith('printf ')) {
      const text = line.slice(7).trim().replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n');
      lines.push(text);
      continue;
    }

    hadError = true;
    lines.push(`command not supported in browser bash runner: ${line}`);
  }

  return {
    status: hadError ? 'error' : 'success',
    output: lines.join('\n') || '(no output)',
  };
};

const MIPS_REGISTERS = [
  '$zero', '$at',
  '$v0', '$v1',
  '$a0', '$a1', '$a2', '$a3',
  '$t0', '$t1', '$t2', '$t3', '$t4', '$t5', '$t6', '$t7', '$t8', '$t9',
  '$s0', '$s1', '$s2', '$s3', '$s4', '$s5', '$s6', '$s7',
  '$k0', '$k1',
  '$gp', '$sp', '$fp', '$ra',
] as const;

type MipsRegister = (typeof MIPS_REGISTERS)[number];
type MipsMachineStatus = 'ready' | 'halted' | 'error';
type MipsMemoryState = Record<string, number>;
type MipsRegisterState = Record<string, number>;

type MipsProgram = {
  instructions: string[];
  labels: Map<string, number>;
  dataByAddress: Map<number, string>;
  dataAddresses: Map<string, number>;
};

type MipsMachineState = {
  source: string;
  program: MipsProgram;
  registers: MipsRegisterState;
  memory: MipsMemoryState;
  output: string;
  status: MipsMachineStatus;
  error: string;
  pc: number;
  steps: number;
  touchedRegisters: string[];
  touchedMemory: string[];
};

type MipsDocumentState = {
  initialRegisters: MipsRegisterState;
  initialMemory: MipsMemoryState;
  machine: MipsMachineState | null;
};

const MIPS_MAX_STEPS = 10000;
const MIPS_DATA_BASE = 0x10010000;
const MIPS_REGISTER_SET = new Set<string>(MIPS_REGISTERS);

const parseMipsNumber = (raw: string): number | null => {
  const value = raw.trim();
  if (!value) return null;
  const parsed = /^-?0x[0-9a-fA-F]+$/.test(value) ? Number.parseInt(value, 16) : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed | 0;
};

const sanitizeMipsMemoryAddress = (address: number): number => (address | 0);

const parseMipsProgram = (source: string): { ok: true; program: MipsProgram } | { ok: false; error: string } => {
  const labels = new Map<string, number>();
  const instructions: string[] = [];
  const dataByAddress = new Map<number, string>();
  const dataAddresses = new Map<string, number>();
  let nextDataAddress = MIPS_DATA_BASE;
  let inText = false;

  const rawLines = source
    .split('\n')
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter((line) => line.length > 0);

  for (const rawLine of rawLines) {
    if (rawLine === '.text') {
      inText = true;
      continue;
    }
    if (rawLine === '.data') {
      inText = false;
      continue;
    }
    if (/^\.globl\b/i.test(rawLine)) {
      continue;
    }

    let line = rawLine;
    const inlineLabel = line.match(/^([A-Za-z_.$][\w.$]*):\s*(.*)$/);
    if (inlineLabel) {
      const label = inlineLabel[1];
      const rest = inlineLabel[2];
      if (inText) {
        labels.set(label, instructions.length);
      } else {
        if (!dataAddresses.has(label)) {
          dataAddresses.set(label, nextDataAddress);
        }
      }
      line = rest.trim();
      if (!line) continue;
    }

    if (!inText) {
      const asciiz = line.match(/^\.asciiz\s+"([\s\S]*)"$/i);
      if (asciiz) {
        const normalized = asciiz[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        const address = dataAddresses.get(inlineLabel?.[1] ?? '') ?? nextDataAddress;
        dataByAddress.set(address, normalized);
        nextDataAddress = address + normalized.length + 1;
        continue;
      }
      const words = line.match(/^\.word\s+(.+)$/i);
      if (words) {
        const values = words[1].split(',').map((part) => part.trim()).filter(Boolean);
        const address = dataAddresses.get(inlineLabel?.[1] ?? '') ?? nextDataAddress;
        nextDataAddress = address + (Math.max(1, values.length) * 4);
        continue;
      }
      continue;
    }

    instructions.push(line);
  }

  if (instructions.length === 0) {
    return { ok: false, error: 'No MIPS instructions found in .text section.' };
  }

  return {
    ok: true,
    program: {
      instructions,
      labels,
      dataByAddress,
      dataAddresses,
    },
  };
};

const createDefaultMipsDocState = (): MipsDocumentState => ({
  initialRegisters: {},
  initialMemory: {},
  machine: null,
});

const initializeMipsMachine = (
  source: string,
  initialRegisters: MipsRegisterState,
  initialMemory: MipsMemoryState,
): MipsMachineState => {
  const parsed = parseMipsProgram(source);
  if (!parsed.ok) {
    return {
      source,
      program: { instructions: [], labels: new Map(), dataByAddress: new Map(), dataAddresses: new Map() },
      registers: Object.fromEntries(MIPS_REGISTERS.map((reg) => [reg, 0])) as MipsRegisterState,
      memory: {},
      output: '',
      status: 'error',
      error: parsed.error,
      pc: 0,
      steps: 0,
      touchedRegisters: [],
      touchedMemory: [],
    };
  }

  const registers = Object.fromEntries(MIPS_REGISTERS.map((reg) => [reg, 0])) as MipsRegisterState;
  for (const [reg, value] of Object.entries(initialRegisters)) {
    if (MIPS_REGISTER_SET.has(reg) && reg !== '$zero') {
      registers[reg] = value | 0;
    }
  }
  registers.$zero = 0;

  const memory: MipsMemoryState = {};
  for (const [key, value] of Object.entries(initialMemory)) {
    const parsedAddress = parseMipsNumber(key);
    if (parsedAddress === null) continue;
    memory[String(sanitizeMipsMemoryAddress(parsedAddress))] = value | 0;
  }

  return {
    source,
    program: parsed.program,
    registers,
    memory,
    output: '',
    status: 'ready',
    error: '',
    pc: 0,
    steps: 0,
    touchedRegisters: [],
    touchedMemory: [],
  };
};

const readMipsRegister = (machine: MipsMachineState, name: string): number =>
  machine.registers[name] ?? 0;

const writeMipsRegister = (machine: MipsMachineState, name: string, value: number) => {
  if (!MIPS_REGISTER_SET.has(name) || name === '$zero') return;
  machine.registers[name] = value | 0;
  if (!machine.touchedRegisters.includes(name)) {
    machine.touchedRegisters.push(name);
  }
};

const parseMipsAddressOperand = (machine: MipsMachineState, operand: string): number | null => {
  const offsetBase = operand.match(/^(.+)\((\$\w+)\)$/);
  if (offsetBase) {
    const offset = parseMipsNumber(offsetBase[1].trim());
    const base = offsetBase[2].trim();
    if (offset === null || !MIPS_REGISTER_SET.has(base)) return null;
    return sanitizeMipsMemoryAddress(readMipsRegister(machine, base) + offset);
  }
  if (machine.program.dataAddresses.has(operand)) {
    return machine.program.dataAddresses.get(operand) ?? null;
  }
  const direct = parseMipsNumber(operand);
  if (direct === null) return null;
  return sanitizeMipsMemoryAddress(direct);
};

const appendMipsOutput = (machine: MipsMachineState, text: string) => {
  machine.output += text;
};

const stepMipsMachine = (current: MipsMachineState): MipsMachineState => {
  if (current.status !== 'ready') return current;
  if (current.pc < 0 || current.pc >= current.program.instructions.length) {
    return { ...current, status: 'halted' };
  }
  if (current.steps >= MIPS_MAX_STEPS) {
    return { ...current, status: 'error', error: 'MIPS execution timed out.' };
  }

  const machine: MipsMachineState = {
    ...current,
    registers: { ...current.registers },
    memory: { ...current.memory },
    touchedRegisters: [...current.touchedRegisters],
    touchedMemory: [...current.touchedMemory],
    steps: current.steps + 1,
  };
  const inst = machine.program.instructions[machine.pc];

  const fail = (message: string): MipsMachineState => ({
    ...machine,
    status: 'error',
    error: message,
  });

  const li = inst.match(/^li\s+(\$\w+)\s*,\s*([^,\s]+)$/i);
  if (li) {
    const value = parseMipsNumber(li[2]);
    if (value === null) return fail(`Invalid immediate value: ${li[2]}`);
    writeMipsRegister(machine, li[1], value);
    machine.pc += 1;
    machine.registers.$zero = 0;
    return machine;
  }

  const la = inst.match(/^la\s+(\$\w+)\s*,\s*([A-Za-z_.$][\w.$]*)$/i);
  if (la) {
    const address = machine.program.dataAddresses.get(la[2]);
    if (typeof address !== 'number') return fail(`Unknown data label: ${la[2]}`);
    writeMipsRegister(machine, la[1], address);
    machine.pc += 1;
    machine.registers.$zero = 0;
    return machine;
  }

  const move = inst.match(/^move\s+(\$\w+)\s*,\s*(\$\w+)$/i);
  if (move) {
    writeMipsRegister(machine, move[1], readMipsRegister(machine, move[2]));
    machine.pc += 1;
    machine.registers.$zero = 0;
    return machine;
  }

  const addi = inst.match(/^addi\s+(\$\w+)\s*,\s*(\$\w+)\s*,\s*([^,\s]+)$/i);
  if (addi) {
    const immediate = parseMipsNumber(addi[3]);
    if (immediate === null) return fail(`Invalid immediate value: ${addi[3]}`);
    writeMipsRegister(machine, addi[1], (readMipsRegister(machine, addi[2]) + immediate) | 0);
    machine.pc += 1;
    machine.registers.$zero = 0;
    return machine;
  }

  const arithmetic = inst.match(/^(add|sub)\s+(\$\w+)\s*,\s*(\$\w+)\s*,\s*(\$\w+)$/i);
  if (arithmetic) {
    const lhs = readMipsRegister(machine, arithmetic[3]);
    const rhs = readMipsRegister(machine, arithmetic[4]);
    const next = arithmetic[1].toLowerCase() === 'add' ? (lhs + rhs) : (lhs - rhs);
    writeMipsRegister(machine, arithmetic[2], next | 0);
    machine.pc += 1;
    machine.registers.$zero = 0;
    return machine;
  }

  const lw = inst.match(/^lw\s+(\$\w+)\s*,\s*(.+)$/i);
  if (lw) {
    const address = parseMipsAddressOperand(machine, lw[2].trim());
    if (address === null) return fail(`Invalid memory operand: ${lw[2]}`);
    const key = String(address);
    writeMipsRegister(machine, lw[1], machine.memory[key] ?? 0);
    if (!machine.touchedMemory.includes(key)) {
      machine.touchedMemory.push(key);
    }
    machine.pc += 1;
    machine.registers.$zero = 0;
    return machine;
  }

  const sw = inst.match(/^sw\s+(\$\w+)\s*,\s*(.+)$/i);
  if (sw) {
    const address = parseMipsAddressOperand(machine, sw[2].trim());
    if (address === null) return fail(`Invalid memory operand: ${sw[2]}`);
    const key = String(address);
    machine.memory[key] = readMipsRegister(machine, sw[1]) | 0;
    if (!machine.touchedMemory.includes(key)) {
      machine.touchedMemory.push(key);
    }
    machine.pc += 1;
    machine.registers.$zero = 0;
    return machine;
  }

  const branch = inst.match(/^(beq|bne)\s+(\$\w+)\s*,\s*(\$\w+)\s*,\s*([A-Za-z_.$][\w.$]*)$/i);
  if (branch) {
    const lhs = readMipsRegister(machine, branch[2]);
    const rhs = readMipsRegister(machine, branch[3]);
    const shouldBranch = branch[1].toLowerCase() === 'beq' ? lhs === rhs : lhs !== rhs;
    if (shouldBranch) {
      const target = machine.program.labels.get(branch[4]);
      if (typeof target !== 'number') return fail(`Unknown label: ${branch[4]}`);
      machine.pc = target;
    } else {
      machine.pc += 1;
    }
    machine.registers.$zero = 0;
    return machine;
  }

  const jump = inst.match(/^j\s+([A-Za-z_.$][\w.$]*)$/i);
  if (jump) {
    const target = machine.program.labels.get(jump[1]);
    if (typeof target !== 'number') return fail(`Unknown label: ${jump[1]}`);
    machine.pc = target;
    machine.registers.$zero = 0;
    return machine;
  }

  if (/^syscall$/i.test(inst)) {
    const v0 = readMipsRegister(machine, '$v0');
    if (v0 === 1) {
      appendMipsOutput(machine, String(readMipsRegister(machine, '$a0')));
    } else if (v0 === 4) {
      const address = readMipsRegister(machine, '$a0');
      appendMipsOutput(machine, machine.program.dataByAddress.get(address) ?? '');
    } else if (v0 === 10) {
      machine.status = 'halted';
    } else if (v0 === 11) {
      appendMipsOutput(machine, String.fromCharCode(readMipsRegister(machine, '$a0') & 0xff));
    } else {
      return fail(`Unsupported syscall: ${v0}`);
    }
    if (machine.status !== 'halted') {
      machine.pc += 1;
    }
    machine.registers.$zero = 0;
    return machine;
  }

  return fail(`Unsupported instruction: ${inst}`);
};

const runMipsMachineToEnd = (machine: MipsMachineState): MipsMachineState => {
  let next = machine;
  while (next.status === 'ready') {
    next = stepMipsMachine(next);
  }
  return next;
};

const FONT_FAMILY_OPTIONS: { id: EditorFontFamily; label: string; className: string }[] = [
  { id: 'inter', label: 'Inter', className: 'font-inter' },
  { id: 'mono', label: 'Mono', className: 'font-mono' },
  { id: 'serif', label: 'Serif', className: 'font-serif' },
  { id: 'system', label: 'System', className: 'font-sans' },
];

const FONT_SIZE_OPTIONS: { id: EditorFontSize; label: string; className: string }[] = [
  { id: 'sm', label: 'Small', className: 'text-base' },
  { id: 'md', label: 'Medium', className: 'text-lg' },
  { id: 'lg', label: 'Large', className: 'text-xl' },
];

const LINE_HEIGHT_OPTIONS: { id: EditorLineHeight; label: string; className: string }[] = [
  { id: 'compact', label: 'Compact', className: 'leading-7' },
  { id: 'relaxed', label: 'Relaxed', className: 'leading-8' },
  { id: 'spacious', label: 'Spacious', className: 'leading-9' },
];
const nowIso = () => new Date().toISOString();

const normalizeDocument = (doc: Partial<DocumentMetadata>): DocumentMetadata => ({
  id: doc.id ?? `doc-${Date.now()}`,
  title: doc.title ?? 'Untitled',
  content: doc.content ?? '',
  editorMode: doc.editorMode ?? 'rich',
  codeLanguage: doc.codeLanguage ?? 'plaintext',
  collection: normalizeCollectionName(doc.collection ?? 'General'),
  owner: doc.owner ?? CURRENT_USER_NAME,
  starred: doc.starred ?? false,
  archived: doc.archived ?? false,
  trashed: doc.trashed ?? false,
  published: doc.published ?? false,
  publicVisibility: doc.publicVisibility ?? false,
  teamAccess: doc.teamAccess ?? true,
  updatedAt: doc.updatedAt ?? 'Just now',
  tags: doc.tags ?? [],
  collaborators: doc.collaborators ?? [{ id: 'owner', name: CURRENT_USER_NAME, email: CURRENT_USER_EMAIL, role: 'owner' }],
  activity: doc.activity ?? [{ id: `evt-${Date.now()}`, actor: CURRENT_USER_NAME, action: 'created', timestamp: 'Just now' }],
});

const normalizeTemplate = (template: Partial<DocumentTemplate>): DocumentTemplate => ({
  id: template.id ?? `tpl-${Date.now()}`,
  name: (template.name ?? '').trim() || 'Untitled Template',
  title: template.title ?? 'Untitled',
  content: template.content ?? '',
  editorMode: template.editorMode ?? 'rich',
  codeLanguage: template.codeLanguage ?? 'markdown',
  tags: Array.isArray(template.tags) ? template.tags : [],
  createdAt: template.createdAt ?? nowIso(),
  updatedAt: template.updatedAt ?? nowIso(),
});

const DEFAULT_TEMPLATES: DocumentTemplate[] = [
  normalizeTemplate({
    id: 'tpl-meeting-notes',
    name: 'Meeting Notes',
    title: 'Meeting Notes',
    content: '# Meeting Notes\n\n## Agenda\n- \n\n## Notes\n- \n\n## Action Items\n- [ ] ',
    editorMode: 'rich',
    codeLanguage: 'markdown',
    tags: [{ id: 'tag-template-meeting', label: 'Template', color: 'blue' }],
  }),
  normalizeTemplate({
    id: 'tpl-project-plan',
    name: 'Project Plan',
    title: 'Project Plan',
    content: '# Project Plan\n\n## Goal\n\n## Milestones\n1. \n2. \n3. \n\n## Risks\n- ',
    editorMode: 'rich',
    codeLanguage: 'markdown',
    tags: [{ id: 'tag-template-plan', label: 'Template', color: 'purple' }],
  }),
];

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('editor');
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('editor');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [isEditorSettingsOpen, setIsEditorSettingsOpen] = useState(false);
  const [statusLabel, setStatusLabel] = useState('Saved');
  const [quickSearch, setQuickSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [shareFeedback, setShareFeedback] = useState('');
  const [fontFamily, setFontFamily] = useState<EditorFontFamily>('inter');
  const [fontSize, setFontSize] = useState<EditorFontSize>('md');
  const [lineHeight, setLineHeight] = useState<EditorLineHeight>('relaxed');
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem(DARK_MODE_KEY) === 'true');

  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
    const saved = localStorage.getItem(WORKSPACES_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Workspace[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed
            .map((workspace, index) => ({
              id: workspace.id || `ws-${Date.now()}-${index}`,
              name: normalizeCollectionName(workspace.name ?? ''),
            }))
            .filter((workspace) => workspace.name.length > 0);
          if (normalized.length > 0) return normalized;
        }
      } catch {
        // no-op
      }
    }

    const legacy = normalizeCollectionName(localStorage.getItem(WORKSPACE_KEY) ?? '');
    if (legacy) {
      return [{ id: `ws-${Date.now()}`, name: legacy }];
    }

    return [{ id: `ws-${Date.now()}`, name: '' }];
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_WORKSPACE_ID_KEY);
    return saved ?? '';
  });
  const [workspaceDraft, setWorkspaceDraft] = useState(() => {
    const saved = localStorage.getItem(WORKSPACE_KEY);
    return normalizeCollectionName(saved ?? '');
  });
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceError, setNewWorkspaceError] = useState('');
  const [collectionDraft, setCollectionDraft] = useState('');
  const [isCreateCollectionModalOpen, setIsCreateCollectionModalOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionError, setNewCollectionError] = useState('');
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [templateNameError, setTemplateNameError] = useState('');
  const [terminalByDocument, setTerminalByDocument] = useState<Record<string, TerminalRunState>>({});
  const [mipsByDocument, setMipsByDocument] = useState<Record<string, MipsDocumentState>>({});

  const [documents, setDocuments] = useState<DocumentMetadata[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as Partial<DocumentMetadata>[];
      if (!Array.isArray(parsed)) return [];
      return parsed.map((doc) => normalizeDocument(doc));
    } catch {
      return [];
    }
  });

  const [collections, setCollections] = useState<string[]>(() => {
    const saved = localStorage.getItem(COLLECTIONS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed)) {
          return Array.from(new Set(parsed.map((name) => normalizeCollectionName(name)).filter(Boolean)));
        }
      } catch {
        // no-op
      }
    }

    const docsSaved = localStorage.getItem(STORAGE_KEY);
    if (!docsSaved) return [];

    try {
      const parsed = JSON.parse(docsSaved) as Partial<DocumentMetadata>[];
      if (!Array.isArray(parsed)) return [];
      const fromDocs = parsed
        .map((doc) => normalizeCollectionName(doc.collection ?? ''))
        .filter(Boolean);
      return Array.from(new Set(fromDocs));
    } catch {
      return [];
    }
  });

  const [templates, setTemplates] = useState<DocumentTemplate[]>(() => {
    const saved = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!saved) return DEFAULT_TEMPLATES;
    try {
      const parsed = JSON.parse(saved) as Partial<DocumentTemplate>[];
      if (!Array.isArray(parsed)) return DEFAULT_TEMPLATES;
      const normalized = parsed.map((template) => normalizeTemplate(template));
      return normalized.length > 0 ? normalized : DEFAULT_TEMPLATES;
    } catch {
      return DEFAULT_TEMPLATES;
    }
  });

  const [activeDocumentId, setActiveDocumentId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return '';
    try {
      const parsed = JSON.parse(saved) as DocumentMetadata[];
      return parsed[0]?.id ?? '';
    } catch {
      return '';
    }
  });

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => localStorage.getItem(ONBOARDING_KEY) !== 'true');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
  }, [collections]);

  useEffect(() => {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem(DARK_MODE_KEY, String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
  }, [workspaces]);

  useEffect(() => {
    if (!activeWorkspaceId && workspaces[0]?.id) {
      setActiveWorkspaceId(workspaces[0].id);
      return;
    }

    const exists = workspaces.some((workspace) => workspace.id === activeWorkspaceId);
    if (!exists && workspaces[0]?.id) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, activeWorkspaceId]);

  const workspaceName = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name ?? '',
    [workspaces, activeWorkspaceId],
  );

  useEffect(() => {
    localStorage.setItem(WORKSPACE_KEY, workspaceName);
  }, [workspaceName]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    localStorage.setItem(ACTIVE_WORKSPACE_ID_KEY, activeWorkspaceId);
  }, [activeWorkspaceId]);

  useEffect(() => {
    setWorkspaceDraft(workspaceName);
  }, [workspaceName]);

  useEffect(() => {
    if (documents.length === 0) {
      setActiveDocumentId('');
      return;
    }

    const exists = documents.some((doc) => doc.id === activeDocumentId);
    if (!exists) {
      setActiveDocumentId(documents[0].id);
    }
  }, [documents, activeDocumentId]);

  useEffect(() => {
    if (activeCollection && !collections.includes(activeCollection)) {
      setActiveCollection(collections[0] ?? null);
      if (activeView === 'collection' && collections.length === 0) {
        setActiveView('editor');
      }
    }
  }, [activeCollection, collections, activeView]);

  useEffect(() => {
    if (!isWorkspaceMenuOpen) return;
    const handleClick = () => setIsWorkspaceMenuOpen(false);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [isWorkspaceMenuOpen]);

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickActionsOpen(true);
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, []);

  const activeDocument = useMemo(
    () => documents.find((doc) => doc.id === activeDocumentId),
    [documents, activeDocumentId],
  );

  const appFontClass = FONT_FAMILY_OPTIONS.find((option) => option.id === fontFamily)?.className ?? 'font-inter';
  const editorFontClass = FONT_FAMILY_OPTIONS.find((option) => option.id === fontFamily)?.className ?? 'font-inter';
  const editorFontSizeClass = FONT_SIZE_OPTIONS.find((option) => option.id === fontSize)?.className ?? 'text-lg';
  const editorLineHeightClass = LINE_HEIGHT_OPTIONS.find((option) => option.id === lineHeight)?.className ?? 'leading-8';

  const createCollection = (rawName: string) => {
    const name = normalizeCollectionName(rawName);
    if (!name) return { ok: false, reason: 'Collection name cannot be empty.' };

    const exists = collections.some((collection) => collection.toLowerCase() === name.toLowerCase());
    if (exists) return { ok: false, reason: 'Collection already exists.' };

    setCollections((prev) => [...prev, name]);
    setActiveCollection(name);
    setActiveView('collection');
    return { ok: true, name };
  };

  const openCreateCollectionModal = () => {
    setNewCollectionName('');
    setNewCollectionError('');
    setIsCreateCollectionModalOpen(true);
  };

  const submitCreateCollection = () => {
    const result = createCollection(newCollectionName);
    if (!result.ok) {
      setNewCollectionError(result.reason ?? 'Unable to create collection.');
      return;
    }

    setIsCreateCollectionModalOpen(false);
    setNewCollectionName('');
    setNewCollectionError('');
  };

  const createDocument = (mode: EditorMode = 'rich', targetCollection?: string, template?: DocumentTemplate) => {
    const fallbackCollection = targetCollection ?? activeCollection ?? collections[0] ?? 'General';
    const resolvedCollection = normalizeCollectionName(fallbackCollection);
    const templateTags = (template?.tags ?? []).map((tag) => ({ ...tag, id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }));

    if (!collections.includes(resolvedCollection)) {
      setCollections((prev) => [...prev, resolvedCollection]);
    }

    const doc: DocumentMetadata = {
      id: `doc-${Date.now()}`,
      title: template?.title ?? (mode === 'code' ? 'Untitled Code' : 'Untitled'),
      content: template?.content ?? '',
      editorMode: template?.editorMode ?? mode,
      codeLanguage: template?.codeLanguage ?? (mode === 'code' ? 'javascript' : 'markdown'),
      collection: resolvedCollection,
      owner: CURRENT_USER_NAME,
      starred: false,
      archived: false,
      trashed: false,
      published: false,
      publicVisibility: false,
      teamAccess: true,
      updatedAt: 'Just now',
      tags: template
        ? templateTags
        : mode === 'code'
          ? [{ id: `tag-${Date.now()}`, label: 'Code', color: 'blue' }]
          : [],
      collaborators: [{ id: 'owner', name: CURRENT_USER_NAME, email: CURRENT_USER_EMAIL, role: 'owner' }],
      activity: [{
        id: `evt-${Date.now()}`,
        actor: CURRENT_USER_NAME,
        action: template ? `created from template "${template.name}"` : 'created',
        timestamp: 'Just now',
      }],
    };

    setDocuments((prev) => [doc, ...prev]);
    setActiveDocumentId(doc.id);
    setActiveCollection(resolvedCollection);
    setActiveView('editor');
    setActiveTab('editor');
  };

  const openSaveTemplateModal = () => {
    if (!activeDocument) return;
    setTemplateNameDraft(activeDocument.title ? `${activeDocument.title} Template` : 'Untitled Template');
    setTemplateNameError('');
    setIsSaveTemplateModalOpen(true);
  };

  const saveActiveDocumentAsTemplate = () => {
    if (!activeDocument) return;

    const name = templateNameDraft.trim();
    if (!name) {
      setTemplateNameError('Template name cannot be empty.');
      return;
    }

    const exists = templates.some((template) => template.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      setTemplateNameError('A template with this name already exists.');
      return;
    }

    const template: DocumentTemplate = normalizeTemplate({
      id: `tpl-${Date.now()}`,
      name,
      title: activeDocument.title || 'Untitled',
      content: activeDocument.content,
      editorMode: activeDocument.editorMode,
      codeLanguage: activeDocument.codeLanguage,
      tags: activeDocument.tags,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    setTemplates((prev) => [template, ...prev]);
    setIsSaveTemplateModalOpen(false);
    setTemplateNameDraft('');
    setTemplateNameError('');
    setStatusLabel('Template saved');
  };

  const createFromTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    createDocument(template.editorMode, activeCollection ?? collections[0], template);
    setIsTemplatesModalOpen(false);
    setStatusLabel('Template applied');
  };

  const deleteTemplate = (templateId: string) => {
    setTemplates((prev) => prev.filter((template) => template.id !== templateId));
  };

  const renameActiveWorkspace = (rawName: string) => {
    const name = normalizeCollectionName(rawName);
    setWorkspaces((prev) =>
      prev.map((workspace) =>
        workspace.id === activeWorkspaceId
          ? { ...workspace, name }
          : workspace,
      ),
    );
  };

  const addWorkspace = (rawName: string) => {
    const name = normalizeCollectionName(rawName);
    if (!name) {
      setNewWorkspaceError('Workspace name cannot be empty.');
      return;
    }

    const exists = workspaces.some((workspace) => workspace.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      setNewWorkspaceError('Workspace already exists.');
      return;
    }

    const workspace: Workspace = { id: `ws-${Date.now()}`, name };
    setWorkspaces((prev) => [...prev, workspace]);
    setActiveWorkspaceId(workspace.id);
    setWorkspaceDraft(name);
    setNewWorkspaceName('');
    setNewWorkspaceError('');
  };

  const updateActiveDocument = (updater: (doc: DocumentMetadata) => DocumentMetadata) => {
    if (!activeDocument) return;
    setDocuments((prev) => prev.map((doc) => (doc.id === activeDocument.id ? updater(doc) : doc)));
    setStatusLabel('Saved');
  };

  const updateContent = (nextContent: string) => {
    updateActiveDocument((doc) => ({ ...doc, content: nextContent, updatedAt: 'Just now' }));
  };

  const updateTitle = (nextTitle: string) => {
    updateActiveDocument((doc) => ({ ...doc, title: nextTitle, updatedAt: 'Just now' }));
  };

  const updateEditorMode = (mode: EditorMode) => {
    updateActiveDocument((doc) => ({ ...doc, editorMode: mode, updatedAt: 'Just now' }));
  };

  const updateCodeLanguage = (language: CodeLanguage) => {
    updateActiveDocument((doc) => ({ ...doc, codeLanguage: language, updatedAt: 'Just now' }));
  };

  const runActiveCode = async () => {
    if (!activeDocument || activeDocument.editorMode !== 'code') return;

    const docId = activeDocument.id;
    const language = activeDocument.codeLanguage;
    const source = activeDocument.content;

    setTerminalByDocument((prev) => ({
      ...prev,
      [docId]: {
        status: 'running',
        output: '$ Running...',
        ranAt: getRunTimestamp(),
      },
    }));

    let result: { status: 'success' | 'error'; output: string };
    if (language === 'javascript') {
      result = await runJavaScriptLikeCode(source);
    } else if (language === 'typescript') {
      const transpiled = await transpileTypeScriptCode(source);
      if (!transpiled.ok) {
        setTerminalByDocument((prev) => ({
          ...prev,
          [docId]: {
            status: 'error',
            output: transpiled.error,
            ranAt: getRunTimestamp(),
          },
        }));
        return;
      }
      result = await runJavaScriptLikeCode(transpiled.code);
    } else if (language === 'python') {
      result = await runPythonCode(source);
    } else if (language === 'json') {
      result = runJsonCode(source);
    } else if (language === 'markdown') {
      result = runMarkdownCode(source);
    } else if (language === 'html') {
      result = runHtmlCode(source);
    } else if (language === 'css') {
      result = runCssCode(source);
    } else if (language === 'bash') {
      result = runBashCode(source);
    } else if (language === 'mips') {
      result = runMipsCode(source);
    } else {
      result = runPlaintextCode(source);
    }

    setTerminalByDocument((prev) => ({
      ...prev,
      [docId]: {
        status: result.status,
        output: result.output,
        ranAt: getRunTimestamp(),
      },
    }));
  };

  const clearActiveTerminal = () => {
    if (!activeDocument) return;
    setTerminalByDocument((prev) => {
      const next = { ...prev };
      delete next[activeDocument.id];
      return next;
    });
  };

  const archiveDocument = (id: string) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === id
          ? { ...doc, archived: true, trashed: false, updatedAt: 'Just now' }
          : doc,
      ),
    );
  };

  const deleteDocument = (id: string) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === id
          ? { ...doc, trashed: true, archived: false, updatedAt: 'Just now' }
          : doc,
      ),
    );
  };

  const moveDocumentToCollection = (id: string, rawCollection: string) => {
    const targetCollection = normalizeCollectionName(rawCollection);
    if (!targetCollection) return;

    if (!collections.includes(targetCollection)) {
      setCollections((prev) => [...prev, targetCollection]);
    }

    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === id
          ? { ...doc, collection: targetCollection, updatedAt: 'Just now' }
          : doc,
      ),
    );
  };

  const wordCount = activeDocument?.content.trim() ? activeDocument.content.trim().split(/\s+/).length : 0;
  const lineCount = Math.max(1, activeDocument?.content.split('\n').length ?? 1);
  const primaryStatLabel = activeDocument?.editorMode === 'code' ? 'Lines' : 'Words';
  const primaryStatValue = activeDocument?.editorMode === 'code' ? lineCount : wordCount;
  const secondaryStatLabel = activeDocument?.editorMode === 'code' ? 'Characters' : 'Reading time';
  const secondaryStatValue = activeDocument?.editorMode === 'code'
    ? activeDocument.content.length
    : Math.max(1, Math.ceil(wordCount / 200));

  const filteredDocuments = useMemo(() => {
    switch (activeView) {
      case 'drafts':
      case 'recent':
      case 'editor':
        return documents.filter((doc) => !doc.archived && !doc.trashed);
      case 'starred':
        return documents.filter((doc) => doc.starred && !doc.trashed);
      case 'archived':
        return documents.filter((doc) => doc.archived && !doc.trashed);
      case 'trash':
        return documents.filter((doc) => doc.trashed);
      case 'collection':
        return documents.filter((doc) => doc.collection === activeCollection && !doc.archived && !doc.trashed);
      default:
        return documents.filter((doc) => !doc.archived && !doc.trashed);
    }
  }, [documents, activeCollection, activeView]);

  const exportDocument = (format: 'pdf' | 'md' | 'html' | 'txt' | 'code') => {
    if (!activeDocument) return;

    const title = activeDocument.title || 'document';
    const safe = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const body = activeDocument.content;

    if (format === 'pdf') {
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(`<pre style="font-family:Inter,sans-serif;white-space:pre-wrap;padding:24px;">${body}</pre>`);
      win.document.close();
      win.focus();
      win.print();
      return;
    }

    const download = (data: string, ext: string, mime: string) => {
      const blob = new Blob([data], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safe}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    };

    if (format === 'code') {
      const ext = CODE_EXPORT_EXT[activeDocument.codeLanguage] ?? 'txt';
      download(body, ext, 'text/plain;charset=utf-8');
      return;
    }

    if (format === 'md') download(body, 'md', 'text/markdown;charset=utf-8');
    if (format === 'txt') download(body.replace(/[#*_`>-]/g, ''), 'txt', 'text/plain;charset=utf-8');
    if (format === 'html') {
      download(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><pre>${body}</pre></body></html>`, 'html', 'text/html;charset=utf-8');
    }
  };

  const addCollaborator = () => {
    if (!activeDocument) return;

    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setShareFeedback('Enter a valid email address.');
      return;
    }

    const alreadyExists = activeDocument.collaborators.some((person) => person.email === email);
    if (alreadyExists) {
      setShareFeedback('This collaborator already has access.');
      return;
    }

    const name = email.split('@')[0].replace(/[._-]/g, ' ');
    const collaborator: Collaborator = {
      id: `col-${Date.now()}`,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      email,
      role: 'editor',
    };

    updateActiveDocument((doc) => ({
      ...doc,
      collaborators: [...doc.collaborators, collaborator],
      activity: [{ id: `evt-${Date.now()}`, actor: CURRENT_USER_NAME, action: `invited ${collaborator.name}`, timestamp: 'Just now' }, ...doc.activity].slice(0, 5),
    }));
    setInviteEmail('');
    setShareFeedback(`Invite sent to ${email}.`);
  };

  const copyShareLink = async () => {
    if (!activeDocument) return;

    const link = `${window.location.origin}/doc/${activeDocument.id}`;
    if (!navigator.clipboard) {
      setShareFeedback('Clipboard unavailable in this browser.');
      return;
    }
    await navigator.clipboard.writeText(link);
    setShareFeedback('Shareable link copied.');
  };

  const quickActions = [
    {
      id: 'new',
      label: 'New Document',
      shortcut: 'D',
      icon: <FileText size={16} />,
      run: () => createDocument('rich'),
    },
    {
      id: 'new-code',
      label: 'New Code Note',
      shortcut: 'N',
      icon: <Code2 size={16} />,
      run: () => createDocument('code'),
    },
    {
      id: 'new-from-template',
      label: 'New from Template',
      shortcut: 'T',
      icon: <LayoutTemplate size={16} />,
      run: () => setIsTemplatesModalOpen(true),
    },
    {
      id: 'save-template',
      label: 'Save as Template',
      shortcut: 'S',
      icon: <Save size={16} />,
      run: openSaveTemplateModal,
    },
    {
      id: 'new-collection',
      label: 'Create Collection',
      shortcut: 'C',
      icon: <FolderPlus size={16} />,
      run: openCreateCollectionModal,
    },
    {
      id: 'publish',
      label: activeDocument?.published ? 'Unpublish' : 'Publish to Web',
      shortcut: 'P',
      icon: <Globe size={16} />,
      run: () => updateActiveDocument((doc) => ({ ...doc, published: !doc.published, updatedAt: 'Just now' })),
    },
    {
      id: 'export',
      label: activeDocument?.editorMode === 'code' ? 'Export Source File' : 'Export as Markdown',
      shortcut: 'E',
      icon: <Download size={16} />,
      run: () => exportDocument(activeDocument?.editorMode === 'code' ? 'code' : 'md'),
    },
    ...(activeDocument?.editorMode === 'code'
      ? [{
          id: 'run-code',
          label: 'Run Code',
          shortcut: '⌘↵',
          icon: <Play size={16} />,
          run: runActiveCode,
        }]
      : []),
    {
      id: 'settings',
      label: 'Editor Preferences',
      shortcut: ',',
      icon: <Settings size={16} />,
      run: () => setIsEditorSettingsOpen(true),
    },
  ];

  const visibleQuickActions = quickActions.filter((action) =>
    action.label.toLowerCase().includes(quickSearch.trim().toLowerCase()),
  );

  const hasWorkspaceName = workspaceName.length > 0;
  const hasAtLeastOneCollection = collections.length > 0;
  const hasAtLeastOneFile = documents.some((doc) => !doc.trashed);
  const onboardingReady = hasWorkspaceName && hasAtLeastOneCollection && hasAtLeastOneFile;

  const completeOnboarding = () => {
    if (!onboardingReady) return;
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsOnboardingOpen(false);
  };

  const breadcrumbs: BreadcrumbItem[] = useMemo(() => {
    if (activeView === 'editor') {
      if (activeDocument) {
        return [
          { label: 'Drafts', onClick: () => setActiveView('drafts') },
          { label: activeDocument.title || 'Untitled' },
        ];
      }
      return [{ label: 'Drafts' }];
    }

    if (activeView === 'drafts') {
      return [{ label: 'Drafts' }];
    }

    if (activeView === 'collection') {
      return [
        { label: 'Drafts', onClick: () => setActiveView('drafts') },
        { label: activeCollection ?? 'Collection' },
      ];
    }

    return [
      { label: 'Drafts', onClick: () => setActiveView('drafts') },
      { label: activeView.charAt(0).toUpperCase() + activeView.slice(1) },
    ];
  }, [activeCollection, activeDocument, activeView]);

  const renderedMarkdown = useMemo(() => {
    if (!activeDocument || activeDocument.editorMode === 'code') return '';
    const source = activeDocument.content.replace(/^#\s+.*(?:\r?\n|$)/, '');
    const html = marked.parse(source, { gfm: true, breaks: true }) as string;
    return DOMPurify.sanitize(html);
  }, [activeDocument]);

  const renderContent = () => {
    if (activeView !== 'editor') {
      return (
        <ListView
          type={activeView === 'collection' ? (activeCollection ?? 'Collection') : activeView}
          documents={filteredDocuments}
          collections={collections}
          onBack={() => setActiveView('editor')}
          onOpenDocument={(id) => {
            setActiveDocumentId(id);
            setActiveView('editor');
            setActiveTab('editor');
          }}
          onArchiveDocument={archiveDocument}
          onDeleteDocument={deleteDocument}
          onMoveDocument={moveDocumentToCollection}
        />
      );
    }

    if (!activeDocument) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#fcfcfc]">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-center space-y-4">
            <h2 className="text-xl font-bold text-gray-900">No file selected</h2>
            <p className="text-sm text-gray-500">Create a new file to start writing.</p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => createDocument('rich')}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800"
              >
                Create First File
              </button>
              <button
                onClick={() => setIsTemplatesModalOpen(true)}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50"
              >
                Use Template
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'editor' ? (
          activeDocument.editorMode === 'code' ? (
            <CodeEditor
              content={activeDocument.content}
              setContent={updateContent}
              language={activeDocument.codeLanguage}
              onLanguageChange={updateCodeLanguage}
              darkMode={darkMode}
              onRun={runActiveCode}
              onClearOutput={clearActiveTerminal}
              terminalStatus={terminalByDocument[activeDocument.id]?.status ?? 'idle'}
              terminalOutput={terminalByDocument[activeDocument.id]?.output ?? ''}
              terminalTimestamp={terminalByDocument[activeDocument.id]?.ranAt ?? ''}
            />
          ) : (
            <DocumentEditor
              content={activeDocument.content}
              setContent={updateContent}
              darkMode={darkMode}
              typographyClassName={`${editorFontClass} ${editorFontSizeClass} ${editorLineHeightClass}`}
            />
          )
        ) : (
          <div className="flex-1 overflow-y-auto bg-[#fcfcfc] flex justify-center py-12 px-6">
            <div className={`w-full ${activeDocument.editorMode === 'code' ? 'max-w-5xl' : 'max-w-3xl'}`}>
              <h1 className="text-4xl font-bold mb-8">{activeDocument.title}</h1>
              {activeDocument.editorMode === 'code' ? (
                <pre className="text-sm leading-6 font-mono bg-white border border-gray-200 rounded-xl p-6 overflow-x-auto text-gray-800">
                  {activeDocument.content}
                </pre>
              ) : (
                <article
                  className={`text-gray-700 ${editorFontClass} ${editorFontSizeClass} ${editorLineHeightClass} space-y-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_pre]:bg-white [&_pre]:border [&_pre]:border-gray-200 [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:overflow-x-auto [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_blockquote]:border-l-4 [&_blockquote]:border-gray-200 [&_blockquote]:pl-4 [&_blockquote]:text-gray-600 [&_a]:text-blue-600 [&_a]:underline`}
                  dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
                />
              )}
            </div>
          </div>
        )}
        <RightPanel
          doc={activeDocument}
          primaryStatLabel={primaryStatLabel}
          primaryStatValue={primaryStatValue}
          secondaryStatLabel={secondaryStatLabel}
          secondaryStatValue={secondaryStatValue}
          onAddTag={(tag) => updateActiveDocument((doc) => ({ ...doc, tags: [...doc.tags, { ...tag, id: `tag-${Date.now()}` }] }))}
          onRemoveTag={(tagId) => updateActiveDocument((doc) => ({ ...doc, tags: doc.tags.filter((tag) => tag.id !== tagId) }))}
          onSetPublicVisibility={(enabled) => updateActiveDocument((doc) => ({ ...doc, publicVisibility: enabled }))}
          onSetTeamAccess={(enabled) => updateActiveDocument((doc) => ({ ...doc, teamAccess: enabled }))}
          onRequestReview={() =>
            updateActiveDocument((doc) => ({
              ...doc,
              tags: doc.tags.some((tag) => tag.label.toLowerCase() === 'review')
                ? doc.tags
                : [...doc.tags, { id: `tag-${Date.now()}`, label: 'Review', color: 'red' }],
              activity: [{ id: `evt-${Date.now()}`, actor: CURRENT_USER_NAME, action: 'requested review', timestamp: 'Just now' }, ...doc.activity].slice(0, 5),
            }))
          }
        />
      </div>
    );
  };

  return (
    <div className={`flex h-screen overflow-hidden ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'} ${appFontClass}`}>
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        activeView={activeView}
        workspaceName={workspaceName || 'Workspace'}
        collections={collections}
        activeCollection={activeCollection}
        onViewChange={setActiveView}
        onCreateDraftClick={() => createDocument('rich')}
        onCollectionSelect={(name) => {
          setActiveCollection(name);
          setActiveView('collection');
        }}
        onCreateCollectionClick={openCreateCollectionModal}
        onWorkspaceClick={(e) => {
          e.stopPropagation();
          setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen);
        }}
        onQuickActionsClick={() => setIsQuickActionsOpen(true)}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative transition-all duration-300">
        <TopBar
          title={activeDocument?.title ?? ''}
          onTitleChange={updateTitle}
          editorMode={activeDocument?.editorMode ?? 'rich'}
          onEditorModeChange={updateEditorMode}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeView={activeView}
          breadcrumbs={breadcrumbs}
          statusLabel={statusLabel}
          onExportClick={() => setIsExportModalOpen(true)}
          onShareClick={() => setIsShareModalOpen(true)}
          onSettingsClick={() => setIsEditorSettingsOpen(true)}
          onOpenTemplates={() => setIsTemplatesModalOpen(true)}
          onSaveTemplateClick={openSaveTemplateModal}
          hasActiveDocument={Boolean(activeDocument)}
        />

        {renderContent()}
      </main>

      {isWorkspaceMenuOpen && (
        <div
          className="absolute top-14 left-4 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-gray-50 mb-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Workspaces</span>
          </div>
          <div className="px-2 space-y-0.5">
            {workspaces.map((workspace) => {
              const isActive = workspace.id === activeWorkspaceId;
              return (
                <button
                  key={workspace.id}
                  onClick={() => setActiveWorkspaceId(workspace.id)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg border cursor-pointer text-left ${isActive ? 'bg-gray-50 border-gray-100' : 'border-transparent hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-[10px] font-bold">{(workspace.name[0] ?? 'w').toLowerCase()}</div>
                    <span className="text-sm font-semibold">{workspace.name || 'Workspace'}</span>
                  </div>
                  {isActive ? <Check size={14} className="text-blue-600" /> : null}
                </button>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-50 px-2 space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest" htmlFor="new-workspace-name">Add workspace</label>
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                addWorkspace(newWorkspaceName);
              }}
            >
              <input
                id="new-workspace-name"
                type="text"
                value={newWorkspaceName}
                onChange={(e) => {
                  setNewWorkspaceName(e.target.value);
                  if (newWorkspaceError) setNewWorkspaceError('');
                }}
                placeholder="Workspace name"
                className={`w-full px-2.5 py-2 border rounded-lg text-sm outline-none ${newWorkspaceError ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-200 focus:ring-2 focus:ring-blue-500'}`}
              />
              {newWorkspaceError ? <p className="text-xs text-red-600">{newWorkspaceError}</p> : null}
              <button
                type="submit"
                className="w-full px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800"
              >
                Add Workspace
              </button>
            </form>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-50 px-2 space-y-0.5">
            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer text-red-600 group">
              <LogOut size={16} />
              <span className="text-sm font-medium">Log out</span>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={isEditorSettingsOpen} onClose={() => setIsEditorSettingsOpen(false)} title="Editor Settings">
        <div className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Typography</h4>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Font Family</p>
                <div className="grid grid-cols-2 gap-3">
                  {FONT_FAMILY_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setFontFamily(option.id)}
                      className={`flex items-center justify-between px-3 py-2 border rounded-lg text-sm font-medium ${fontFamily === option.id ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                    >
                      <div className="flex items-center gap-2"><Type size={16} /> {option.label}</div>
                      {fontFamily === option.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Font Size</p>
                <div className="grid grid-cols-3 gap-3">
                  {FONT_SIZE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setFontSize(option.id)}
                      className={`flex items-center justify-between px-3 py-2 border rounded-lg text-sm font-medium ${fontSize === option.id ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                    >
                      <span>{option.label}</span>
                      {fontSize === option.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Line Height</p>
                <div className="grid grid-cols-3 gap-3">
                  {LINE_HEIGHT_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setLineHeight(option.id)}
                      className={`flex items-center justify-between px-3 py-2 border rounded-lg text-sm font-medium ${lineHeight === option.id ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                    >
                      <span>{option.label}</span>
                      {lineHeight === option.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Appearance</h4>
            <button onClick={() => setDarkMode(!darkMode)} className="w-full flex items-center justify-between p-3 border border-gray-100 rounded-lg">
              <div className="flex items-center gap-3">
                <Palette size={18} className="text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-bold">Dark Mode</p>
                  <p className="text-xs text-gray-500">Toggle editor theme</p>
                </div>
              </div>
              <div className={`w-9 h-5 rounded-full relative ${darkMode ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${darkMode ? 'right-0.5' : 'left-0.5'}`}></div>
              </div>
            </button>
          </div>
          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
            <button onClick={() => setIsEditorSettingsOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-900">Close</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Export Document">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 mb-4">Choose a format to export your document.</p>
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: 'pdf', label: 'Print as PDF', icon: <FileText className="text-red-500" /> },
              { id: 'md', label: 'Markdown (.md)', icon: <Zap className="text-yellow-600" /> },
              { id: 'html', label: 'Web Page (.html)', icon: <Globe className="text-blue-500" /> },
              { id: 'txt', label: 'Plain Text (.txt)', icon: <Type className="text-gray-500" /> },
              { id: 'code', label: 'Source file', icon: <Code2 className="text-blue-500" /> },
            ].map((format) => (
              <button
                key={format.id}
                onClick={() => exportDocument(format.id as 'pdf' | 'md' | 'html' | 'txt' | 'code')}
                className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white border border-gray-100 rounded-lg shadow-sm">{format.icon}</div>
                  <span className="text-sm font-medium text-gray-700">{format.label}</span>
                </div>
                <Download size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
              </button>
            ))}
          </div>
          <div className="pt-4 flex justify-end">
            <button onClick={() => setIsExportModalOpen(false)} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold">Close</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isTemplatesModalOpen} onClose={() => setIsTemplatesModalOpen(false)} title="Document Templates">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Create a new document from a reusable template.</p>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {templates.map((template) => (
              <div key={template.id} className="rounded-xl border border-gray-200 p-3 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {template.editorMode === 'code' ? 'Code template' : 'Writing template'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => createFromTemplate(template.id)}
                      className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-800"
                    >
                      Use
                    </button>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="px-2.5 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-600 line-clamp-3 whitespace-pre-wrap">
                  {template.content.trim() || '(empty template content)'}
                </p>
              </div>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No templates yet. Save a document as template to get started.</p>
            )}
          </div>
        </div>
      </Modal>

      <Modal isOpen={isSaveTemplateModalOpen} onClose={() => setIsSaveTemplateModalOpen(false)} title="Save as Template">
        {!activeDocument ? (
          <p className="text-sm text-gray-500">Open a document to save it as a template.</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveActiveDocumentAsTemplate();
            }}
          >
            <p className="text-sm text-gray-500">Save this document structure so you can reuse it later.</p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider" htmlFor="template-name-input">
                Template name
              </label>
              <input
                id="template-name-input"
                autoFocus
                type="text"
                value={templateNameDraft}
                onChange={(e) => {
                  setTemplateNameDraft(e.target.value);
                  if (templateNameError) setTemplateNameError('');
                }}
                placeholder="e.g. Weekly Status Update"
                className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors ${
                  templateNameError
                    ? 'border-red-300 ring-2 ring-red-100'
                    : 'border-gray-200 focus:ring-2 focus:ring-blue-500'
                }`}
              />
              {templateNameError ? <p className="text-xs text-red-600">{templateNameError}</p> : null}
            </div>
            <div className="pt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSaveTemplateModalOpen(false)}
                className="px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800"
              >
                Save Template
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isQuickActionsOpen} onClose={() => setIsQuickActionsOpen(false)} title="Command Palette">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              autoFocus
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              aria-label="Search commands"
              className="w-full pl-10 pr-4 py-3 border-none bg-gray-50 rounded-xl text-base focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Editor Actions</p>
            {visibleQuickActions.map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group"
                onClick={() => {
                  action.run();
                  setIsQuickActionsOpen(false);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="text-gray-400 group-hover:text-blue-600 transition-colors">{action.icon}</div>
                  <span className="text-sm font-medium text-gray-700">{action.label}</span>
                </div>
                <span className="px-1.5 py-0.5 border border-gray-200 rounded text-[10px] font-bold text-gray-400 bg-white">{action.shortcut}</span>
              </div>
            ))}
            {visibleQuickActions.length === 0 && <p className="text-sm text-gray-400 px-1 py-2">No actions match your search.</p>}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isCreateCollectionModalOpen}
        onClose={() => {
          setIsCreateCollectionModalOpen(false);
          setNewCollectionError('');
        }}
        title="Create Collection"
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-slate-50 to-white p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <FolderPlus size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">New collection</p>
                <p className="text-xs text-gray-500">Use collections to group related notes and files.</p>
              </div>
            </div>
          </div>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submitCreateCollection();
            }}
          >
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider" htmlFor="new-collection-name">
              Collection name
            </label>
            <input
              id="new-collection-name"
              autoFocus
              type="text"
              value={newCollectionName}
              onChange={(e) => {
                setNewCollectionName(e.target.value);
                if (newCollectionError) setNewCollectionError('');
              }}
              placeholder="e.g. Product Docs"
              className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors ${
                newCollectionError
                  ? 'border-red-300 ring-2 ring-red-100'
                  : 'border-gray-200 focus:ring-2 focus:ring-blue-500'
              }`}
            />
            {newCollectionError && <p className="text-xs text-red-600">{newCollectionError}</p>}

            <div className="pt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateCollectionModalOpen(false)}
                className="px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800"
              >
                Create Collection
              </button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="Collaborate">
        {!activeDocument ? (
          <p className="text-sm text-gray-500">Create a file first to share it with collaborators.</p>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Add collaborators</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    aria-label="Collaborator email"
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <button onClick={addCollaborator} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                  Invite
                </button>
              </div>
              {shareFeedback && <p className="text-xs text-gray-500">{shareFeedback}</p>}
            </div>
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Manage Access</label>
              {activeDocument.collaborators.map((person) => (
                <div key={person.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">{person.name[0]}</div>
                    <div>
                      <p className="text-sm font-bold">{person.name}{person.role === 'owner' ? ' (You)' : ''}</p>
                      <p className="text-xs text-gray-500">{person.role}</p>
                    </div>
                  </div>
                  <Shield size={16} className="text-gray-300" />
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-gray-100">
              <button onClick={copyShareLink} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
                <LinkIcon size={16} />
                <span>Copy shareable link</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isOnboardingOpen}
        onClose={() => {
          if (onboardingReady) {
            completeOnboarding();
          }
        }}
        title="Workspace Setup"
      >
        <div className="space-y-6">
          <p className="text-sm text-gray-600">Complete this setup to continue: name your workspace, create a collection, then create your first file.</p>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              {hasWorkspaceName ? <Check size={16} className="text-green-600" /> : <span className="w-4 h-4 rounded-full border border-gray-300 inline-block" />}
              1. Name your workspace
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={workspaceDraft}
                onChange={(e) => setWorkspaceDraft(e.target.value)}
                placeholder="Workspace name"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                onClick={() => renameActiveWorkspace(workspaceDraft)}
                className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold"
              >
                Save
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              {hasAtLeastOneCollection ? <Check size={16} className="text-green-600" /> : <span className="w-4 h-4 rounded-full border border-gray-300 inline-block" />}
              2. Create at least one collection
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={collectionDraft}
                onChange={(e) => setCollectionDraft(e.target.value)}
                placeholder="Collection name"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                onClick={() => {
                  const result = createCollection(collectionDraft);
                  if (result.ok) {
                    setCollectionDraft('');
                  }
                }}
                className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold"
              >
                Create
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              {hasAtLeastOneFile ? <Check size={16} className="text-green-600" /> : <span className="w-4 h-4 rounded-full border border-gray-300 inline-block" />}
              3. Create your first file
            </div>
            <button
              onClick={() => createDocument('rich', collections[0])}
              disabled={!hasAtLeastOneCollection}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create First File
            </button>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={completeOnboarding}
              disabled={!onboardingReady}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Finish Setup
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default App;
