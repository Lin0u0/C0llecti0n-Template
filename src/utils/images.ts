/**
 * Image utility for dynamic cover imports
 * Uses import.meta.glob to pre-import all cover images at build time
 */

// Import all images from assets/covers
const images = import.meta.glob<{ default: ImageMetadata }>(
    '/src/assets/covers/**/*.{jpeg,jpg,png,gif,webp}',
    { eager: true }
);

/**
 * Get the optimized image metadata for a cover path
 * @param coverPath - The cover path from JSON data (e.g., "/covers/s12345.jpg")
 * @returns ImageMetadata for use with Astro's <Image> component, or undefined if not found
 */
export function getCoverImage(coverPath: string | undefined): ImageMetadata | undefined {
    if (!coverPath) return undefined;

    // Convert "/covers/filename.jpg" to "/src/assets/covers/filename.jpg"
    const assetPath = coverPath.replace('/covers/', '/src/assets/covers/');

    const image = images[assetPath];
    return image?.default;
}

/**
 * Check if a cover image exists
 */
export function hasCoverImage(coverPath: string | undefined): boolean {
    return getCoverImage(coverPath) !== undefined;
}
