/**
 * Utility function for classname merging
 * Filters out falsy values and joins classnames
 */
export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}
