import { z } from 'zod';

/**
 * AMCリクエストボディの値型
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
 * AMCリクエストボディの型定義
 */
export interface AMCRequestBody {
  moduleName?: string;
  action?: string;
  event?: string;
  [key: string]: AMCRequestBodyValue;
}

/**
 * AMCレスポンスのベーススキーマ
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
 * AMCレスポンススキーマ
 */
export const amcResponseSchema: z.ZodType<z.infer<typeof baseSchema> & Record<string, unknown>> =
  baseSchema.passthrough();

/**
 * AMCレスポンス型
 */
export type AMCResponse = z.infer<typeof amcResponseSchema>;

/**
 * 成功したAMCレスポンス
 */
export interface AMCSuccessResponse {
  status: 'ok';
  body: string;
  [key: string]: unknown;
}

/**
 * AMCレスポンスが成功かどうかを判定する型ガード
 * @param response - AMCレスポンス
 * @returns 成功レスポンスの場合true
 */
export function isSuccessResponse(response: AMCResponse): response is AMCSuccessResponse {
  return response.status === 'ok';
}
