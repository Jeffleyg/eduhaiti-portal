import { jest } from '@jest/globals';

/**
 * Deep auto-mock for PrismaService.
 *
 * Every `prisma.<model>.<method>` is a lazily created `jest.fn()` that resolves
 * to `undefined` unless configured, e.g.:
 *
 *   const prisma = createPrismaMock();
 *   prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
 *
 * `$transaction` supports both forms used in the codebase:
 *   - callback form: runs the callback with the same mock as `tx`
 *   - array form: resolves all promises in the array
 */
export type MockFn = jest.Mock<(...args: any[]) => any>;
export type PrismaMock = Record<string, any> & {
  $transaction: MockFn;
};

export function createPrismaMock(): PrismaMock {
  const models = new Map<string, Record<string, MockFn>>();

  const modelProxy = (name: string) => {
    if (!models.has(name)) {
      const methods: Record<string, MockFn> = {};
      models.set(
        name,
        new Proxy(methods, {
          get(target, method: string) {
            if (typeof method !== 'string') return undefined;
            if (!target[method]) {
              target[method] = jest.fn<(...args: any[]) => any>();
              target[method].mockResolvedValue(undefined);
            }
            return target[method];
          },
        }),
      );
    }
    return models.get(name)!;
  };

  const root: Record<string, any> = {};
  const proxy = new Proxy(root, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      return modelProxy(prop);
    },
  }) as PrismaMock;

  root.$transaction = jest.fn(async (arg: any) => {
    if (typeof arg === 'function') return arg(proxy);
    return Promise.all(arg);
  });
  root.$queryRaw = jest.fn<(...args: any[]) => any>().mockResolvedValue([]);
  root.$queryRawUnsafe = jest.fn<(...args: any[]) => any>().mockResolvedValue([]);
  root.$executeRaw = jest.fn<(...args: any[]) => any>().mockResolvedValue(0);
  root.$executeRawUnsafe = jest.fn<(...args: any[]) => any>().mockResolvedValue(0);
  root.$connect = jest.fn<(...args: any[]) => any>().mockResolvedValue(undefined);
  root.$disconnect = jest.fn<(...args: any[]) => any>().mockResolvedValue(undefined);

  return proxy;
}
