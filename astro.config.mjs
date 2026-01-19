// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
    // Enable static site generation (SSG)
    output: 'static',

    // Build configuration
    build: {
        // Inline stylesheets for better performance
        inlineStylesheets: 'auto'
    },

    // Vite configuration
    vite: {
        build: {
            // Enable CSS code splitting
            cssCodeSplit: true
        }
    },

    server: {                 //此处为新增代码
        host: '0.0.0.0',      //此处为新增代码
    }
});
