import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IdempotencyService } from '../services/idempotency.service';

interface IdempotentOptions {
  operation: string;
  keyFromArgs: (...args: unknown[]) => string;
}

interface IdempotentContext {
  idempotencyService: IdempotencyService;
}

export function Idempotent(options: IdempotentOptions): MethodDecorator {
  return (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const original = descriptor.value as (
      ...args: unknown[]
    ) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      const context = this as IdempotentContext;
      const { idempotencyService } = context;

      if (!idempotencyService) {
        return original.apply(this, args);
      }

      const key = options.keyFromArgs(...args);
      if (!key || key.trim().length === 0) {
        throw new BadRequestException('Missing idempotency key');
      }

      return idempotencyService.executeWithIdempotency(
        key,
        options.operation,
        (tx: Prisma.TransactionClient) =>
          original.apply(this, [...args, tx]) as Promise<unknown>,
      );
    };

    return descriptor;
  };
}
