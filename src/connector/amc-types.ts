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
 * AMCレスポンススキーマ
 */
export const amcResponseSchema = z
  .object({
    status: z.string(),
    body: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

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
