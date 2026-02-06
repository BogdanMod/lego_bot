import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { getRequestId } from './request-id';

type RequestSource = 'body' | 'query' | 'params';

function getValidationRequestId(req: Request): string {
  return (req as any).id ?? getRequestId() ?? 'unknown';
}

function humanizeZodIssue(issue: any): string {
  const code = issue?.code;
  if (code === 'invalid_type') {
    const received = issue?.received;
    if (received === 'undefined' || received === 'null') {
      return 'Поле обязательно';
    }
    return 'Неверный тип данных';
  }
  if (code === 'too_small') {
    return 'Слишком короткое значение';
  }
  if (code === 'too_big') {
    return 'Слишком длинное значение';
  }
  return issue?.message || 'Ошибка валидации';
}

export function validateRequest(schema: ZodSchema, source: RequestSource) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = getValidationRequestId(req);
    const logger = (req as any).log;

    if (req[source] === undefined || req[source] === null) {
      logger?.warn?.(
        { source, requestId, error_type: 'missing_source' },
        'Validation source is missing'
      );
      logger?.info?.({ metric: 'validation_error_total', count: 1, source, requestId });
      return res.status(400).json({
        error: 'Validation error',
        message:
          source === 'body'
            ? 'Request body is required'
            : source === 'query'
              ? 'Query parameters are required'
              : 'Route parameters are required',
        requestId,
      });
    }

    let result: ReturnType<typeof schema.safeParse>;
    try {
      result = schema.safeParse(req[source]);
    } catch (error) {
      logger?.error?.(
        { source, requestId, error, valueType: typeof req[source] },
        'Unexpected validation error'
      );
      logger?.info?.({ metric: 'validation_internal_error_total', count: 1, source, requestId });
      return res.status(500).json({
        error: 'Validation error',
        message: 'Internal validation error',
        requestId,
      });
    }

    if (!result.success) {
      const issues = result.error.issues;
      const fields: Record<string, string[]> = {};
      const messages: string[] = [];

      for (const issue of issues) {
        const path =
          Array.isArray(issue.path) && issue.path.length > 0
            ? issue.path.map(String).join('.')
            : '_root';
        const message = humanizeZodIssue(issue);
        if (!fields[path]) fields[path] = [];
        fields[path].push(message);
        messages.push(`${path}: ${message}`);
      }

      logger?.warn?.(
        { source, requestId, error_type: 'validation_error', errors: issues },
        'Validation failed'
      );
      logger?.info?.({ metric: 'validation_error_total', count: 1, source, requestId });
      return res.status(400).json({
        error: 'Validation error',
        requestId,
        details: issues,
        fields,
        messages,
      });
    }

    (req as any)[source] = result.data;
    return next();
  };
}

export function validateBody(schema: ZodSchema) {
  return validateRequest(schema, 'body');
}

export function validateQuery(schema: ZodSchema) {
  return validateRequest(schema, 'query');
}

export function validateParams(schema: ZodSchema) {
  return validateRequest(schema, 'params');
}
