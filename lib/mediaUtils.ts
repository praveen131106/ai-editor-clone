import * as FileSystem from 'expo-file-system/legacy'

/**
 * Copy a picked image/video to the app's document directory.
 * 
 * WHY: ImagePicker returns URIs in the Expo Go cache directory with
 * double-encoded paths (e.g. %2540anonymous%252F). These paths:
 *   1. Break when passed through Expo Router (which URL-encodes them again)
 *   2. Break when decoded with decodeURIComponent (wrong path)
 *   3. Are temporary and can be deleted by the OS at any time
 * 
 * SOLUTION: Immediately copy the file to our own documentDirectory
 * with a clean, predictable filename. This gives us a stable URI
 * that works everywhere.
 */

const MEDIA_DIR = `${FileSystem.documentDirectory}novaglow-media/`

/**
 * Ensure the media directory exists
 */
async function ensureMediaDir(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(MEDIA_DIR)
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true })
        console.log('[MediaUtils] Created media directory:', MEDIA_DIR)
    }
}

export async function copyToAppStorage(sourceUri: string, isVideo = false): Promise<string> {
    await ensureMediaDir()
 
    // Determine a valid extension
    let extension = sourceUri.split('.').pop()?.split('?')[0] || 'jpg'
    if (isVideo) {
        extension = 'mp4'
    } else if (extension.length > 4 || extension.includes('/') || extension.includes(':')) {
        extension = 'jpg'
    }

    const filename = `novaglow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`
    const destUri = `${MEDIA_DIR}${filename}`
 
    console.log('[MediaUtils] Copying file:')
    console.log('[MediaUtils]   FROM:', sourceUri)
    console.log('[MediaUtils]   TO:', destUri)
 
    try {
        await FileSystem.copyAsync({
            from: sourceUri,
            to: destUri,
        })
 
        // Verify the copy worked
        const info = await FileSystem.getInfoAsync(destUri)
        console.log('[MediaUtils] Copy result:', JSON.stringify(info))
 
        if (!info.exists) {
            throw new Error('File copy succeeded but file does not exist at destination')
        }
 
        return destUri
    } catch (error) {
        console.error('[MediaUtils] Copy failed:', error)
        // Fallback: return original URI
        console.warn('[MediaUtils] Falling back to original URI')
        return sourceUri
    }
}

/**
 * Check if a file URI actually exists and has content
 */
export async function validateFileUri(uri: string): Promise<{
    exists: boolean
    size: number
    isDirectory: boolean
    uri: string
}> {
    try {
        const info = await FileSystem.getInfoAsync(uri)
        console.log('[MediaUtils] Validate:', uri.slice(-50), '→', JSON.stringify(info))
        return {
            exists: info.exists,
            size: (info as any).size || 0,
            isDirectory: (info as any).isDirectory || false,
            uri,
        }
    } catch (error) {
        console.error('[MediaUtils] Validate error:', error)
        return { exists: false, size: 0, isDirectory: false, uri }
    }
}

/**
 * Clean up old media files (keep last 20)
 */
export async function cleanupOldMedia(): Promise<void> {
    try {
        await ensureMediaDir()
        const files = await FileSystem.readDirectoryAsync(MEDIA_DIR)
        if (files.length > 20) {
            const toDelete = files.slice(0, files.length - 20)
            for (const file of toDelete) {
                await FileSystem.deleteAsync(`${MEDIA_DIR}${file}`, { idempotent: true })
            }
            console.log('[MediaUtils] Cleaned up', toDelete.length, 'old files')
        }
    } catch (error) {
        console.warn('[MediaUtils] Cleanup error:', error)
    }
}

/**
 * Completely wipe out all local media cache files
 */
export async function clearAllMediaCache(): Promise<number> {
    try {
        await ensureMediaDir()
        const files = await FileSystem.readDirectoryAsync(MEDIA_DIR)
        let count = 0
        for (const file of files) {
            await FileSystem.deleteAsync(`${MEDIA_DIR}${file}`, { idempotent: true })
            count++
        }
        console.log('[MediaUtils] Wiped all media cache:', count, 'files removed')
        return count
    } catch (error) {
        console.warn('[MediaUtils] Wipe cache error:', error)
        return 0
    }
}
