export interface CtxConfig {
  projectName: string;
  projectType: 'node' | 'python' | 'unknown';
  entryPoints: string[];
  ignore: string[];
  framework: string | null;
}

export interface FileEntry {
  path: string;
  type: 'file' | 'dir';
  size: number;
}

export interface DepEdge {
  from: string;
  to: string;
  kind: 'static' | 'dynamic';
}

export interface DepGraph {
  nodes: string[];
  edges: DepEdge[];
}

export interface RouteInfo {
  method: string;
  path: string;
  file: string;
}

export interface PatternInfo {
  entryPoints: string[];
  framework: string | null;
  routes: RouteInfo[];
  testDirs: string[];
  configFiles: string[];
}

export interface Snapshot {
  timestamp: string;
  tree: FileEntry[];
  deps: DepGraph;
  patterns: PatternInfo;
}

export interface Decision {
  timestamp: string;
  message: string;
  files: string[];
}

export interface StatusReport {
  snapshot: Snapshot | null;
  uncommittedFiles: string[];
  pendingChanges: number;
  decisionCount: number;
  lastScan: string | null;
}
