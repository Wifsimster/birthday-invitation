import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names, letting a caller's utility win over a
 * component's default (`cn('p-4', props.class)`). The shadcn convention.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
