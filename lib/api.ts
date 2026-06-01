import * as FileSystem from 'expo-file-system/legacy'
import { supabase, isSupabaseEnabled } from './supabase'
import { safeGetBase64 } from './imageProcessing'

type ImageServiceResponse = {
    success: boolean
    action: string
    provider?: string
    processedBase64?: string
    processedUrl?: string
    mimeType?: string
    optimizedPrompt?: string
    error?: string
}

const cacheRoot = `${FileSystem.documentDirectory}novaglow-ai/`

async function ensureCacheDir() {
    try {
        const info = await FileSystem.getInfoAsync(cacheRoot)
        if (!info.exists) {
            await FileSystem.makeDirectoryAsync(cacheRoot, { intermediates: true })
        }
    } catch (err) {
        console.error('[API] ensureCacheDir error:', err)
        throw err
    }
}

function mimeTypeForUri(uri: string, fallback = 'image/jpeg') {
    const lower = uri.split('?')[0].toLowerCase()
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.webp')) return 'image/webp'
    if (lower.endsWith('.heic')) return 'image/heic'
    return fallback
}

function appendQueryParam(url: string, key: string, value: string) {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

async function imageUriToBase64(uri: string) {
    const result = await safeGetBase64(uri)
    
    if (!result) {
        throw new Error('Unable to convert image URI to base64: safeGetBase64 returned null')
    }
    
    if (!result.base64) {
        console.error('[API] safeGetBase64 returned result without base64 property:', result)
        throw new Error('Unable to convert image URI to base64: result.base64 is undefined')
    }
    
    return result
}

async function writeBase64Image(base64: string, mimeType = 'image/png', prefix = 'ai-image') {
    await ensureCacheDir()
    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png'
    const uri = `${cacheRoot}${prefix}-${Date.now()}.${ext}`
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: 'base64' })
    return uri
}

async function invokeImageFunction(body: Record<string, unknown>) {
    if (!isSupabaseEnabled) {
        throw new Error('AI backend is not configured. Set Supabase env vars and deploy the process-image function.')
    }

    const { data, error } = await supabase.functions.invoke<ImageServiceResponse>('process-image', { body })
    if (error) throw new Error(error.message)
    if (!data?.success) throw new Error(data?.error || 'AI service returned no result.')
    return data
}

export async function removeBackgroundAPI(mediaUrl: string): Promise<{ uri: string; provider?: string; mimeType: string }> {
    try {
        if (!isSupabaseEnabled) {
            return {
                uri: appendQueryParam(mediaUrl, 'bg', 'removed'),
                provider: 'offline-mock',
                mimeType: 'image/png',
            }
        }

        const source = await imageUriToBase64(mediaUrl)
        const data = await invokeImageFunction({
            action: 'remove-bg',
            mediaBase64: source.base64,
            mimeType: source.mimeType,
        })

        if (!data.processedBase64) {
            throw new Error('Background removal did not return a transparent PNG.')
        }

        const mimeType = data.mimeType || 'image/png'
        return {
            uri: await writeBase64Image(data.processedBase64, mimeType, 'removed-bg'),
            provider: data.provider,
            mimeType,
        }
    } catch (err: any) {
        console.error('[API] Background removal failed:', err.message)
        if (err.message?.includes('AI backend is not configured') || err.message?.includes('Supabase env vars')) {
            throw new Error('Background removal service unavailable. Please configure Supabase backend.')
        }
        throw err
    }
}

export async function generateAvatarAPI(
    mediaUrl: string,
    style: string
): Promise<{ uri: string; provider?: string; optimizedPrompt?: string; mimeType: string }> {
    try {
        const source = await imageUriToBase64(mediaUrl)
        const data = await invokeImageFunction({
            action: 'generate-avatar',
            mediaBase64: source.base64,
            mimeType: source.mimeType,
            additionalParams: { style },
        })

        if (!data.processedBase64) {
            throw new Error('Avatar generation did not return an image.')
        }

        const mimeType = data.mimeType || 'image/png'
        return {
            uri: await writeBase64Image(data.processedBase64, mimeType, `avatar-${style}`),
            provider: data.provider,
            optimizedPrompt: data.optimizedPrompt,
            mimeType,
        }
    } catch (err: any) {
        console.error('[API] Avatar generation failed:', err.message)
        if (err.message?.includes('AI backend is not configured') || err.message?.includes('Supabase env vars')) {
            throw new Error('Avatar generation service unavailable. Please configure Supabase backend.')
        }
        throw err
    }
}

export async function smartHealingAPI(mediaUrl: string, points: { x: number; y: number }[]): Promise<string> {
    try {
        if (!isSupabaseEnabled) {
            return appendQueryParam(mediaUrl, 'healed', 'true')
        }

        const source = await imageUriToBase64(mediaUrl)
        const data = await invokeImageFunction({
            action: 'smart-healing',
            mediaBase64: source.base64,
            mimeType: source.mimeType,
            additionalParams: { points },
        })
        return data.processedBase64
            ? writeBase64Image(data.processedBase64, data.mimeType || source.mimeType, 'healed-image')
            : mediaUrl
    } catch (err: any) {
        console.error('[API] Smart healing failed:', err.message)
        if (err.message?.includes('AI backend is not configured') || err.message?.includes('Supabase env vars')) {
            throw new Error('Smart healing service unavailable. Please configure Supabase backend.')
        }
        throw err
    }
}

export async function aiGenerateBackdropAPI(prompt: string): Promise<string> {
    try {
        if (!isSupabaseEnabled) {
            const normalized = prompt.toLowerCase()
            if (normalized.includes('neon') || normalized.includes('cyberpunk')) {
                return 'https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?q=80&w=600&auto=format&fit=crop'
            }
            if (normalized.includes('sunny beach') || normalized.includes('sunset') || normalized.includes('tropical ocean')) {
                return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600&auto=format&fit=crop'
            }
            if (normalized.includes('glass') || normalized.includes('gradient') || normalized.includes('frosted')) {
                return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop'
            }
            if (normalized.includes('luxury') || normalized.includes('marble')) {
                return 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop'
            }
            return 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop'
        }

        const data = await invokeImageFunction({
            action: 'generate-backdrop',
            additionalParams: { prompt },
        })
        if (data.processedBase64) {
            return writeBase64Image(data.processedBase64, data.mimeType || 'image/png', 'generated-backdrop')
        }
        if (data.processedUrl) return data.processedUrl
        throw new Error('Backdrop generation did not return an image.')
    } catch (err: any) {
        console.error('[API] Backdrop generation failed:', err.message)
        if (err.message?.includes('AI backend is not configured') || err.message?.includes('Supabase env vars')) {
            throw new Error('Backdrop generation service unavailable. Please configure Supabase backend.')
        }
        throw err
    }
}
