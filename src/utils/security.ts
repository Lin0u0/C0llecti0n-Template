/**
 * Security Utilities
 * XSS protection and input sanitization helpers
 */

/**
 * Escape HTML special characters to prevent XSS attacks
 * Converts &, <, >, ", and ' to their HTML entities
 */
export function escapeHtml(str: string | number | undefined | null): string {
    if (str === undefined || str === null) return '';
    const string = String(str);
    return string
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Sanitize a string for use in HTML attributes
 * Handles quotes and other special characters
 */
export function sanitizeAttribute(str: string | undefined): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Decode HTML entities back to their original characters
 * Useful when retrieving data from data attributes
 */
export function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

/**
 * Sanitize JSON string for safe embedding in HTML
 * Escapes quotes and other special characters
 */
export function sanitizeJsonForHtml(obj: unknown): string {
    const json = JSON.stringify(obj);
    return escapeHtml(json);
}

/**
 * Validate and sanitize URL
 * Only allows http:, https:, and relative paths
 */
export function sanitizeUrl(url: string | undefined): string {
    if (!url) return '';
    
    // Allow relative paths
    if (url.startsWith('/')) return url;
    if (url.startsWith('./')) return url;
    if (url.startsWith('../')) return url;
    
    // Check for safe protocols
    try {
        const parsed = new URL(url);
        const safeProtocols = ['http:', 'https:'];
        if (safeProtocols.includes(parsed.protocol)) {
            return url;
        }
    } catch {
        // Invalid URL, return empty string
    }
    
    return '';
}

/**
 * Rate limiting helper for client-side operations
 * Prevents rapid-fire requests
 */
export function createRateLimiter(maxRequests: number, windowMs: number) {
    let requests: number[] = [];
    
    return function canProceed(): boolean {
        const now = Date.now();
        // Remove old requests outside the window
        requests = requests.filter(time => now - time < windowMs);
        
        if (requests.length < maxRequests) {
            requests.push(now);
            return true;
        }
        return false;
    };
}

/**
 * Content Security Policy helper
 * Returns recommended CSP directives for this application
 */
export function getRecommendedCSP(): string {
    return [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'", // Required for Astro's island architecture
        "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
        "font-src 'self' fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self' http://localhost:4322", // Admin API
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; ');
}
