import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validates a Gemini API Key format
 */
export function isValidGeminiKey(key: string): boolean {
  // Typical Google API keys are around 39 characters and start with AIza
  return /^[A-Za-z0-9_-]{35,45}$/.test(key.trim());
}

/**
 * Validates a GitHub Personal Access Token
 */
export function isValidGitHubToken(token: string): boolean {
  // GitHub classic tokens start with ghp_, fine-grained start with github_pat_
  return /^(ghp_|github_pat_)[A-Za-z0-9_]+$/.test(token.trim());
}

/**
 * Validates a GitHub repository name
 */
export function isValidRepoName(name: string): boolean {
  // Only alphanumeric, hyphens, and underscores allowed
  return /^[a-zA-Z0-9._-]+$/.test(name) && name.length > 0 && name.length <= 100;
}

/**
 * Validates a file path for security (prevents traversal)
 */
export function isValidFilePath(path: string): boolean {
  if (!path || path.includes('..') || path.startsWith('/') || path.includes('\\')) return false;
  return /^[a-zA-Z0-9._\-/]+$/.test(path);
}

/**
 * Validates file upload size and type
 */
export function isValidUpload(file: File, maxSizeMB = 20): { valid: boolean; error?: string } {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'application/pdf', 'text/plain', 'text/markdown',
    'application/json', 'text/javascript', 'text/x-typescript'
  ];
  
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `ဖိုင်ဆိုဒ်က ${maxSizeMB}MB ထက် များနေပါတယ်ရှင်။ ✨💖` };
  }
  
  if (!allowedTypes.includes(file.type) && !file.name.match(/\.(ts|tsx|js|jsx|py|java|c|cpp|h|css|html|md|txt)$/)) {
    return { valid: false, error: "ဒီဖိုင်အမျိုးအစားကို ညီမလေး မထောက်ခံပေးနိုင်သေးပါဘူးရှင်။ ✨😔" };
  }
  
  return { valid: true };
}
