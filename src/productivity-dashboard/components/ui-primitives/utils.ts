/**
 * UI Primitives Utility Functions
 * Tailwind-based class name merging utility
 */

/**
 * Conditionally join class names together
 * Filters out falsy values and joins remaining classes
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
