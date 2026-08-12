/**
 * seed.js — Idempotent seed for OSS Supply-Chain Trust Graph
 *
 * Rules:
 * - MERGE everywhere (never CREATE) — safe to run multiple times
 * - Parameterized queries only — never string-concatenated Cypher
 * - Realistic-scale: 45 packages, 50 developers, 18 repos, 6 orgs
 * - 3 engineered bus-factor developers (4–6 unrelated critical packages each)
 * - 1 dependency chain exactly 5 hops deep for Query 1 demonstration
 *
 * Usage: node seed.js (from /scripts directory with .env configured)
 */

import neo4j from 'neo4j-driver';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Connection ─────────────────────────────────────────────────────────────────
const uri = process.env.COGNODB_URI;
const user = process.env.COGNODB_USER;
const password = process.env.COGNODB_PASSWORD;

if (!uri || !user || !password) {
  console.error('ERROR: Set COGNODB_URI, COGNODB_USER, COGNODB_PASSWORD in .env');
  process.exit(1);
}

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

async function run(session, query, params = {}) {
  return session.run(query, params);
}

// ── Data ───────────────────────────────────────────────────────────────────────

const organizations = [
  { id: 'org-facebook',   name: 'Facebook (Meta)' },
  { id: 'org-psf',        name: 'Python Software Foundation' },
  { id: 'org-expressjs',  name: 'expressjs' },
  { id: 'org-sindresorhus', name: 'sindresorhus' },
  { id: 'org-wexa',       name: 'Wexa AI' },
  { id: 'org-acme',       name: 'Acme Corp' },
];

const repositories = [
  { id: 'repo-lodash',       name: 'lodash',         url: 'https://github.com/lodash/lodash',           stars: 58900, description: 'A modern JavaScript utility library delivering modularity, performance & extras.', orgId: null },
  { id: 'repo-chalk',        name: 'chalk',          url: 'https://github.com/chalk/chalk',             stars: 21800, description: 'Terminal string styling done right', orgId: 'org-sindresorhus' },
  { id: 'repo-express',      name: 'express',        url: 'https://github.com/expressjs/express',       stars: 64000, description: 'Fast, unopinionated, minimalist web framework for node.', orgId: 'org-expressjs' },
  { id: 'repo-axios',        name: 'axios',          url: 'https://github.com/axios/axios',             stars: 104000, description: 'Promise based HTTP client for the browser and node.js', orgId: null },
  { id: 'repo-webpack',      name: 'webpack',        url: 'https://github.com/webpack/webpack',         stars: 64500, description: 'A bundler for javascript and friends.', orgId: null },
  { id: 'repo-react',        name: 'react',          url: 'https://github.com/facebook/react',          stars: 225000, description: 'The library for web and native user interfaces.', orgId: 'org-facebook' },
  { id: 'repo-requests',     name: 'requests',       url: 'https://github.com/psf/requests',            stars: 52000, description: 'A simple, yet elegant, HTTP library.', orgId: 'org-psf' },
  { id: 'repo-numpy',        name: 'numpy',          url: 'https://github.com/numpy/numpy',             stars: 27000, description: 'The fundamental package for scientific computing with Python.', orgId: null },
  { id: 'repo-django',       name: 'django',         url: 'https://github.com/django/django',           stars: 80000, description: 'The Web framework for perfectionists with deadlines.', orgId: null },
  { id: 'repo-flask',        name: 'flask',          url: 'https://github.com/pallets/flask',           stars: 68000, description: 'The Python micro framework for building web applications.', orgId: null },
  { id: 'repo-commander',    name: 'commander.js',   url: 'https://github.com/tj/commander.js',         stars: 26500, description: 'Node.js command-line interfaces made easy', orgId: null },
  { id: 'repo-yargs',        name: 'yargs',          url: 'https://github.com/yargs/yargs',             stars: 11000, description: 'yargs the modern, pirate-themed successor to optimist.', orgId: null },
  { id: 'repo-moment',       name: 'moment',         url: 'https://github.com/moment/moment',           stars: 47900, description: 'Parse, validate, manipulate, and display dates in javascript.', orgId: null },
  { id: 'repo-jest',         name: 'jest',           url: 'https://github.com/jestjs/jest',             stars: 44100, description: 'Delightful JavaScript Testing.', orgId: 'org-facebook' },
  { id: 'repo-sqlalchemy',   name: 'sqlalchemy',     url: 'https://github.com/sqlalchemy/sqlalchemy',   stars: 9400, description: 'The Database Toolkit for Python', orgId: null },
  { id: 'repo-cryptography', name: 'cryptography',   url: 'https://github.com/pyca/cryptography',       stars: 6500, description: 'cryptography is a package designed to expose cryptographic recipes', orgId: null },
  { id: 'repo-acme-platform', name: 'acme-platform', url: 'https://github.com/acme/platform',          stars: 320, description: 'Acme Corp internal platform library', orgId: 'org-acme' },
  { id: 'repo-wexa-infra',   name: 'wexa-infra',     url: 'https://github.com/wexa-ai/infra',           stars: 87, description: 'Wexa AI infrastructure utilities', orgId: 'org-wexa' },
];

// Packages — 45 total (real + synthetic)
// npm packages
const packages = [
  // ── Real npm packages ──────────────────────────────────────────────────
  { id: 'pkg-lodash',        name: 'lodash',           ecosystem: 'npm',   version: '4.17.21', description: 'Lodash modular utilities', repoId: 'repo-lodash' },
  { id: 'pkg-chalk',         name: 'chalk',            ecosystem: 'npm',   version: '5.3.0',   description: 'Terminal string styling done right', repoId: 'repo-chalk' },
  { id: 'pkg-left-pad',      name: 'left-pad',         ecosystem: 'npm',   version: '1.3.0',   description: 'String left pad', repoId: null },
  { id: 'pkg-express',       name: 'express',          ecosystem: 'npm',   version: '4.19.2',  description: 'Fast, minimalist web framework', repoId: 'repo-express' },
  { id: 'pkg-axios',         name: 'axios',            ecosystem: 'npm',   version: '1.7.2',   description: 'Promise based HTTP client', repoId: 'repo-axios' },
  { id: 'pkg-webpack',       name: 'webpack',          ecosystem: 'npm',   version: '5.92.1',  description: 'A bundler for javascript and friends', repoId: 'repo-webpack' },
  { id: 'pkg-react',         name: 'react',            ecosystem: 'npm',   version: '18.3.1',  description: 'React is a JavaScript library for building user interfaces', repoId: 'repo-react' },
  { id: 'pkg-moment',        name: 'moment',           ecosystem: 'npm',   version: '2.30.1',  description: 'Parse, validate, manipulate, and display dates', repoId: 'repo-moment' },
  { id: 'pkg-commander',     name: 'commander',        ecosystem: 'npm',   version: '12.1.0',  description: 'The complete solution for node.js command-line programs', repoId: 'repo-commander' },
  { id: 'pkg-yargs',         name: 'yargs',            ecosystem: 'npm',   version: '17.7.2',  description: 'yargs the modern, pirate-themed successor to optimist', repoId: 'repo-yargs' },
  { id: 'pkg-dotenv',        name: 'dotenv',           ecosystem: 'npm',   version: '16.4.5',  description: 'Loads environment variables from .env', repoId: null },
  { id: 'pkg-cors',          name: 'cors',             ecosystem: 'npm',   version: '2.8.5',   description: 'Node.js CORS middleware', repoId: 'repo-express' },
  { id: 'pkg-body-parser',   name: 'body-parser',      ecosystem: 'npm',   version: '1.20.2',  description: 'Node.js body parsing middleware', repoId: 'repo-express' },
  { id: 'pkg-jest',          name: 'jest',             ecosystem: 'npm',   version: '29.7.0',  description: 'Delightful JavaScript Testing', repoId: 'repo-jest' },
  { id: 'pkg-mocha',         name: 'mocha',            ecosystem: 'npm',   version: '10.6.0',  description: 'Simple, flexible, fun test framework', repoId: null },
  { id: 'pkg-async',         name: 'async',            ecosystem: 'npm',   version: '3.2.5',   description: 'Higher-order functions and common patterns for async code', repoId: null },
  { id: 'pkg-bluebird',      name: 'bluebird',         ecosystem: 'npm',   version: '3.7.2',   description: 'Full featured promise library', repoId: null },
  { id: 'pkg-underscore',    name: 'underscore',       ecosystem: 'npm',   version: '1.13.6',  description: 'JavaScript utility-belt library for functional programming', repoId: null },
  { id: 'pkg-typescript',    name: 'typescript',       ecosystem: 'npm',   version: '5.5.2',   description: 'TypeScript is a language for application scale JavaScript development', repoId: null },
  { id: 'pkg-eslint',        name: 'eslint',           ecosystem: 'npm',   version: '9.6.0',   description: 'An AST-based pattern checker for JavaScript', repoId: null },
  // ── Real PyPI packages ─────────────────────────────────────────────────
  { id: 'pkg-requests',      name: 'requests',         ecosystem: 'pypi',  version: '2.32.3',  description: 'Python HTTP for Humans.', repoId: 'repo-requests' },
  { id: 'pkg-urllib3',       name: 'urllib3',          ecosystem: 'pypi',  version: '2.2.2',   description: 'HTTP library with thread-safe connection pooling', repoId: null },
  { id: 'pkg-certifi',       name: 'certifi',          ecosystem: 'pypi',  version: '2024.6.2', description: 'Python package for providing Mozilla\'s CA Bundle', repoId: null },
  { id: 'pkg-chardet',       name: 'chardet',          ecosystem: 'pypi',  version: '5.2.0',   description: 'Universal encoding detector', repoId: null },
  { id: 'pkg-idna',          name: 'idna',             ecosystem: 'pypi',  version: '3.7',     description: 'Internationalized Domain Names in Applications (IDNA)', repoId: null },
  { id: 'pkg-numpy',         name: 'numpy',            ecosystem: 'pypi',  version: '2.0.0',   description: 'Fundamental package for array computing in Python', repoId: 'repo-numpy' },
  { id: 'pkg-pandas',        name: 'pandas',           ecosystem: 'pypi',  version: '2.2.2',   description: 'Powerful data structures for data analysis', repoId: null },
  { id: 'pkg-django',        name: 'Django',           ecosystem: 'pypi',  version: '5.0.6',   description: 'A high-level Python web framework', repoId: 'repo-django' },
  { id: 'pkg-flask',         name: 'Flask',            ecosystem: 'pypi',  version: '3.0.3',   description: 'A simple framework for building complex web applications', repoId: 'repo-flask' },
  { id: 'pkg-pytest',        name: 'pytest',           ecosystem: 'pypi',  version: '8.2.2',   description: 'pytest: simple powerful testing with Python', repoId: null },
  { id: 'pkg-boto3',         name: 'boto3',            ecosystem: 'pypi',  version: '1.34.140', description: 'The AWS SDK for Python', repoId: null },
  { id: 'pkg-pillow',        name: 'Pillow',           ecosystem: 'pypi',  version: '10.4.0',  description: 'Python Imaging Library (Fork)', repoId: null },
  { id: 'pkg-sqlalchemy',    name: 'SQLAlchemy',       ecosystem: 'pypi',  version: '2.0.31',  description: 'Database Abstraction Library', repoId: 'repo-sqlalchemy' },
  { id: 'pkg-pyyaml',        name: 'PyYAML',           ecosystem: 'pypi',  version: '6.0.1',   description: 'YAML parser and emitter for Python', repoId: null },
  { id: 'pkg-click',         name: 'click',            ecosystem: 'pypi',  version: '8.1.7',   description: 'Composable command line interface toolkit', repoId: null },
  { id: 'pkg-cryptography',  name: 'cryptography',     ecosystem: 'pypi',  version: '42.0.8',  description: 'cryptography is a package designed to expose cryptographic recipes', repoId: 'repo-cryptography' },
  { id: 'pkg-paramiko',      name: 'paramiko',         ecosystem: 'pypi',  version: '3.4.0',   description: 'SSH2 protocol library', repoId: null },
  // ── Synthetic packages (for engineering interesting cases) ─────────────
  { id: 'pkg-acme-auth',     name: '@acme/auth-core',  ecosystem: 'npm',   version: '2.1.0',   description: 'Acme Corp authentication core library', repoId: 'repo-acme-platform' },
  { id: 'pkg-acme-crypto',   name: '@acme/crypto-utils', ecosystem: 'npm', version: '1.4.2',   description: 'Acme Corp cryptographic utilities', repoId: 'repo-acme-platform' },
  { id: 'pkg-acme-logger',   name: '@acme/logger',     ecosystem: 'npm',   version: '3.0.1',   description: 'Acme Corp structured logging library', repoId: 'repo-acme-platform' },
  { id: 'pkg-neo-cache',     name: 'neo-cache',        ecosystem: 'npm',   version: '0.9.5',   description: 'High-performance in-memory caching layer', repoId: null },
  { id: 'pkg-supply-validator', name: 'supply-validator', ecosystem: 'npm', version: '1.2.0',  description: 'Package integrity validation utilities', repoId: null },
  { id: 'pkg-dep-tracker',   name: 'dep-tracker',      ecosystem: 'npm',   version: '0.6.3',   description: 'Dependency metadata tracker', repoId: null },
  { id: 'pkg-wexa-core',     name: 'wexa-core',        ecosystem: 'npm',   version: '4.0.0',   description: 'Wexa AI core platform utilities', repoId: 'repo-wexa-infra' },
  { id: 'pkg-six',           name: 'six',              ecosystem: 'pypi',  version: '1.16.0',  description: 'Python 2 and 3 compatibility utilities', repoId: null },
];

// ── Developers (50 total) ──────────────────────────────────────────────────────
// ★ 3 engineered bus-factor developers marked with [BUS-FACTOR]
const developers = [
  // [BUS-FACTOR #1] ghost-maintainer: maintains lodash, chalk, left-pad, commander, yargs, underscore
  { id: 'dev-ghost',       username: 'ghost-maintainer',  name: 'Jordan Ghost',    github_url: 'https://github.com/ghost-maintainer' },
  // [BUS-FACTOR #2] pypi-overlord: maintains requests, urllib3, certifi, chardet, idna (urllib3 stack)
  { id: 'dev-pyoverlord',  username: 'pypi-overlord',     name: 'Priya Overlord',  github_url: 'https://github.com/pypi-overlord' },
  // [BUS-FACTOR #3] fullstack-solo: maintains express, body-parser, cors, dotenv, @acme/auth-core
  { id: 'dev-fsolo',       username: 'fullstack-solo',    name: 'Felix Solo',      github_url: 'https://github.com/fullstack-solo' },
  // Regular contributors
  { id: 'dev-jdalton',     username: 'jdalton',           name: 'John-David Dalton', github_url: 'https://github.com/jdalton' },
  { id: 'dev-sindre',      username: 'sindresorhus',      name: 'Sindre Sorhus',   github_url: 'https://github.com/sindresorhus' },
  { id: 'dev-tj',          username: 'tj',                name: 'TJ Holowaychuk',  github_url: 'https://github.com/tj' },
  { id: 'dev-yyx',         username: 'yyx990803',         name: 'Evan You',        github_url: 'https://github.com/yyx990803' },
  { id: 'dev-gaearon',     username: 'gaearon',           name: 'Dan Abramov',     github_url: 'https://github.com/gaearon' },
  { id: 'dev-nicolo',      username: 'nicolo-ribaudo',    name: 'Nicolò Ribaudo',  github_url: 'https://github.com/nicolo-ribaudo' },
  { id: 'dev-kettanaito',  username: 'kettanaito',        name: 'Artem Zakharchenko', github_url: 'https://github.com/kettanaito' },
  { id: 'dev-brianwhite',  username: 'brianmwhite',       name: 'Brian White',     github_url: 'https://github.com/brianmwhite' },
  { id: 'dev-ljharb',      username: 'ljharb',            name: 'Jordan Harband',  github_url: 'https://github.com/ljharb' },
  { id: 'dev-isaacs',      username: 'isaacs',            name: 'Isaac Z. Schlueter', github_url: 'https://github.com/isaacs' },
  { id: 'dev-kentcdodds',  username: 'kentcdodds',        name: 'Kent C. Dodds',   github_url: 'https://github.com/kentcdodds' },
  { id: 'dev-addyosmani',  username: 'addyosmani',        name: 'Addy Osmani',     github_url: 'https://github.com/addyosmani' },
  { id: 'dev-sophiebits',  username: 'sophiebits',        name: 'Sophie Alpert',   github_url: 'https://github.com/sophiebits' },
  { id: 'dev-sebmarkbage', username: 'sebmarkbage',       name: 'Sebastian Markbåge', github_url: 'https://github.com/sebmarkbage' },
  { id: 'dev-andrewgodwin', username: 'andrewgodwin',    name: 'Andrew Godwin',   github_url: 'https://github.com/andrewgodwin' },
  { id: 'dev-carljm',      username: 'carljm',            name: 'Carl Meyer',      github_url: 'https://github.com/carljm' },
  { id: 'dev-pfmoore',     username: 'pfmoore',           name: 'Paul Moore',      github_url: 'https://github.com/pfmoore' },
  { id: 'dev-kennethreitz', username: 'kennethreitz',    name: 'Kenneth Reitz',   github_url: 'https://github.com/kennethreitz' },
  { id: 'dev-sigmavirus',  username: 'sigmavirus24',      name: 'Ian Stapleton Cordasco', github_url: 'https://github.com/sigmavirus24' },
  { id: 'dev-ncoghlan',    username: 'ncoghlan',          name: 'Nick Coghlan',    github_url: 'https://github.com/ncoghlan' },
  { id: 'dev-pablogsal',   username: 'pablogsal',         name: 'Pablo Galindo',   github_url: 'https://github.com/pablogsal' },
  { id: 'dev-mitsuhiko',   username: 'mitsuhiko',         name: 'Armin Ronacher',  github_url: 'https://github.com/mitsuhiko' },
  { id: 'dev-dcramer',     username: 'dcramer',           name: 'David Cramer',    github_url: 'https://github.com/dcramer' },
  { id: 'dev-zzzeek',      username: 'zzzeek',            name: 'Mike Bayer',      github_url: 'https://github.com/zzzeek' },
  { id: 'dev-tjanssen',    username: 'tjanssen',          name: 'Tobias Janssen',  github_url: 'https://github.com/tjanssen' },
  { id: 'dev-nosklo',      username: 'nosklo',            name: 'Nosklo',          github_url: 'https://github.com/nosklo' },
  { id: 'dev-realpython',  username: 'real-python',       name: 'Real Python',     github_url: 'https://github.com/realpython' },
  { id: 'dev-pcaro90',     username: 'pcaro90',           name: 'Pablo Caro',      github_url: 'https://github.com/pcaro90' },
  { id: 'dev-brettcannon', username: 'brettcannon',       name: 'Brett Cannon',    github_url: 'https://github.com/brettcannon' },
  { id: 'dev-terryjreedy', username: 'terryjreedy',       name: 'Terry Jan Reedy', github_url: 'https://github.com/terryjreedy' },
  { id: 'dev-vstinner',    username: 'vstinner',          name: 'Victor Stinner',  github_url: 'https://github.com/vstinner' },
  { id: 'dev-lukaseder',   username: 'lukaseder',         name: 'Lukas Eder',      github_url: 'https://github.com/lukaseder' },
  { id: 'dev-lmotta',      username: 'lmotta',            name: 'Leonardo Motta',  github_url: 'https://github.com/lmotta' },
  { id: 'dev-acme-cto',    username: 'acme-cto',          name: 'Dana Chen',       github_url: 'https://github.com/acme-cto' },
  { id: 'dev-acme-lead',   username: 'acme-lead',         name: 'Rafael Torres',   github_url: 'https://github.com/acme-lead' },
  { id: 'dev-wexa-eng1',   username: 'wexa-eng1',         name: 'Aisha Patel',     github_url: 'https://github.com/wexa-eng1' },
  { id: 'dev-wexa-eng2',   username: 'wexa-eng2',         name: 'Marcus Johansson', github_url: 'https://github.com/wexa-eng2' },
  { id: 'dev-freelance1',  username: 'mxpfeil',           name: 'Max Pfeil',       github_url: 'https://github.com/mxpfeil' },
  { id: 'dev-freelance2',  username: 'anna-lena-dev',     name: 'Anna-Lena Schmidt', github_url: 'https://github.com/anna-lena-dev' },
  { id: 'dev-freelance3',  username: 'kowalczyk-dev',     name: 'Piotr Kowalczyk', github_url: 'https://github.com/kowalczyk-dev' },
  { id: 'dev-freelance4',  username: 'ng-watcher',        name: 'Nguyen Van Anh',  github_url: 'https://github.com/ng-watcher' },
  { id: 'dev-freelance5',  username: 'ruan-miguel',       name: 'Ruan Miguel',     github_url: 'https://github.com/ruan-miguel' },
  { id: 'dev-freelance6',  username: 'alisonwu',          name: 'Alison Wu',       github_url: 'https://github.com/alisonwu' },
  { id: 'dev-freelance7',  username: 'tbarros',           name: 'Tomás Barros',    github_url: 'https://github.com/tbarros' },
  { id: 'dev-freelance8',  username: 'omondierick',       name: 'Erick Omondi',    github_url: 'https://github.com/omondierick' },
  { id: 'dev-freelance9',  username: 'sveltepro',         name: 'Kirra Johnson',   github_url: 'https://github.com/sveltepro' },
  { id: 'dev-freelance10', username: 'tnzld',             name: 'Tanaka Zelda',    github_url: 'https://github.com/tnzld' },
];

// ── MAINTAINS relationships ────────────────────────────────────────────────────
// [BUS-FACTOR] relationships are explicitly marked
const maintains = [
  // ★ BUS-FACTOR #1: ghost-maintainer maintains 6 unrelated critical packages
  { devId: 'dev-ghost',      pkgId: 'pkg-lodash' },
  { devId: 'dev-ghost',      pkgId: 'pkg-chalk' },
  { devId: 'dev-ghost',      pkgId: 'pkg-left-pad' },
  { devId: 'dev-ghost',      pkgId: 'pkg-commander' },
  { devId: 'dev-ghost',      pkgId: 'pkg-yargs' },
  { devId: 'dev-ghost',      pkgId: 'pkg-underscore' },
  // ★ BUS-FACTOR #2: pypi-overlord maintains 5 packages in the requests stack
  { devId: 'dev-pyoverlord', pkgId: 'pkg-requests' },
  { devId: 'dev-pyoverlord', pkgId: 'pkg-urllib3' },
  { devId: 'dev-pyoverlord', pkgId: 'pkg-certifi' },
  { devId: 'dev-pyoverlord', pkgId: 'pkg-chardet' },
  { devId: 'dev-pyoverlord', pkgId: 'pkg-idna' },
  // ★ BUS-FACTOR #3: fullstack-solo maintains 5 unrelated npm packages
  { devId: 'dev-fsolo',      pkgId: 'pkg-express' },
  { devId: 'dev-fsolo',      pkgId: 'pkg-body-parser' },
  { devId: 'dev-fsolo',      pkgId: 'pkg-cors' },
  { devId: 'dev-fsolo',      pkgId: 'pkg-dotenv' },
  { devId: 'dev-fsolo',      pkgId: 'pkg-acme-auth' },
  // Regular maintainers (known real-world associations)
  { devId: 'dev-jdalton',    pkgId: 'pkg-lodash' },
  { devId: 'dev-sindre',     pkgId: 'pkg-chalk' },
  { devId: 'dev-tj',         pkgId: 'pkg-commander' },
  { devId: 'dev-gaearon',    pkgId: 'pkg-react' },
  { devId: 'dev-sophiebits', pkgId: 'pkg-react' },
  { devId: 'dev-sebmarkbage',pkgId: 'pkg-react' },
  { devId: 'dev-kennethreitz', pkgId: 'pkg-requests' },
  { devId: 'dev-sigmavirus',   pkgId: 'pkg-requests' },
  { devId: 'dev-mitsuhiko',  pkgId: 'pkg-flask' },
  { devId: 'dev-mitsuhiko',  pkgId: 'pkg-click' },
  { devId: 'dev-andrewgodwin', pkgId: 'pkg-django' },
  { devId: 'dev-carljm',     pkgId: 'pkg-pytest' },
  { devId: 'dev-zzzeek',     pkgId: 'pkg-sqlalchemy' },
  { devId: 'dev-ljharb',     pkgId: 'pkg-underscore' },
  { devId: 'dev-isaacs',     pkgId: 'pkg-async' },
  { devId: 'dev-kettanaito', pkgId: 'pkg-jest' },
  { devId: 'dev-brianwhite', pkgId: 'pkg-mocha' },
  { devId: 'dev-acme-cto',   pkgId: 'pkg-acme-auth' },
  { devId: 'dev-acme-cto',   pkgId: 'pkg-acme-crypto' },
  { devId: 'dev-acme-lead',  pkgId: 'pkg-acme-logger' },
  { devId: 'dev-wexa-eng1',  pkgId: 'pkg-wexa-core' },
  { devId: 'dev-wexa-eng2',  pkgId: 'pkg-neo-cache' },
  { devId: 'dev-freelance1', pkgId: 'pkg-bluebird' },
  { devId: 'dev-freelance2', pkgId: 'pkg-moment' },
  { devId: 'dev-freelance3', pkgId: 'pkg-async' },
  { devId: 'dev-freelance4', pkgId: 'pkg-dep-tracker' },
  { devId: 'dev-freelance5', pkgId: 'pkg-supply-validator' },
  { devId: 'dev-pfmoore',    pkgId: 'pkg-certifi' },
  { devId: 'dev-ncoghlan',   pkgId: 'pkg-idna' },
  { devId: 'dev-pablogsal',  pkgId: 'pkg-numpy' },
  { devId: 'dev-dcramer',    pkgId: 'pkg-boto3' },
  { devId: 'dev-freelance6', pkgId: 'pkg-pillow' },
  { devId: 'dev-freelance7', pkgId: 'pkg-pyyaml' },
  { devId: 'dev-freelance8', pkgId: 'pkg-paramiko' },
  { devId: 'dev-freelance9', pkgId: 'pkg-typescript' },
  { devId: 'dev-freelance10',pkgId: 'pkg-eslint' },
  { devId: 'dev-nosklo',     pkgId: 'pkg-six' },
  { devId: 'dev-pcaro90',    pkgId: 'pkg-pandas' },
  { devId: 'dev-lukaseder',  pkgId: 'pkg-wexa-core' },
  { devId: 'dev-lmotta',     pkgId: 'pkg-dep-tracker' },
  { devId: 'dev-nicolo',     pkgId: 'pkg-webpack' },
  { devId: 'dev-yyx',        pkgId: 'pkg-webpack' },
  { devId: 'dev-addyosmani', pkgId: 'pkg-bluebird' },
  { devId: 'dev-kentcdodds', pkgId: 'pkg-jest' },
  { devId: 'dev-brettcannon', pkgId: 'pkg-cryptography' },
  { devId: 'dev-vstinner',   pkgId: 'pkg-cryptography' },
  { devId: 'dev-terryjreedy', pkgId: 'pkg-axios' },
  { devId: 'dev-realpython', pkgId: 'pkg-boto3' },
  { devId: 'dev-tjanssen',   pkgId: 'pkg-acme-crypto' },
];

// ── DEPENDS_ON relationships ──────────────────────────────────────────────────
// ★ ENGINEERED 5-HOP CHAIN:
//   wexa-core -> @acme/auth-core -> @acme/crypto-utils -> @acme/logger -> neo-cache -> supply-validator
//   (1 hop)        (2 hops)            (3 hops)             (4 hops)      (5 hops)
const dependsOn = [
  // ── Engineered 5-hop chain ──────────────────────────────────────────────
  { fromId: 'pkg-wexa-core',       toId: 'pkg-acme-auth',      versionRange: '^2.0.0', devOnly: false },
  { fromId: 'pkg-acme-auth',       toId: 'pkg-acme-crypto',    versionRange: '^1.0.0', devOnly: false },
  { fromId: 'pkg-acme-crypto',     toId: 'pkg-acme-logger',    versionRange: '^3.0.0', devOnly: false },
  { fromId: 'pkg-acme-logger',     toId: 'pkg-neo-cache',      versionRange: '^0.9.0', devOnly: false },
  { fromId: 'pkg-neo-cache',       toId: 'pkg-supply-validator', versionRange: '^1.0.0', devOnly: false },
  // ── Additional dep chains ──────────────────────────────────────────────
  { fromId: 'pkg-express',         toId: 'pkg-body-parser',    versionRange: '^1.20.0', devOnly: false },
  { fromId: 'pkg-express',         toId: 'pkg-cors',           versionRange: '^2.8.0',  devOnly: false },
  { fromId: 'pkg-express',         toId: 'pkg-dotenv',         versionRange: '^16.0.0', devOnly: false },
  { fromId: 'pkg-axios',           toId: 'pkg-follow-redirects', versionRange: '^1.15.0', devOnly: false },
  // requests stack (mirrors real PyPI dependency structure)
  { fromId: 'pkg-requests',        toId: 'pkg-urllib3',        versionRange: '>=1.26.0', devOnly: false },
  { fromId: 'pkg-requests',        toId: 'pkg-certifi',        versionRange: '>=2017.4.17', devOnly: false },
  { fromId: 'pkg-requests',        toId: 'pkg-chardet',        versionRange: '>=3.0.2', devOnly: false },
  { fromId: 'pkg-requests',        toId: 'pkg-idna',           versionRange: '>=2.5',   devOnly: false },
  { fromId: 'pkg-paramiko',        toId: 'pkg-cryptography',   versionRange: '>=3.3',   devOnly: false },
  { fromId: 'pkg-paramiko',        toId: 'pkg-requests',       versionRange: '>=2.0.0', devOnly: false },
  { fromId: 'pkg-boto3',           toId: 'pkg-requests',       versionRange: '>=2.28.0', devOnly: false },
  { fromId: 'pkg-boto3',           toId: 'pkg-urllib3',        versionRange: '>=1.26.0', devOnly: false },
  { fromId: 'pkg-django',          toId: 'pkg-sqlalchemy',     versionRange: '>=2.0.0',  devOnly: false },
  { fromId: 'pkg-django',          toId: 'pkg-pyyaml',         versionRange: '>=5.0',    devOnly: false },
  { fromId: 'pkg-flask',           toId: 'pkg-click',          versionRange: '>=8.0',    devOnly: false },
  { fromId: 'pkg-flask',           toId: 'pkg-pyyaml',         versionRange: '>=5.0',    devOnly: false },
  { fromId: 'pkg-pandas',          toId: 'pkg-numpy',          versionRange: '>=1.26.0', devOnly: false },
  { fromId: 'pkg-pandas',          toId: 'pkg-python-dateutil', versionRange: '>=2.8.0', devOnly: false },
  { fromId: 'pkg-webpack',         toId: 'pkg-acme-logger',    versionRange: '^3.0.0',   devOnly: false },
  { fromId: 'pkg-webpack',         toId: 'pkg-async',          versionRange: '^3.0.0',   devOnly: false },
  { fromId: 'pkg-jest',            toId: 'pkg-async',          versionRange: '^3.0.0',   devOnly: true  },
  { fromId: 'pkg-jest',            toId: 'pkg-chalk',          versionRange: '^5.0.0',   devOnly: false },
  { fromId: 'pkg-mocha',           toId: 'pkg-chalk',          versionRange: '^5.0.0',   devOnly: false },
  { fromId: 'pkg-mocha',           toId: 'pkg-yargs',          versionRange: '^17.0.0',  devOnly: false },
  { fromId: 'pkg-commander',       toId: 'pkg-chalk',          versionRange: '^5.0.0',   devOnly: false },
  { fromId: 'pkg-yargs',           toId: 'pkg-lodash',         versionRange: '^4.0.0',   devOnly: false },
  { fromId: 'pkg-lodash',          toId: 'pkg-underscore',     versionRange: '^1.13.0',  devOnly: false },
  { fromId: 'pkg-bluebird',        toId: 'pkg-async',          versionRange: '^3.0.0',   devOnly: false },
  { fromId: 'pkg-moment',          toId: 'pkg-lodash',         versionRange: '^4.0.0',   devOnly: false },
  { fromId: 'pkg-dep-tracker',     toId: 'pkg-supply-validator', versionRange: '^1.0.0', devOnly: false },
  { fromId: 'pkg-dep-tracker',     toId: 'pkg-neo-cache',      versionRange: '^0.9.0',   devOnly: false },
  { fromId: 'pkg-wexa-core',       toId: 'pkg-dep-tracker',    versionRange: '^0.6.0',   devOnly: false },
  { fromId: 'pkg-sqlalchemy',      toId: 'pkg-six',            versionRange: '>=1.5.0',  devOnly: false },
  { fromId: 'pkg-cryptography',    toId: 'pkg-six',            versionRange: '>=1.5.0',  devOnly: false },
  { fromId: 'pkg-pillow',          toId: 'pkg-numpy',          versionRange: '>=1.24.0', devOnly: false },
  { fromId: 'pkg-typescript',      toId: 'pkg-eslint',         versionRange: '^9.0.0',   devOnly: true  },
  { fromId: 'pkg-react',           toId: 'pkg-jest',           versionRange: '^29.0.0',  devOnly: true  },
];

// ── CONTRIBUTES_TO relationships ──────────────────────────────────────────────
const contributesTo = [
  { devId: 'dev-ghost',       repoId: 'repo-lodash',     commits: 1847 },
  { devId: 'dev-ghost',       repoId: 'repo-chalk',      commits: 312 },
  { devId: 'dev-ghost',       repoId: 'repo-commander',  commits: 890 },
  { devId: 'dev-pyoverlord',  repoId: 'repo-requests',   commits: 2341 },
  { devId: 'dev-fsolo',       repoId: 'repo-express',    commits: 1120 },
  { devId: 'dev-fsolo',       repoId: 'repo-acme-platform', commits: 445 },
  { devId: 'dev-jdalton',     repoId: 'repo-lodash',     commits: 3200 },
  { devId: 'dev-sindre',      repoId: 'repo-chalk',      commits: 920 },
  { devId: 'dev-tj',          repoId: 'repo-commander',  commits: 1560 },
  { devId: 'dev-gaearon',     repoId: 'repo-react',      commits: 4100 },
  { devId: 'dev-sophiebits',  repoId: 'repo-react',      commits: 1800 },
  { devId: 'dev-sebmarkbage', repoId: 'repo-react',      commits: 2900 },
  { devId: 'dev-kennethreitz', repoId: 'repo-requests',  commits: 2100 },
  { devId: 'dev-sigmavirus',   repoId: 'repo-requests',  commits: 870 },
  { devId: 'dev-mitsuhiko',   repoId: 'repo-flask',      commits: 3400 },
  { devId: 'dev-andrewgodwin',repoId: 'repo-django',     commits: 2650 },
  { devId: 'dev-carljm',      repoId: 'repo-flask',      commits: 440 },
  { devId: 'dev-zzzeek',      repoId: 'repo-sqlalchemy', commits: 5100 },
  { devId: 'dev-kettanaito',  repoId: 'repo-jest',       commits: 980 },
  { devId: 'dev-kentcdodds',  repoId: 'repo-jest',       commits: 720 },
  { devId: 'dev-acme-cto',    repoId: 'repo-acme-platform', commits: 1340 },
  { devId: 'dev-acme-lead',   repoId: 'repo-acme-platform', commits: 890 },
  { devId: 'dev-wexa-eng1',   repoId: 'repo-wexa-infra', commits: 560 },
  { devId: 'dev-wexa-eng2',   repoId: 'repo-wexa-infra', commits: 330 },
  { devId: 'dev-nicolo',      repoId: 'repo-webpack',    commits: 1200 },
  { devId: 'dev-yyx',         repoId: 'repo-webpack',    commits: 890 },
  { devId: 'dev-pablogsal',   repoId: 'repo-numpy',      commits: 1700 },
  { devId: 'dev-brettcannon', repoId: 'repo-cryptography', commits: 640 },
  { devId: 'dev-freelance2',  repoId: 'repo-moment',     commits: 780 },
  { devId: 'dev-ljharb',      repoId: 'repo-yargs',      commits: 640 },
];

// ── MEMBER_OF relationships ──────────────────────────────────────────────────
const memberOf = [
  { devId: 'dev-gaearon',     orgId: 'org-facebook' },
  { devId: 'dev-sophiebits',  orgId: 'org-facebook' },
  { devId: 'dev-sebmarkbage', orgId: 'org-facebook' },
  { devId: 'dev-kennethreitz', orgId: 'org-psf' },
  { devId: 'dev-ncoghlan',    orgId: 'org-psf' },
  { devId: 'dev-brettcannon', orgId: 'org-psf' },
  { devId: 'dev-pablogsal',   orgId: 'org-psf' },
  { devId: 'dev-carljm',      orgId: 'org-psf' },
  { devId: 'dev-fsolo',       orgId: 'org-expressjs' },
  { devId: 'dev-brianwhite',  orgId: 'org-expressjs' },
  { devId: 'dev-sindre',      orgId: 'org-sindresorhus' },
  { devId: 'dev-acme-cto',    orgId: 'org-acme' },
  { devId: 'dev-acme-lead',   orgId: 'org-acme' },
  { devId: 'dev-tjanssen',    orgId: 'org-acme' },
  { devId: 'dev-wexa-eng1',   orgId: 'org-wexa' },
  { devId: 'dev-wexa-eng2',   orgId: 'org-wexa' },
  { devId: 'dev-lukaseder',   orgId: 'org-wexa' },
];

// ── OWNS relationships ──────────────────────────────────────────────────────
const orgOwns = [
  { orgId: 'org-facebook',    repoId: 'repo-react' },
  { orgId: 'org-facebook',    repoId: 'repo-jest' },
  { orgId: 'org-psf',         repoId: 'repo-requests' },
  { orgId: 'org-expressjs',   repoId: 'repo-express' },
  { orgId: 'org-sindresorhus', repoId: 'repo-chalk' },
  { orgId: 'org-acme',        repoId: 'repo-acme-platform' },
  { orgId: 'org-wexa',        repoId: 'repo-wexa-infra' },
];

// ── Seed Execution ────────────────────────────────────────────────────────────
async function seed() {
  const session = driver.session();
  let errors = 0;

  try {
    console.log('🌱 Starting seed...\n');

    // Constraints (idempotent)
    console.log('Creating constraints...');
    const constraints = [
      `CREATE CONSTRAINT IF NOT EXISTS FOR (d:Developer) REQUIRE d.id IS UNIQUE`,
      `CREATE CONSTRAINT IF NOT EXISTS FOR (p:Package) REQUIRE p.id IS UNIQUE`,
      `CREATE CONSTRAINT IF NOT EXISTS FOR (r:Repository) REQUIRE r.id IS UNIQUE`,
      `CREATE CONSTRAINT IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE`,
    ];
    for (const c of constraints) {
      await session.run(c);
    }

    // Organizations
    console.log(`Merging ${organizations.length} organizations...`);
    for (const org of organizations) {
      await session.run(
        `MERGE (o:Organization {id: $id}) SET o.name = $name`,
        { id: org.id, name: org.name }
      );
    }

    // Repositories
    console.log(`Merging ${repositories.length} repositories...`);
    for (const repo of repositories) {
      await session.run(
        `MERGE (r:Repository {id: $id})
         SET r.name = $name, r.url = $url, r.stars = $stars, r.description = $description`,
        { id: repo.id, name: repo.name, url: repo.url, stars: repo.stars, description: repo.description }
      );
    }

    // Packages
    console.log(`Merging ${packages.length} packages...`);
    for (const pkg of packages) {
      await session.run(
        `MERGE (p:Package {id: $id})
         SET p.name = $name, p.ecosystem = $ecosystem,
             p.version = $version, p.description = $description`,
        { id: pkg.id, name: pkg.name, ecosystem: pkg.ecosystem, version: pkg.version, description: pkg.description }
      );
      // PUBLISHES relationship
      if (pkg.repoId) {
        await session.run(
          `MATCH (r:Repository {id: $repoId}), (p:Package {id: $pkgId})
           MERGE (r)-[:PUBLISHES]->(p)`,
          { repoId: pkg.repoId, pkgId: pkg.id }
        );
      }
    }

    // Developers
    console.log(`Merging ${developers.length} developers...`);
    for (const dev of developers) {
      await session.run(
        `MERGE (d:Developer {id: $id})
         SET d.username = $username, d.name = $name, d.github_url = $github_url`,
        { id: dev.id, username: dev.username, name: dev.name, github_url: dev.github_url }
      );
    }

    // MAINTAINS
    console.log(`Merging ${maintains.length} MAINTAINS relationships...`);
    for (const m of maintains) {
      await session.run(
        `MATCH (d:Developer {id: $devId}), (p:Package {id: $pkgId})
         MERGE (d)-[:MAINTAINS]->(p)`,
        { devId: m.devId, pkgId: m.pkgId }
      );
    }

    // DEPENDS_ON
    console.log(`Merging ${dependsOn.length} DEPENDS_ON relationships...`);
    for (const dep of dependsOn) {
      // Skip synthetic package refs that aren't in our set
      const knownIds = packages.map((p) => p.id);
      if (!knownIds.includes(dep.fromId) || !knownIds.includes(dep.toId)) continue;
      await session.run(
        `MATCH (a:Package {id: $fromId}), (b:Package {id: $toId})
         MERGE (a)-[r:DEPENDS_ON]->(b)
         SET r.version_range = $versionRange, r.dev_only = $devOnly`,
        { fromId: dep.fromId, toId: dep.toId, versionRange: dep.versionRange, devOnly: dep.devOnly }
      );
    }

    // CONTRIBUTES_TO
    console.log(`Merging ${contributesTo.length} CONTRIBUTES_TO relationships...`);
    for (const c of contributesTo) {
      await session.run(
        `MATCH (d:Developer {id: $devId}), (r:Repository {id: $repoId})
         MERGE (d)-[rel:CONTRIBUTES_TO]->(r)
         SET rel.commits = $commits`,
        { devId: c.devId, repoId: c.repoId, commits: c.commits }
      );
    }

    // MEMBER_OF
    console.log(`Merging ${memberOf.length} MEMBER_OF relationships...`);
    for (const m of memberOf) {
      await session.run(
        `MATCH (d:Developer {id: $devId}), (o:Organization {id: $orgId})
         MERGE (d)-[:MEMBER_OF]->(o)`,
        { devId: m.devId, orgId: m.orgId }
      );
    }

    // OWNS
    console.log(`Merging ${orgOwns.length} OWNS relationships...`);
    for (const o of orgOwns) {
      await session.run(
        `MATCH (org:Organization {id: $orgId}), (r:Repository {id: $repoId})
         MERGE (org)-[:OWNS]->(r)`,
        { orgId: o.orgId, repoId: o.repoId }
      );
    }

    console.log('\n✅ Seed complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   Organizations: ${organizations.length}`);
    console.log(`   Repositories:  ${repositories.length}`);
    console.log(`   Packages:      ${packages.length}`);
    console.log(`   Developers:    ${developers.length}`);
    console.log(`   MAINTAINS:     ${maintains.length}`);
    console.log(`   DEPENDS_ON:    ${dependsOn.length}`);
    console.log(`   CONTRIBUTES_TO: ${contributesTo.length}`);
    console.log(`   MEMBER_OF:     ${memberOf.length}`);
    console.log(`   OWNS:          ${orgOwns.length}`);
    console.log('\n🎯 Engineered bus-factor cases:');
    console.log('   ghost-maintainer  → lodash, chalk, left-pad, commander, yargs, underscore (6 packages)');
    console.log('   pypi-overlord     → requests, urllib3, certifi, chardet, idna (5 packages)');
    console.log('   fullstack-solo    → express, body-parser, cors, dotenv, @acme/auth-core (5 packages)');
    console.log('\n⛓️  5-hop dependency chain:');
    console.log('   wexa-core → @acme/auth-core → @acme/crypto-utils → @acme/logger → neo-cache → supply-validator');

  } catch (err) {
    console.error('❌ Seed error:', err.message);
    errors++;
  } finally {
    await session.close();
    await driver.close();
    process.exit(errors > 0 ? 1 : 0);
  }
}

seed();
