import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, relative, resolve } from 'node:path';
import ts from 'typescript';

export type CapabilityKind =
  | 'http-route'
  | 'middleware'
  | 'socket-event'
  | 'scheduled-job'
  | 'admin-resource'
  | 'persistence'
  | 'provider'
  | 'operation'
  | 'unknown';

export interface CapabilityItem {
  id: string;
  kind: CapabilityKind;
  sourceFile: string;
  legacyOwner: 'Express';
  risk: 'low' | 'medium' | 'high' | 'unknown';
  targetModule: string;
  parityCases: string[];
  status: 'legacy-only';
  reviewVerdict: 'pending';
  cutoverState: 'express-owner';
  rollbackState: 'legacy-available';
  evidence: Record<string, string>;
}

export interface InventoryAuditCategory {
  category: string;
  status: 'covered' | 'missing';
  evidenceCount: number;
}

export interface InventoryAudit {
  categories: InventoryAuditCategory[];
  missingCategories: string[];
  unknownCount: number;
  complete: boolean;
}

export interface CapabilityInventory {
  schemaVersion: 1;
  legacyWorktree: string;
  generatedAt: string;
  items: CapabilityItem[];
  audit?: InventoryAudit;
}

const sourceExtensions = new Set(['.js', '.cjs', '.mjs', '.ts', '.mts', '.cts']);
const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all', 'use']);
const prismaOperations = new Set([
  'aggregate',
  'count',
  'create',
  'createMany',
  'delete',
  'deleteMany',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'groupBy',
  'update',
  'updateMany',
  'upsert',
]);
const deploymentFiles = new Set([
  'dockerfile',
  'procfile',
  'railway.json',
  'render.yaml',
  'render.yml',
  'fly.toml',
  'vercel.json',
  'docker-compose.yml',
  'docker-compose.yaml',
]);
const selectedDirectories = ['routes', 'middleware', 'sockets', 'jobs', 'config', 'services', 'chain'];

const providerRules: Array<[RegExp, string]> = [
  [/^(?:@stripe\/|stripe$)/i, 'stripe'],
  [/@paystack|paystack/i, 'paystack'],
  [/flutterwave/i, 'flutterwave'],
  [/cloudinary/i, 'cloudinary'],
  [/nodemailer|sib-api|zeptomail|sendgrid|mailgun/i, 'email'],
  [/passport|google-auth-library/i, 'oauth'],
  [/openai|anthropic|generative-ai|gemini/i, 'ai'],
  [/ipfs|pinata/i, 'ipfs'],
  [/@aeko-chain|aeko/i, 'aeko-chain'],
  [/@solana\/web3\.js/i, 'chain-rpc'],
];

const propertyName = (name: ts.PropertyName | undefined): string | undefined => {
  if (!name) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) return name.expression.text;
  return undefined;
};

const objectProperty = (object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined => {
  for (const property of object.properties) {
    if (ts.isPropertyAssignment(property) && propertyName(property.name) === name) return property.initializer;
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === name) return property.name;
  }
  return undefined;
};

const asObject = (node: ts.Node | undefined): ts.ObjectLiteralExpression | undefined =>
  node && ts.isObjectLiteralExpression(node) ? node : undefined;

const lineNumber = (source: ts.SourceFile, node: ts.Node): string =>
  String(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);

const canonicalEvidence = (evidence: Record<string, string>): Array<[string, string]> =>
  Object.entries(evidence)
    .filter(([key]) => key !== 'line')
    .sort(([left], [right]) => left.localeCompare(right));

const stableId = (kind: CapabilityKind, sourceFile: string, evidence: Record<string, string>): string => {
  const digest = createHash('sha256')
    .update(JSON.stringify([kind, sourceFile.replaceAll('\\', '/'), canonicalEvidence(evidence)]))
    .digest('hex')
    .slice(0, 12);
  return `${kind}:${digest}`;
};

const moduleNameFromFile = (sourceFile: string): string => {
  const normalized = sourceFile.replaceAll('\\', '/');
  const stem = basename(normalized, extname(normalized))
    .replace(/Routes?$/i, '')
    .replace(/Socket$/i, '')
    .replace(/Service$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
  if (normalized === 'server.js') return 'platform';
  if (normalized === 'admin.js' || normalized.startsWith('admin/')) return 'admin';
  if (normalized.startsWith('middleware/')) return 'platform';
  if (normalized.startsWith('jobs/')) return stem || 'scheduling';
  if (normalized.startsWith('config/')) return 'configuration';
  if (normalized === 'prisma/schema.prisma') return 'persistence';
  return stem || 'legacy-unassigned';
};

const parityCasesFor = (
  kind: CapabilityKind,
  evidence: Record<string, string>
): string[] => {
  switch (kind) {
    case 'http-route':
      return [`Preserve ${evidence.method ?? 'HTTP'} ${evidence.path ?? '<unknown>'} auth, status, response envelope, and effects`];
    case 'middleware':
      return [`Preserve ${evidence.path ?? '<global>'} middleware order, request mutation, and failure behavior`];
    case 'socket-event':
      return [`Preserve ${evidence.direction ?? 'socket'} event ${evidence.event ?? '<unknown>'} payload, auth, room, and acknowledgement behavior`];
    case 'scheduled-job':
      return [`Preserve ${evidence.trigger ?? evidence.module ?? 'job'} trigger, singleton ownership, idempotency, and failure recovery`];
    case 'admin-resource':
      return [`Preserve AdminJS ${evidence.itemType ?? 'resource'} ${evidence.action ?? evidence.resource ?? '<unknown>'} authorization and effects`];
    case 'persistence':
      return [`Preserve ${evidence.model ?? evidence.asset ?? 'persistence'} ${evidence.operation ?? ''} transaction, concurrency, and numeric semantics`.trim()];
    case 'provider':
      return [`Preserve ${evidence.provider ?? 'provider'} request, callback, error, redaction, and idempotency behavior`];
    case 'operation':
      return [`Preserve ${evidence.asset ?? evidence.category ?? 'operation'} startup, deployment, configuration, and rollback behavior`];
    case 'unknown':
      return [`Resolve and review dynamic ${evidence.registrationKind ?? 'registration'} before migration or cutover`];
  }
};

const targetModuleFor = (
  kind: CapabilityKind,
  sourceFile: string,
  evidence: Record<string, string>
): string => {
  if (kind === 'unknown') return 'unassigned';
  if (kind === 'provider') return `${evidence.provider ?? 'external'}-integration`;
  if (kind === 'operation' && evidence.category === 'environment-variable') return 'configuration';
  return moduleNameFromFile(sourceFile);
};

const item = (
  kind: CapabilityKind,
  sourceFile: string,
  evidence: Record<string, string>,
  risk: CapabilityItem['risk'] = 'medium'
): CapabilityItem => ({
  id: stableId(kind, sourceFile, evidence),
  kind,
  sourceFile,
  legacyOwner: 'Express',
  risk,
  targetModule: targetModuleFor(kind, sourceFile, evidence),
  parityCases: parityCasesFor(kind, evidence),
  status: 'legacy-only',
  reviewVerdict: 'pending',
  cutoverState: 'express-owner',
  rollbackState: 'legacy-available',
  evidence,
});

const unknownItem = (
  sourceFile: string,
  registrationKind: Exclude<CapabilityKind, 'unknown'>,
  evidence: Record<string, string>
): CapabilityItem => item('unknown', sourceFile, { registrationKind, ...evidence }, 'unknown');

const providerName = (moduleSpecifier: string): string | undefined =>
  providerRules.find(([pattern]) => pattern.test(moduleSpecifier))?.[1];

const callMethod = (
  expression: ts.LeftHandSideExpression,
  source: ts.SourceFile
): { method: string; receiver: ts.Expression; receiverText: string } | undefined => {
  if (ts.isPropertyAccessExpression(expression)) {
    return { method: expression.name.text, receiver: expression.expression, receiverText: expression.expression.getText(source) };
  }
  if (ts.isElementAccessExpression(expression)) {
    const method = expression.argumentExpression && ts.isStringLiteralLike(expression.argumentExpression)
      ? expression.argumentExpression.text
      : undefined;
    return method ? { method, receiver: expression.expression, receiverText: expression.expression.getText(source) } : undefined;
  }
  return undefined;
};

const resourceName = (resource: ts.Expression, source: ts.SourceFile): string | undefined => {
  const object = asObject(resource);
  const model = object && objectProperty(object, 'model');
  const candidate = model ?? resource;
  if (ts.isIdentifier(candidate) || ts.isStringLiteralLike(candidate)) return candidate.text;
  if (ts.isPropertyAccessExpression(candidate)) return candidate.name.text;
  if (ts.isCallExpression(candidate)) {
    const argument = candidate.arguments[0];
    if (argument && ts.isStringLiteralLike(argument)) return argument.text;
  }
  const text = candidate.getText(source);
  return text.length <= 80 && /^[A-Za-z_$][\w$]*$/.test(text) ? text : undefined;
};

export function extractSourceCapabilities(sourceFile: string, sourceText: string): CapabilityItem[] {
  const parsed = ts.createSourceFile(sourceFile, sourceText, ts.ScriptTarget.Latest, true);
  const results: CapabilityItem[] = [];
  const constants = new Map<string, string>();
  let registrationOrdinal = 0;

  const resolveString = (node: ts.Node | undefined): string | undefined => {
    if (!node) return undefined;
    if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isIdentifier(node)) return constants.get(node.text);
    if (ts.isParenthesizedExpression(node)) return resolveString(node.expression);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = resolveString(node.left);
      const right = resolveString(node.right);
      return left !== undefined && right !== undefined ? `${left}${right}` : undefined;
    }
    if (ts.isTemplateExpression(node)) {
      let value = node.head.text;
      for (const span of node.templateSpans) {
        const expression = resolveString(span.expression);
        if (expression === undefined) return undefined;
        value += expression + span.literal.text;
      }
      return value;
    }
    return undefined;
  };

  const collectConstants = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const value = resolveString(node.initializer);
      if (value !== undefined) constants.set(node.name.text, value);
    }
    ts.forEachChild(node, collectConstants);
  };
  collectConstants(parsed);

  const addProviderImport = (moduleSpecifier: string, node: ts.Node): void => {
    const provider = providerName(moduleSpecifier);
    if (!provider) return;
    results.push(item('provider', sourceFile, { provider, module: moduleSpecifier, line: lineNumber(parsed, node) }, 'high'));
  };

  const addAdminResources = (configuration: ts.ObjectLiteralExpression, node: ts.Node): void => {
    const resources = objectProperty(configuration, 'resources');
    if (!resources || !ts.isArrayLiteralExpression(resources)) {
      if (resources) results.push(unknownItem(sourceFile, 'admin-resource', { detail: 'dynamic-resources', line: lineNumber(parsed, node) }));
      return;
    }
    resources.elements.forEach((element, resourceIndex) => {
      if (!ts.isObjectLiteralExpression(element)) {
        results.push(unknownItem(sourceFile, 'admin-resource', { detail: `dynamic-resource-${resourceIndex}`, line: lineNumber(parsed, element) }));
        return;
      }
      const resourceExpression = objectProperty(element, 'resource') ?? element;
      const name = resourceName(resourceExpression, parsed);
      if (!name) {
        results.push(unknownItem(sourceFile, 'admin-resource', { detail: `unresolved-resource-${resourceIndex}`, line: lineNumber(parsed, element) }));
        return;
      }
      results.push(item('admin-resource', sourceFile, { itemType: 'resource', resource: name, line: lineNumber(parsed, element) }, 'high'));
      const options = asObject(objectProperty(element, 'options'));
      const actions = options && asObject(objectProperty(options, 'actions'));
      if (!actions) return;
      for (const actionProperty of actions.properties) {
        const action = propertyName(actionProperty.name);
        if (!action) {
          results.push(unknownItem(sourceFile, 'admin-resource', { detail: `dynamic-action-${name}`, line: lineNumber(parsed, actionProperty) }));
          continue;
        }
        results.push(item('admin-resource', sourceFile, { itemType: 'action', resource: name, action, line: lineNumber(parsed, actionProperty) }, 'high'));
      }
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const moduleSpecifier = node.moduleSpecifier.text;
      addProviderImport(moduleSpecifier, node);
      if (/(?:^|\/)jobs\//i.test(moduleSpecifier)) {
        results.push(item('scheduled-job', sourceFile, { registration: 'static-import', module: moduleSpecifier, line: lineNumber(parsed, node) }, 'high'));
      }
    }

    if (ts.isNewExpression(node) && /AdminJS$/i.test(node.expression.getText(parsed))) {
      const configuration = node.arguments?.[0];
      if (configuration && ts.isObjectLiteralExpression(configuration)) addAdminResources(configuration, node);
      else results.push(unknownItem(sourceFile, 'admin-resource', { detail: 'dynamic-admin-configuration', line: lineNumber(parsed, node) }));
    }

    if (ts.isPropertyAccessExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const root = node.expression.expression.getText(parsed);
      if (root === 'process.env') {
        const name = node.name.text;
        results.push(item('operation', sourceFile, { category: 'environment-variable', name }, /SECRET|KEY|TOKEN|PASSWORD|PRIVATE/i.test(name) ? 'high' : 'medium'));
      }
    }
    if (ts.isElementAccessExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.getText(parsed) === 'process.env') {
      const name = resolveString(node.argumentExpression);
      if (name) results.push(item('operation', sourceFile, { category: 'environment-variable', name }, /SECRET|KEY|TOKEN|PASSWORD|PRIVATE/i.test(name) ? 'high' : 'medium'));
      else results.push(unknownItem(sourceFile, 'operation', { detail: 'dynamic-environment-variable', line: lineNumber(parsed, node) }));
    }

    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const moduleSpecifier = resolveString(node.arguments[0]);
        if (moduleSpecifier) {
          addProviderImport(moduleSpecifier, node);
          if (/(?:^|\/)jobs\//i.test(moduleSpecifier)) {
            results.push(item('scheduled-job', sourceFile, { registration: 'dynamic-import', module: moduleSpecifier, line: lineNumber(parsed, node) }, 'high'));
          }
        } else {
          results.push(unknownItem(sourceFile, 'operation', { detail: 'dynamic-import', line: lineNumber(parsed, node) }));
        }
      }

      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const moduleSpecifier = resolveString(node.arguments[0]);
        if (moduleSpecifier) addProviderImport(moduleSpecifier, node);
      }

      const call = callMethod(node.expression, parsed);
      if (call) {
        const method = call.method;
        const receiverLower = call.receiverText.toLowerCase();
        const firstValue = resolveString(node.arguments[0]);
        const ordinal = String(++registrationOrdinal);

        const directHttpReceiver = /(?:^|\.)(?:app|router)$/i.test(call.receiverText);
        const routeChain = ts.isCallExpression(call.receiver) && callMethod(call.receiver.expression, parsed)?.method === 'route';
        if (httpMethods.has(method) && (directHttpReceiver || routeChain)) {
          const chainedPath = routeChain && ts.isCallExpression(call.receiver) ? resolveString(call.receiver.arguments[0]) : undefined;
          const path = method === 'use' && node.arguments.length === 1 ? '<global>' : (chainedPath ?? firstValue);
          if (!path) {
            results.push(unknownItem(sourceFile, method === 'use' ? 'middleware' : 'http-route', {
              receiver: call.receiverText,
              method: method.toUpperCase(),
              ordinal,
              line: lineNumber(parsed, node),
            }));
          } else {
            const evidence = {
              receiver: call.receiverText,
              method: method.toUpperCase(),
              path,
              ordinal,
              line: lineNumber(parsed, node),
            };
            results.push(item(method === 'use' ? 'middleware' : 'http-route', sourceFile, evidence, 'medium'));
          }
        } else if ((method === 'on' || method === 'emit') && /(?:io|socket|client)/i.test(receiverLower)) {
          if (!firstValue) {
            results.push(unknownItem(sourceFile, 'socket-event', {
              receiver: call.receiverText,
              direction: method,
              ordinal,
              line: lineNumber(parsed, node),
            }));
          } else {
            results.push(item('socket-event', sourceFile, {
              receiver: call.receiverText,
              direction: method,
              event: firstValue,
              ordinal,
              line: lineNumber(parsed, node),
            }, 'high'));
          }
        } else if ((method === 'schedule' || method === 'scheduleJob') && /cron|schedule/i.test(receiverLower)) {
          if (!firstValue) {
            results.push(unknownItem(sourceFile, 'scheduled-job', {
              receiver: call.receiverText,
              registration: 'cron',
              ordinal,
              line: lineNumber(parsed, node),
            }));
          } else {
            results.push(item('scheduled-job', sourceFile, {
              receiver: call.receiverText,
              registration: 'cron',
              trigger: firstValue,
              ordinal,
              line: lineNumber(parsed, node),
            }, 'high'));
          }
        }

        if (call.receiverText === 'prisma' && method.startsWith('$')) {
          results.push(item('persistence', sourceFile, { client: 'prisma', operation: method, line: lineNumber(parsed, node) }, 'high'));
        } else if (call.receiverText.startsWith('prisma.') && prismaOperations.has(method)) {
          results.push(item('persistence', sourceFile, {
            client: 'prisma',
            model: call.receiverText.slice('prisma.'.length),
            operation: method,
            line: lineNumber(parsed, node),
          }, 'high'));
        } else if (/sequelize/i.test(call.receiverText) && method === 'query') {
          results.push(item('persistence', sourceFile, { client: 'sequelize', operation: 'raw-query', line: lineNumber(parsed, node) }, 'high'));
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(parsed);
  return deduplicate(results);
}

export function parsePrismaSchema(sourceFile: string, sourceText: string): CapabilityItem[] {
  const results: CapabilityItem[] = [];
  const tokens = sourceText
    .replace(/\/\/[^\r\n]*/g, '')
    .match(/[A-Za-z_][A-Za-z0-9_]*|[{}]/g) ?? [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (tokens[index] === 'model' && /^[A-Za-z_]/.test(tokens[index + 1] ?? '')) {
      results.push(item('persistence', sourceFile, { asset: 'prisma-model', model: tokens[index + 1] ?? '<unknown>' }, 'high'));
    }
  }
  if (results.length === 0) {
    results.push(unknownItem(sourceFile, 'persistence', { detail: 'prisma-schema-without-models' }));
  }
  return results;
}

export function parseJsonCapabilities(sourceFile: string, sourceText: string): CapabilityItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(sourceText);
  } catch {
    return [unknownItem(sourceFile, 'operation', { detail: 'invalid-json' })];
  }
  const normalized = sourceFile.replaceAll('\\', '/').toLowerCase();
  if (normalized === 'package.json') {
    const packageJson = parsed as { scripts?: Record<string, unknown> };
    return Object.entries(packageJson.scripts ?? {}).map(([name, command]) =>
      item('operation', sourceFile, {
        asset: 'package-script',
        name,
        command: typeof command === 'string' ? command : '<non-string>',
      }, /migrate|deploy|start|postinstall/i.test(name) ? 'high' : 'medium')
    );
  }
  const object = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  const deploy = object.deploy && typeof object.deploy === 'object' ? object.deploy as Record<string, unknown> : object;
  const evidence: Record<string, string> = { asset: 'deployment-json' };
  for (const key of ['startCommand', 'healthcheckPath', 'buildCommand', 'restartPolicyType']) {
    if (typeof deploy[key] === 'string') evidence[key] = deploy[key];
  }
  return [item('operation', sourceFile, evidence, 'high')];
}

export function parseEnvExample(sourceFile: string, sourceText: string): CapabilityItem[] {
  const results: CapabilityItem[] = [];
  for (const rawLine of sourceText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    const name = (equals >= 0 ? line.slice(0, equals) : line).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
    results.push(item('operation', sourceFile, { category: 'environment-variable', name }, /SECRET|KEY|TOKEN|PASSWORD|PRIVATE/i.test(name) ? 'high' : 'medium'));
  }
  return results.length > 0 ? results : [unknownItem(sourceFile, 'operation', { detail: 'empty-env-example' })];
}

const manualEvidence = (sourceFile: string): CapabilityItem[] => {
  const normalized = sourceFile.replaceAll('\\', '/').toLowerCase();
  if (normalized === 'server.js') {
    return [
      item('operation', sourceFile, { asset: 'configuration-startup' }, 'high'),
      item('operation', sourceFile, { asset: 'middleware-ordering' }, 'high'),
      item('operation', sourceFile, { asset: 'socket-and-job-bootstrap' }, 'high'),
    ];
  }
  if (normalized === 'admin.js') return [item('admin-resource', sourceFile, { asset: 'adminjs-bootstrap', itemType: 'bootstrap' }, 'high')];
  if (normalized.startsWith('middleware/')) return [item('middleware', sourceFile, { asset: 'middleware-source', path: '<registered-at-route-or-app>' }, 'high')];
  if (normalized.startsWith('sockets/')) return [item('operation', sourceFile, { asset: 'socket-system-source' }, 'high')];
  if (normalized.startsWith('jobs/')) return [item('scheduled-job', sourceFile, { asset: 'job-source' }, 'high')];
  if (normalized.startsWith('config/')) return [item('operation', sourceFile, { asset: 'configuration-source' }, 'high')];
  if (normalized.startsWith('services/')) return [item('operation', sourceFile, { asset: 'service-source' }, 'medium')];
  if (normalized.startsWith('chain/')) return [item('provider', sourceFile, { provider: 'aeko-chain', asset: 'chain-adapter-source' }, 'high')];
  if (deploymentFiles.has(normalized)) return [item('operation', sourceFile, { asset: 'deployment-file' }, 'high')];
  return [];
};

const walkDirectory = async (root: string): Promise<string[]> => {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(root, entry.name);
    return entry.isDirectory() ? walkDirectory(path) : [path];
  }));
  return nested.flat();
};

const collectLegacyFiles = async (root: string): Promise<string[]> => {
  const files: string[] = [];
  for (const directory of selectedDirectories) files.push(...await walkDirectory(resolve(root, directory)));
  for (const name of ['server.js', 'admin.js', '.env.example', 'package.json', 'prisma/schema.prisma', ...deploymentFiles]) {
    const path = resolve(root, name);
    try {
      await readFile(path);
      files.push(path);
    } catch {
      // Optional root/deployment assets are audited as missing when absent.
    }
  }
  return [...new Set(files)].sort();
};

const deduplicate = (items: CapabilityItem[]): CapabilityItem[] => {
  const unique = new Map<string, CapabilityItem>();
  for (const capability of items) unique.set(capability.id, capability);
  return [...unique.values()].sort((left, right) => left.id.localeCompare(right.id));
};

export function auditInventory(inventory: CapabilityInventory): InventoryAudit {
  const items = inventory.items;
  const count = (predicate: (capability: CapabilityItem) => boolean): number => items.filter(predicate).length;
  const source = (capability: CapabilityItem): string => capability.sourceFile.replaceAll('\\', '/').toLowerCase();
  const checks: Array<[string, (capability: CapabilityItem) => boolean]> = [
    ['server.js', (capability) => source(capability) === 'server.js'],
    ['routes/**', (capability) => source(capability).startsWith('routes/')],
    ['middleware/**', (capability) => source(capability).startsWith('middleware/')],
    ['sockets/**', (capability) => source(capability).startsWith('sockets/')],
    ['jobs/**', (capability) => source(capability).startsWith('jobs/')],
    ['admin.js', (capability) => source(capability) === 'admin.js'],
    ['config/**', (capability) => source(capability).startsWith('config/')],
    ['services/**', (capability) => source(capability).startsWith('services/')],
    ['prisma/schema.prisma', (capability) => source(capability) === 'prisma/schema.prisma'],
    ['deployment files', (capability) => deploymentFiles.has(source(capability))],
    ['provider integrations', (capability) => capability.kind === 'provider'],
  ];
  const categories = checks.map(([category, predicate]) => {
    const evidenceCount = count(predicate);
    return { category, status: evidenceCount > 0 ? 'covered' as const : 'missing' as const, evidenceCount };
  });
  const missingCategories = categories.filter(({ status }) => status === 'missing').map(({ category }) => category);
  const unknownCount = count(({ kind }) => kind === 'unknown');
  return { categories, missingCategories, unknownCount, complete: missingCategories.length === 0 && unknownCount === 0 };
}

export async function buildInventory(legacyWorktree: string): Promise<CapabilityInventory> {
  const absoluteRoot = resolve(legacyWorktree);
  const files = await collectLegacyFiles(absoluteRoot);
  const items: CapabilityItem[] = [];

  for (const absoluteFile of files) {
    const sourceFile = relative(absoluteRoot, absoluteFile).replaceAll('\\', '/');
    const sourceText = await readFile(absoluteFile, 'utf8');
    items.push(...manualEvidence(sourceFile));
    if (sourceFile === 'prisma/schema.prisma') items.push(...parsePrismaSchema(sourceFile, sourceText));
    else if (sourceFile === '.env.example') items.push(...parseEnvExample(sourceFile, sourceText));
    else if (extname(absoluteFile) === '.json') items.push(...parseJsonCapabilities(sourceFile, sourceText));
    if (sourceExtensions.has(extname(absoluteFile))) items.push(...extractSourceCapabilities(sourceFile, sourceText));
  }

  const inventory: CapabilityInventory = {
    schemaVersion: 1,
    legacyWorktree: absoluteRoot,
    generatedAt: new Date().toISOString(),
    items: deduplicate(items),
  };
  inventory.audit = auditInventory(inventory);
  return inventory;
}

export function inventoryMarkdown(inventory: CapabilityInventory): string {
  const counts = new Map<CapabilityKind, number>();
  for (const capability of inventory.items) counts.set(capability.kind, (counts.get(capability.kind) ?? 0) + 1);
  const audit = inventory.audit ?? auditInventory(inventory);
  const unknowns = inventory.items.filter(({ kind }) => kind === 'unknown');
  const lines = [
    '# Legacy capability inventory',
    '',
    `Generated from \`${inventory.legacyWorktree}\` at ${inventory.generatedAt}.`,
    '',
    `Total items: ${inventory.items.length}. Completion gate: **${audit.complete ? 'PASS' : 'BLOCKED'}**.`,
    '',
    '## Capability counts',
    '',
    '| Kind | Count |',
    '| --- | ---: |',
    ...[...counts.entries()].sort().map(([kind, count]) => `| ${kind} | ${count} |`),
    '',
    '## Required category audit',
    '',
    '| Category | Status | Evidence items |',
    '| --- | --- | ---: |',
    ...audit.categories.map(({ category, status, evidenceCount }) => `| ${category} | ${status} | ${evidenceCount} |`),
    '',
    '## Unresolved registrations',
    '',
    ...(unknowns.length > 0
      ? [
          '| Stable ID | Source | Registration kind | Detail |',
          '| --- | --- | --- | --- |',
          ...unknowns.map((capability) => `| \`${capability.id}\` | \`${capability.sourceFile}\` | ${capability.evidence.registrationKind ?? 'unknown'} | ${capability.evidence.detail ?? capability.evidence.method ?? capability.evidence.direction ?? 'dynamic syntax'} |`),
        ]
      : ['None.']),
    '',
    'All items remain Express-owned with pending review, no cutover, and the legacy runtime available for rollback.',
  ];
  return `${lines.join('\n')}\n`;
}

const argumentValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const legacyWorktree = argumentValue('--legacy-worktree') ?? process.env.LEGACY_WORKTREE;
  if (!legacyWorktree) throw new Error('Provide --legacy-worktree or LEGACY_WORKTREE');
  const inventory = await buildInventory(legacyWorktree);
  const outputRoot = resolve('docs/nestjs-migration');
  await mkdir(outputRoot, { recursive: true });
  await writeFile(resolve(outputRoot, 'capability-inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`);
  await writeFile(resolve(outputRoot, 'capability-inventory.md'), inventoryMarkdown(inventory));
  const audit = inventory.audit ?? auditInventory(inventory);
  process.stdout.write(`${inventory.items.length} capabilities written; ${audit.unknownCount} unknown; ${audit.missingCategories.length} missing categories\n`);
}
