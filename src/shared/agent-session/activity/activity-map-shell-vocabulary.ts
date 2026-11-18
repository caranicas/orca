// Adapted from lot-map 09f6b93, Copyright (c) 2026 Aleksei Volodin; MIT, see lot-map-LICENSE.txt.
export const FILE_WORDS = new Set([
  'cat',
  'head',
  'tail',
  'sed',
  'grep',
  'rg',
  'find',
  'ls',
  'wc',
  'cp',
  'mv',
  'mkdir',
  'touch',
  'diff',
  'cmp',
  'sort',
  'uniq',
  'cut',
  'tr',
  'awk',
  'tee',
  'stat',
  'file',
  'du',
  'tree',
  'ln',
  'basename',
  'dirname',
  'realpath',
  'jq',
  'rm',
  'rmdir'
])
export const NEUTRAL_WORDS = new Set([
  'echo',
  'printf',
  'cd',
  'export',
  'true',
  'set',
  'pwd',
  'sleep',
  'which',
  'test',
  '['
])
export const NET_WORDS = new Set([
  'curl',
  'wget',
  'gh',
  'ssh',
  'scp',
  'sftp',
  'ftp',
  'rsync',
  'nc',
  'ncat',
  'telnet',
  'ping',
  'dig',
  'nslookup'
])

export const NET_SUBCOMMANDS: Record<string, ReadonlySet<string>> = {
  git: new Set(['push', 'pull', 'fetch', 'clone', 'ls-remote']),
  npm: new Set(['install', 'i', 'ci', 'add', 'update', 'publish', 'view', 'audit']),
  pnpm: new Set(['install', 'i', 'add', 'update', 'publish', 'dlx']),
  yarn: new Set(['install', 'add', 'upgrade', 'publish', 'dlx']),
  bun: new Set(['install', 'add', 'update', 'publish']),
  pip: new Set(['install', 'download']),
  pip3: new Set(['install', 'download']),
  pipx: new Set(['install', 'upgrade', 'upgrade-all', 'run']),
  uv: new Set(['add', 'sync', 'lock', 'publish', 'tool install']),
  poetry: new Set(['install', 'add', 'update', 'lock', 'publish']),
  docker: new Set(['pull', 'push', 'login']),
  'docker compose': new Set(['pull', 'push']),
  brew: new Set(['install', 'update', 'upgrade', 'fetch']),
  cargo: new Set(['install', 'fetch', 'publish', 'update']),
  go: new Set(['get', 'install', 'mod download']),
  apt: new Set(['install', 'update', 'upgrade', 'full-upgrade', 'dist-upgrade']),
  'apt-get': new Set(['install', 'update', 'upgrade', 'dist-upgrade'])
}

export const PY_MODULES = new Set(['pip', 'uv', 'pipx', 'poetry'])

export const WRAPPERS: Record<
  string,
  { takes?: readonly string[]; skip?: number; asks?: readonly string[] }
> = {
  sudo: { takes: ['-u', '-g', '-p', '-h', '-C', '-D', '-R', '-T', '-U', '-r', '-t'] },
  doas: { takes: ['-u', '-C'] },
  env: { takes: ['-u', '-C'] },
  time: {},
  timeout: { takes: ['-s', '-k'], skip: 1 },
  nohup: {},
  nice: { takes: ['-n'] },
  ionice: { takes: ['-c', '-n'] },
  stdbuf: { takes: ['-i', '-o', '-e'] },
  caffeinate: { takes: ['-t', '-w'] },
  command: { asks: ['-v', '-V'] },
  exec: { takes: ['-a'] },
  xargs: { takes: ['-n', '-I', '-P', '-L', '-d', '-E', '-s', '-a', '-J', '-R'] }
}
export const ASSIGNMENT = /^[A-Za-z_]\w*=/

export const GIT_TAKES = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--exec-path',
  '--config-env'
])
export const DOCKER_TAKES = new Set([
  '-c',
  '--context',
  '-H',
  '--host',
  '--config',
  '-l',
  '--log-level',
  '-f',
  '--file',
  '-p',
  '--project-name',
  '--profile',
  '--env-file',
  '--project-directory'
])

export const RUNNERS = new Set(['python', 'python3', 'bash', 'sh', 'zsh', 'node'])

export const PS_FILE_WORDS = new Set([
  'get-content',
  'gc',
  'type',
  'set-content',
  'add-content',
  'out-file',
  'get-childitem',
  'gci',
  'dir',
  'get-item',
  'gi',
  'select-string',
  'sls',
  'copy-item',
  'cpi',
  'copy',
  'move-item',
  'mi',
  'move',
  'rename-item',
  'rni',
  'ren',
  'new-item',
  'ni',
  'md',
  'test-path',
  'resolve-path',
  'get-filehash'
])
export const PS_NEUTRAL_WORDS = new Set([
  'write-host',
  'write-output',
  'set-location',
  'sl',
  'get-location',
  'gl',
  'start-sleep',
  'select-object',
  'select',
  'where-object',
  'where',
  '?',
  'foreach-object',
  'foreach',
  '%',
  'sort-object',
  'measure-object',
  'measure',
  'format-table',
  'ft',
  'format-list',
  'fl',
  'out-string',
  'out-null'
])
export const PS_NET_WORDS = new Set([
  'invoke-webrequest',
  'iwr',
  'invoke-restmethod',
  'irm',
  'test-connection',
  'test-netconnection',
  'resolve-dnsname',
  'start-bitstransfer'
])
