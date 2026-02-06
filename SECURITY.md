# Security Guide

This document outlines the security features and best practices for the C0llecti0n application.

## 🔒 Security Features

### 1. Admin API Authentication

The admin API server requires authentication for all write operations (POST, PUT, DELETE).

**How it works:**
- Read operations (GET) are publicly accessible
- Write operations require the `X-Admin-Key` header
- The key is configured via the `ADMIN_KEY` environment variable

**Configuration:**
```bash
# .env
ADMIN_KEY=your-strong-secret-key-here
```

**Generate a secure key:**
```bash
openssl rand -base64 32
```

### 2. CORS Protection

The admin server restricts Cross-Origin Resource Sharing (CORS) to localhost only:

```javascript
// admin-server.mjs
'Access-Control-Allow-Origin': 'http://localhost:4321'
```

This prevents external websites from making requests to your admin API.

### 3. XSS Prevention

All user inputs are sanitized before rendering using the `escapeHtml()` function:

```typescript
// src/utils/security.ts
export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
```

This is applied in:
- Admin panel table rendering
- Global search results
- Detail modal content
- All data attributes

### 4. Input Validation

The admin server validates all incoming data:

- **Required fields**: Ensures mandatory fields are present
- **Type validation**: Strings, numbers, dates, URLs
- **Range validation**: Year (1000-2100), Rating (1-10)
- **Enum validation**: Status fields have allowed values

### 5. URL Sanitization

URLs are validated to prevent malicious redirects:

- Relative paths are allowed (`/covers/image.jpg`)
- Only `http:` and `https:` protocols are permitted
- Invalid URLs are rejected

## 🛡️ Best Practices

### Local Development

1. **Use the default setup:**
   ```bash
   npm run admin-server  # Starts on localhost:4322
   npm run dev           # Starts on localhost:4321
   ```

2. **Set a custom admin key:**
   ```bash
   # .env
   # For client-side access in Astro, use PUBLIC_ prefix
   PUBLIC_ADMIN_KEY=my-local-dev-key
   ADMIN_KEY=my-local-dev-key
   ```

   **Note:** Astro requires the `PUBLIC_` prefix for environment variables to be accessible in client-side code. Both variables should have the same value.

### Production Deployment

1. **Strong admin key:**
   - Use a cryptographically secure random key
   - Minimum 32 characters
   - Never use default or simple keys

2. **Environment variables:**
   - Never commit `.env` to version control
   - Use platform-specific secret management (Vercel, Netlify, etc.)

3. **Admin panel access:**
   - The admin panel is automatically excluded from production builds via `vercel.json`
   - Consider adding additional authentication (Basic Auth, OAuth)

4. **HTTPS only:**
   - Always use HTTPS in production
   - The CORS origin should match your HTTPS domain

5. **Regular updates:**
   - Keep dependencies updated
   - Monitor for security advisories

## 🚨 Security Checklist

Before deploying to production:

- [ ] Changed default `ADMIN_KEY` to a secure random value
- [ ] Verified `.env` is in `.gitignore`
- [ ] Confirmed admin panel is excluded from production (vercel.json)
- [ ] Enabled HTTPS
- [ ] Reviewed CORS settings for your domain
- [ ] Tested XSS protection with malicious inputs
- [ ] Added backup/restore procedures for JSON data

## 🐛 Reporting Security Issues

If you discover a security vulnerability, please:

1. Do not open a public issue
2. Contact the maintainer directly
3. Allow time for a fix before public disclosure

## 📚 Additional Resources

- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP CORS Guide](https://cheatsheetseries.owasp.org/cheatsheets/CORS_Security_Cheat_Sheet.html)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
