import { jest } from '@jest/globals';
import type { ExecutionContext } from '@nestjs/common';

export type AutoMock = Record<string, jest.Mock<(...args: any[]) => any>>;

/**
 * Object whose every property is a lazily-created jest.fn().
 * By default each fn resolves to `{ mocked: '<name>' }` so controllers that
 * simply delegate can be asserted with `toEqual({ mocked: 'method' })`.
 */
export function autoMock(): AutoMock {
  const fns: AutoMock = {};
  return new Proxy(fns, {
    get(target, prop: string) {
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      if (!target[prop]) {
        target[prop] = jest.fn<(...args: any[]) => any>();
        target[prop].mockResolvedValue({ mocked: prop });
      }
      return target[prop];
    },
  });
}

/** Minimal ExecutionContext for guards. */
export function httpContext(request: Record<string, any>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => function handler() {},
    getClass: () => class Ctrl {},
  } as unknown as ExecutionContext;
}
