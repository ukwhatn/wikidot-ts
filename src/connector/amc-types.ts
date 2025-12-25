import { z } from 'zod';

/**
 * AMC request body value type
 */
export type AMCRequestBodyValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, unknown>
  | AMCRequestBodyValue[];

/**
 * AMC request body type definition
 */
export interface AMCRequestBody {
  moduleName?: string;
  action?: string;
  event?: string;
  [key: string]: AMCRequestBodyValue;
}

/**
 * AMC response base schema
 */
const baseSchema: z.ZodObject<{
  status: z.ZodString;
  body: z.ZodOptional<z.ZodString>;
  message: z.ZodOptional<z.ZodString>;
}> = z.object({
  status: z.string(),
  body: z.string().optional(),
  message: z.string().optional(),
});

/**
 * AMC response schema
 */
export const amcResponseSchema: z.ZodType<z.infer<typeof baseSchema> & Record<string, unknown>> =
  baseSchema.passthrough();

/**
 * AMC response type
 */
export type AMCResponse = z.infer<typeof amcResponseSchema>;

/**
 * Successful AMC response
 */
export interface AMCSuccessResponse {
  status: 'ok';
  body: string;
  [key: string]: unknown;
}

/**
 * Type guard to check if AMC response is successful
 * @param response - AMC response
 * @returns true if response is successful
 */
export function isSuccessResponse(response: AMCResponse): response is AMCSuccessResponse {
  return response.status === 'ok';
}
