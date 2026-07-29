/**
 * Helpers for building AMC request body fragments that match Wikidot's frontend
 * serialization rules (see `.local/memory/260728_wikidot-ajax-modules/10_transport.md`
 * in the sibling wikidot.py repo for the wire-format research this is based on).
 *
 * Wikidot's `OZONE.utils.formToArray` (and the hand-built request bodies that mirror it)
 * omit unchecked checkboxes/flags entirely instead of sending `false` — a naive
 * `{enabled: false}` body is silently read as "no change", not "turn this off".
 */

/** Value types accepted by {@link omitFalsy}: `false`/`null`/`undefined` mean "omit this key". */
export type OmittableBodyValue = string | number | boolean | null | undefined;

/**
 * Build a request-body fragment from key/value pairs, dropping any key whose value is
 * `false`, `null`, or `undefined` instead of serializing it.
 * @param input - Key/value pairs, where `false`/`null`/`undefined` mean "omit this key"
 * @returns A new object with omitted keys removed
 */
export function omitFalsy<T extends Record<string, OmittableBodyValue>>(
  input: T
): Partial<Record<keyof T, string | number | true>> {
  const result: Partial<Record<keyof T, string | number | true>> = {};
  for (const key of Object.keys(input) as (keyof T)[]) {
    const value = input[key];
    if (value === false || value === null || value === undefined) {
      continue;
    }
    result[key] = value as string | number | true;
  }
  return result;
}

/**
 * Encode a checkbox-style boolean the way `OZONE.utils.formToArray` does:
 * checked -> `"on"`, unchecked -> omitted.
 *
 * The returned `undefined` is safe to spread directly into an `AMCRequestBody` (the AMC
 * client already skips `undefined` values when serializing), or to pass through
 * {@link omitFalsy} alongside other fields.
 * @param value - Checkbox state
 * @returns `"on"` if checked, `undefined` if not
 */
export function checkbox(value: boolean | null | undefined): 'on' | undefined {
  return value ? 'on' : undefined;
}

/**
 * Encode a flag-style boolean the way individually hand-built request bodies do
 * (`if (checked) { p.foo = true; }`): checked -> `"true"`, unchecked -> omitted.
 * @param value - Flag state
 * @returns `"true"` if set, `undefined` if not
 */
export function flag(value: boolean | null | undefined): 'true' | undefined {
  return value ? 'true' : undefined;
}

/**
 * JSON-encode a value for params that Wikidot expects as a JSON string
 * (e.g. `categories`, `options`, `addresses`).
 * @param value - Value to encode
 * @returns JSON string, or `undefined` for null/undefined so omitFalsy drops the key
 */
export function jsonParam(value: unknown): string | undefined {
  // null/undefined must drop the key rather than send the literal "null",
  // matching wikidot.py's json_param(). Without this, jsonParam(maybeNull)
  // behaves differently between the two ports.
  if (value === null || value === undefined) {
    return undefined;
  }
  return JSON.stringify(value);
}
