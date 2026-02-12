
export interface DocumentTag {
  id: string;
  label: string;
  color: 'blue' | 'orange' | 'purple' | 'red' | 'gray' | 'green';
}

export interface ActivityEvent {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
}

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
}

export type EditorMode = 'rich' | 'code';

export type CodeLanguage =
  | 'plaintext'
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'json'
  | 'html'
  | 'css'
  | 'markdown'
  | 'bash'
  | 'mips';

export interface DocumentMetadata {
  id: string;
  title: string;
  content: string;
  editorMode: EditorMode;
  codeLanguage: CodeLanguage;
  collection: string;
  owner: string;
  starred: boolean;
  archived: boolean;
  trashed: boolean;
  published: boolean;
  publicVisibility: boolean;
  teamAccess: boolean;
  updatedAt: string;
  tags: DocumentTag[];
  collaborators: Collaborator[];
  activity: ActivityEvent[];
}

export interface DocumentTemplate {
  id: string;
  name: string;
  title: string;
  content: string;
  editorMode: EditorMode;
  codeLanguage: CodeLanguage;
  tags: DocumentTag[];
  createdAt: string;
  updatedAt: string;
}
