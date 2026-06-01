import React, { createContext, useContext, useState, useCallback } from 'react'
import { Alert } from 'react-native'

/**
 * MediaContext — Global state for selected media.
 * 
 * This replaces passing media URIs through Expo Router params,
 * which is unreliable because router URL-encodes file:// paths
 * and temporary ImagePicker files can expire between navigations.
 * 
 * Flow:
 *   1. Home screen picks image/video → calls setMedia()
 *   2. Home screen navigates to /editor (no params needed)
 *   3. Editor reads media from context directly
 */

export interface MediaAsset {
    /** The stable, copied URI pointing to app document storage */
    uri: string
    /** Original URI from ImagePicker (for debugging) */
    originalUri: string
    /** 'image' or 'video' */
    type: 'image' | 'video'
    /** File size in bytes (0 if unknown) */
    fileSize: number
    /** Image width in pixels (0 if unknown) */
    width: number
    /** Image height in pixels (0 if unknown) */
    height: number
    /** Which tool to open in the editor */
    initialTool: string
    /** Optional filter preset ID */
    filterId: string
    /** Optional project ID for re-editing */
    projectId: string
}

interface MediaContextValue {
    /** The currently selected media asset */
    media: MediaAsset | null
    /** Set the media asset (call before navigating to editor) */
    setMedia: (asset: MediaAsset) => void
    /** Clear media (call after export/save) */
    clearMedia: () => void
    /** Debug log of last 10 set operations */
    debugLog: string[]
}

const MediaContext = createContext<MediaContextValue>({
    media: null,
    setMedia: () => {},
    clearMedia: () => {},
    debugLog: [],
})

export function useMedia() {
    return useContext(MediaContext)
}

export function MediaProvider({ children }: { children: React.ReactNode }) {
    const [media, setMediaState] = useState<MediaAsset | null>(null)
    const [debugLog, setDebugLog] = useState<string[]>([])

    const addLog = useCallback((msg: string) => {
        const timestamp = new Date().toISOString().slice(11, 23)
        const entry = `[${timestamp}] ${msg}`
        setDebugLog(prev => [...prev.slice(-9), entry])
    }, [])

    const setMedia = useCallback((asset: MediaAsset) => {
        addLog(`SET uri=${asset.uri.slice(-40)} type=${asset.type} size=${asset.fileSize} w=${asset.width} h=${asset.height}`)
        
        // Validate before setting
        if (!asset.uri || asset.uri.length === 0) {
            addLog('ERROR: Empty URI received!')
            Alert.alert('Error', 'No image URI received from picker.')
            return
        }

        setMediaState(asset)
    }, [addLog])

    const clearMedia = useCallback(() => {
        addLog('CLEAR media')
        setMediaState(null)
    }, [addLog])

    return (
        <MediaContext.Provider value={{ media, setMedia, clearMedia, debugLog }}>
            {children}
        </MediaContext.Provider>
    )
}
