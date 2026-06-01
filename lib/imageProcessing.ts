/**
 * Local image processing utilities for MVP features
 * 
 * These are CLIENT-SIDE operations for rapid iteration.
 * In production, these would be handled by backend services.
 */

import * as FileSystem from 'expo-file-system/legacy'

/**
 * CRITICAL: Safe base64 conversion utility
 * 
 * Handles all edge cases:
 * - Missing files
 * - Invalid URIs  
 * - Network timeouts
 * - Invalid base64
 * - File system errors
 * 
 * Usage:
 *   const result = await safeGetBase64(uri)
 *   if (!result) {
 *       console.error('Failed to convert to base64')
 *       return
 *   }
 *   const { base64, mimeType } = result
 */
export async function safeGetBase64(uri: string | null | undefined): Promise<{
    base64: string
    mimeType: string
} | null> {
    try {
        // 1. VALIDATE INPUT
        if (!uri) {
            console.error('[safeGetBase64] URI is missing or null:', uri)
            return null
        }

        if (typeof uri !== 'string') {
            console.error('[safeGetBase64] URI is not a string:', typeof uri, uri)
            return null
        }


        // 2. CHECK FILE EXISTS (local files only)
        if (!uri.startsWith('http')) {
            try {
                const fileInfo = await FileSystem.getInfoAsync(uri)
                if (!fileInfo.exists) {
                    console.error('[safeGetBase64] File does not exist:', uri)
                    return null
                }
            } catch (e) {
                console.error('[safeGetBase64] Error checking file:', e)
                return null
            }
        }

        // 3. DETERMINE MIME TYPE
        const mimeType = getMimeTypeFromUri(uri)

        // 4. HANDLE REMOTE URLs
        if (uri.startsWith('http')) {
            try {
                const cacheDir = `${FileSystem.documentDirectory}novaglow-ai/`
                
                // Ensure directory exists
                const dirInfo = await FileSystem.getInfoAsync(cacheDir)
                if (!dirInfo.exists) {
                    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true })
                }

                const filename = `download-${Date.now()}.tmp`
                const downloaded = await FileSystem.downloadAsync(uri, `${cacheDir}${filename}`)
                uri = downloaded.uri
            } catch (e) {
                console.error('[safeGetBase64] Download failed:', e)
                return null
            }
        }

        // 5. READ AND ENCODE TO BASE64
        try {
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
            
            // VALIDATE base64 output
            if (!base64 || typeof base64 !== 'string') {
                console.error('[safeGetBase64] Base64 conversion resulted in invalid data:', typeof base64)
                return null
            }

            if (base64.length === 0) {
                console.error('[safeGetBase64] Base64 string is empty')
                return null
            }


            return { base64, mimeType }
        } catch (e) {
            console.error('[safeGetBase64] FileSystem.readAsStringAsync failed:', e)
            return null
        }
    } catch (e) {
        console.error('[safeGetBase64] Unexpected error:', e)
        return null
    }
}

/**
 * Detect MIME type from URI
 */
function getMimeTypeFromUri(uri: string, fallback = 'image/jpeg'): string {
    const lower = uri.split('?')[0].split('#')[0].toLowerCase()
    
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
    if (lower.endsWith('.webp')) return 'image/webp'
    if (lower.endsWith('.heic')) return 'image/heic'
    if (lower.endsWith('.gif')) return 'image/gif'
    if (lower.endsWith('.mp4')) return 'video/mp4'
    if (lower.endsWith('.mov')) return 'video/quicktime'
    if (lower.endsWith('.webm')) return 'video/webm'
    
    return fallback
}

/**
 * Create a blurred/pixelated version of image at specific coordinates
 * 
 * Usage: Apply blur effect to erased areas
 * Returns: Base64 encoded result
 */
export async function applyPixelBrushToImage(
    sourceImageBase64: string,
    points: { x: number; y: number; size: number }[],
    canvas: any = null
): Promise<string> {
    /**
     * MVP: Use canvas to create pixelated effect
     * 
     * Since expo doesn't provide native image manipulation,
     * we'll create a visual effect by:
     * 1. Rendering a modified version with pixelation
     * 2. Using the exported snapshot
     */
    
    if (!canvas) {
        // Fallback: return original base64
        console.warn('[ImageProcessing] No canvas available for pixel brush')
        return sourceImageBase64
    }

    try {
        // This will be called from editor context with canvas reference
        // For now, return placeholder
        return sourceImageBase64
    } catch (err) {
        console.error('[ImageProcessing] Pixel brush error:', err)
        return sourceImageBase64
    }
}

/**
 * Composite two images: foreground over background
 * 
 * Usage: Blend removed-bg portrait with selected backdrop
 * Returns: URI to composited image
 */
export async function compositeImages(
    foregroundBase64: string,
    backgroundUri: string,
    blurAmount: number = 0
): Promise<{ uri: string; base64: string }> {
    /**
     * MVP: Create visual composite by:
     * 1. Both images loaded as Image sources
     * 2. Render to canvas (if available)
     * 3. Export result
     * 
     * React Native limitation: No native canvas API
     * Workaround: Use react-native-view-shot to capture View hierarchy
     */
    
    try {
        // For MVP, this is handled by the editor's viewport capture
        // The viewport renderer already composites images visually
        // We just need to ensure proper export
        
        return {
            uri: backgroundUri,
            base64: foregroundBase64
        }
    } catch (err) {
        console.error('[ImageProcessing] Composite error:', err)
        return { uri: backgroundUri, base64: foregroundBase64 }
    }
}

/**
 * Create a story graphic overlay
 * 
 * Usage: Generate magazine/neon/retro/influencer layout graphic
 * Returns: URI to generated overlay or composited image
 */
export async function generateStoryGraphic(
    sourceImageBase64: string,
    layout: 'magazine' | 'retro' | 'neon' | 'influencer',
    title: string,
    textSize: number = 32,
    textColor: string = '#ffffff'
): Promise<{ uri: string; base64: string }> {
    /**
     * MVP: Return the base64 as-is
     * The UI already renders visual overlays
     * On export, we capture the viewport which includes the overlay
     */
    
    try {
        // The actual graphic generation happens in React Native View
        // We just ensure proper export via viewport capture
        return {
            uri: '',
            base64: sourceImageBase64
        }
    } catch (err) {
        console.error('[ImageProcessing] Story graphic error:', err)
        return { uri: '', base64: sourceImageBase64 }
    }
}

/**
 * Generate a solid color background
 * Used as fallback or for simple backgrounds
 */
export async function generateSolidBackground(
    width: number,
    height: number,
    color: string = '#000000'
): Promise<string> {
    try {
        const cacheDir = `${FileSystem.documentDirectory}novaglow-ai/`
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true })
        
        // For MVP: Create a simple color swatch
        // This will be replaced with actual image generation
        const filename = `solid-${color.replace('#', '')}-${Date.now()}.png`
        const filepath = `${cacheDir}${filename}`
        
        // Return placeholder - actual implementation requires canvas library
        console.warn('[ImageProcessing] Solid background generation requires canvas library')
        return ''
    } catch (err) {
        console.error('[ImageProcessing] Solid background error:', err)
        return ''
    }
}

/**
 * Blur an image region for object eraser effect
 */
export async function blurImageRegion(
    sourceBase64: string,
    regionPoints: { x: number; y: number; size: number }[],
    blurRadius: number = 15
): Promise<string> {
    /**
     * MVP: Since React Native has no native image processing,
     * we document what SHOULD happen:
     * 
     * 1. Decode base64 to image data
     * 2. Apply box blur filter to specified regions
     * 3. Re-encode to base64
     * 
     * For now, the editor viewport already shows visual blur
     * via React Native's built-in blurRadius prop
     */
    
    
    // Return original - visual blur shown in viewport
    return sourceBase64
}

/**
 * Apply pixelation to image regions
 */
export async function pixelateImageRegion(
    sourceBase64: string,
    regionPoints: { x: number; y: number; size: number }[],
    pixelSize: number = 8
): Promise<string> {
    /**
     * MVP: Apply pixelation effect
     * 
     * Algorithm:
     * 1. For each region point
     * 2. Group pixels into blocks of pixelSize x pixelSize
     * 3. Average color of each block
     * 4. Fill block with average color
     * 
     * Requires: Image processing library or canvas
     */
    
    
    // Return original - viewport shows effect
    return sourceBase64
}

/**
 * Detect and remove background using local model
 * (Hugging Face RMBG-1.4 or similar)
 * 
 * For MVP: Returns original image
 * In production: Called by Supabase function with real model
 */
export async function localBackgroundRemoval(
    imageBase64: string
): Promise<{ success: boolean; result?: string; error?: string }> {
    try {
        return { 
            success: false, 
            error: 'Local background removal not available in MVP. Configure Supabase function with API keys.'
        }
    } catch (err) {
        return { 
            success: false, 
            error: String(err)
        }
    }
}

export default {
    applyPixelBrushToImage,
    compositeImages,
    generateStoryGraphic,
    generateSolidBackground,
    blurImageRegion,
    pixelateImageRegion,
    localBackgroundRemoval
}
