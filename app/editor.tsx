import { useState, useRef, useEffect, useMemo } from 'react'
import {
    View,
    StyleSheet,
    Pressable,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    TextInput,
    Alert,
    Image
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { captureRef } from 'react-native-view-shot'
let Audio: any = null
let Video: any = null
let ResizeMode: any = { CONTAIN: 'contain' }

try {
    const expoAv = require('expo-av')
    Audio = expoAv.Audio
    Video = expoAv.Video
    if (expoAv.ResizeMode) {
        ResizeMode = expoAv.ResizeMode
    }
} catch (e) {
    console.warn('[expo-av] Native modules are not available in this client, falling back to simulated engine.')
}

import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import {
    ACCENT,
    ACCENT_DIM,
    BG,
    BORDER,
    SURFACE,
    SURFACE2,
    TEXT_PRIMARY,
    TEXT_SECONDARY,
    TEXT_TERTIARY,
} from '@/lib/theme'
import {
    AI_STYLE_FILTERS,
    AUDIO_TRACKS,
    STOCK_PORTRAITS,
    STOCK_VIDEOS,
    AI_STORY_TEMPLATES,
    type AIStyleFilter
} from '@/lib/mockData'
import { useMedia } from '@/contexts/MediaContext'
import { useToast } from '@/contexts/ToastContext'
import { generateAvatarAPI, removeBackgroundAPI } from '@/lib/api'
import { copyToAppStorage, validateFileUri } from '@/lib/mediaUtils'

const { width: SW, height: SH } = Dimensions.get('window')
const VIEWPORT_H = SH * 0.46

type ActiveTab = 'retouch' | 'background' | 'video' | 'filters' | 'audio' | 'eraser' | 'avatar' | 'story'
type AvatarStyleId = 'professional' | 'anime' | 'cyberpunk' | 'fashion' | 'influencer'

const BACKGROUND_SCENES = [
    { id: 'beach', name: 'Beach', image: require('../assets/backgrounds/beach.jpg') },
    { id: 'office', name: 'Office', image: require('../assets/backgrounds/office.jpg') },
    { id: 'studio', name: 'Studio', image: require('../assets/backgrounds/studio.jpg') },
    { id: 'sunset', name: 'Sunset', image: require('../assets/backgrounds/sunset.jpg') },
    { id: 'luxury', name: 'Luxury Room', image: require('../assets/backgrounds/luxury.jpg') },
]

const AVATAR_STYLE_OPTIONS: { id: AvatarStyleId; name: string; icon: keyof typeof Ionicons.glyphMap; tint: string }[] = [
    { id: 'professional', name: 'Professional', icon: 'briefcase-outline', tint: '#94a3b8' },
    { id: 'anime', name: 'Anime', icon: 'sparkles-outline', tint: '#facc15' },
    { id: 'cyberpunk', name: 'Cyberpunk', icon: 'flash-outline', tint: '#06b6d4' },
    { id: 'fashion', name: 'Fashion', icon: 'diamond-outline', tint: '#d6d3d1' },
    { id: 'influencer', name: 'Influencer', icon: 'heart-outline', tint: '#fb7185' },
]

export default function EditorScreen() {
    const insets = useSafeAreaInsets()
    const { showToast } = useToast()
    
    // Read media from global context (NOT from router params)
    const { media, setMedia } = useMedia()

    const mediaType = media?.type || 'image'
    const mediaUrl = media?.uri || STOCK_PORTRAITS[0].url
    const initialFilterId = media?.filterId || ''
    
    // Local media state for instantaneous camera & gallery pickers
    const [mediaUrlState, setMediaUrlState] = useState<string>(mediaUrl)

    // Sync from context when it changes
    useEffect(() => {
        if (media?.uri) {
            setMediaUrlState(media.uri)
        }
    }, [media?.uri])
    
    // Map entry point parameters safely to ActiveTab keys
    const initialTool = useMemo<ActiveTab>(() => {
        const raw = media?.initialTool || 'retouch'
        if (raw === 'beauty') return 'retouch'
        if (raw === 'bg_swap') return 'background'
        if (raw === 'trimmer') return 'video'
        return (raw as ActiveTab)
    }, [media?.initialTool])

    // Editor State
    const [activeTab, setActiveTab] = useState<ActiveTab>(initialTool)
    const [isSaving, setIsSaving] = useState(false)
    const viewportRef = useRef<View>(null)
    
    const [showCompare, setShowCompare] = useState(false)

    // A. Object Eraser Parameters
    const [eraserBrushSize, setEraserBrushSize] = useState(30)
    const [eraserPoints, setEraserPoints] = useState<{ x: number; y: number; size?: number }[]>([])
    const [healedPoints, setHealedPoints] = useState<{ x: number; y: number; size?: number }[]>([])
    const [isErasingSimulated, setIsErasingSimulated] = useState(false)
    const [healingProgress, setHealingProgress] = useState(0)
    const [isObjectErased, setIsObjectErased] = useState(false)

    // B. AI Avatar Parameters
    const [selectedAvatarStyle, setSelectedAvatarStyle] = useState<AvatarStyleId>('professional')
    const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null)
    const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false)
    const [avatarProgress, setAvatarProgress] = useState(0)
    const [avatarError, setAvatarError] = useState('')

    // C. AI Story Parameters
    const [selectedStoryLayout, setSelectedStoryLayout] = useState<'magazine' | 'retro' | 'neon' | 'influencer'>('magazine')
    const [storyTitleText, setStoryTitleText] = useState('NOVAGLOW CREATIVE')
    const [storyTextSize, setStoryTextSize] = useState(32)
    const [storyTextColor, setStoryTextColor] = useState('#ffffff')
    const mvpBackdrops = BACKGROUND_SCENES

    const currentMediaUrl = useMemo(() => {
        if (activeTab === 'avatar' && avatarImageUrl) return avatarImageUrl
        return mediaUrlState
    }, [activeTab, avatarImageUrl, mediaUrlState])


    // 1. AI Beauty Parameters
    const [smoothing, setSmoothing] = useState(60)
    const [glow, setGlow] = useState(40)
    const [lipColor, setLipColor] = useState('') // Default empty, no red mark
    const [eyeSize, setEyeSize] = useState(1.05) // Widen scale factor (1.0 to 1.20)
    const [faceSlim, setFaceSlim] = useState(0) // face slimming intensity (0 to 100)
    const [brightness, setBrightness] = useState(50)
    const [contrast, setContrast] = useState(50)
    const [saturation, setSaturation] = useState(50)
    const [sharpness, setSharpness] = useState(0)
    const [warmth, setWarmth] = useState(50)

    const changeMediaAction = async () => {
        Alert.alert(
            'Change Creative Asset',
            'Take a new photo/video or upload from camera roll:',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Take a Photo/Video',
                    onPress: async () => {
                        const permission = await ImagePicker.requestCameraPermissionsAsync()
                        if (!permission.granted) {
                            Alert.alert('Permission Denied', 'Camera access is required.')
                            return
                        }
                        const result = await ImagePicker.launchCameraAsync({
                            mediaTypes: mediaType === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
                            allowsEditing: true,
                            aspect: [9, 16],
                            quality: 1,
                        })
                        if (!result.canceled && result.assets && result.assets.length > 0) {
                            const pickedUri = result.assets[0]?.uri
                            
                            // Copy to app storage
                            const stableUri = await copyToAppStorage(pickedUri)
                            const validation = await validateFileUri(stableUri)
                            
                            if (validation.exists) {
                                setMediaUrlState(stableUri)
                                setMedia({
                                    uri: stableUri,
                                    originalUri: pickedUri,
                                    type: mediaType,
                                    fileSize: validation.size,
                                    width: result.assets[0]?.width || 0,
                                    height: result.assets[0]?.height || 0,
                                    initialTool: activeTab,
                                    filterId: initialFilterId,
                                    projectId: '',
                                })
                            } else {
                                Alert.alert('Error', 'Failed to save captured photo to storage.')
                            }
                        }
                    }
                },
                {
                    text: 'Choose from Camera Roll',
                    onPress: async () => {
                        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
                        if (!permission.granted) {
                            Alert.alert('Permission Denied', 'Media library access is required.')
                            return
                        }
                        const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: mediaType === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
                            allowsEditing: mediaType === 'image',
                            aspect: [9, 16],
                            quality: 1,
                        })
                        if (!result.canceled && result.assets && result.assets.length > 0) {
                            const pickedUri = result.assets[0]?.uri
                            
                            // Copy to app storage
                            const stableUri = await copyToAppStorage(pickedUri, mediaType === 'video')
                            const validation = await validateFileUri(stableUri)
                            
                            if (validation.exists) {
                                setMediaUrlState(stableUri)
                                setMedia({
                                    uri: stableUri,
                                    originalUri: pickedUri,
                                    type: mediaType,
                                    fileSize: validation.size,
                                    width: result.assets[0]?.width || 0,
                                    height: result.assets[0]?.height || 0,
                                    initialTool: activeTab,
                                    filterId: initialFilterId,
                                    projectId: '',
                                })
                            } else {
                                Alert.alert('Error', 'Failed to save picked image to storage.')
                            }
                        }
                    }
                }
            ]
        )
    }

    // 2. Background Removal & Replacement
    const [isBgRemoved, setIsBgRemoved] = useState(false)
    const [selectedBackdrop, setSelectedBackdrop] = useState<string>('none')
    const [bgRemovedImageUrl, setBgRemovedImageUrl] = useState<string | null>(null)
    const [isRemovingBg, setIsRemovingBg] = useState(false)
    const [bgRemovalProgress, setBgRemovalProgress] = useState(0)
    const [bgRemovalError, setBgRemovalError] = useState('')
    const [bgBlur, setBgBlur] = useState(0) // background blur intensity (0 to 100)
    const foregroundMediaUrl = isBgRemoved && bgRemovedImageUrl ? bgRemovedImageUrl : currentMediaUrl
    const selectedBackgroundScene = useMemo(
        () => BACKGROUND_SCENES.find((scene) => scene.id === selectedBackdrop) || BACKGROUND_SCENES[0],
        [selectedBackdrop]
    )

    // 3. Video Trimming & FX
    const [trimStart, setTrimStart] = useState(0) // percentage
    const [trimEnd, setTrimEnd] = useState(100) // percentage
    const [selectedFx, setSelectedFx] = useState<string>('none') // none, glitch, grain, light_leak
    const [isVideoPlaying, setIsVideoPlaying] = useState(true)
    const [videoOverlayText, setVideoOverlayText] = useState('NOVAGLOW VIDEO')

    // 4. Filters & Presets
    const [activeFilterId, setActiveFilterId] = useState<string>(initialFilterId)

    // 5. Soundtrack Overlay
    const [activeAudioId, setActiveAudioId] = useState<string>('none')
    const [audioVolume, setAudioVolume] = useState(80)
    const [soundObject, setSoundObject] = useState<any | null>(null)

    // Detect if model is standard stock to render high-fidelity mask cutout
    const stockModel = useMemo(() => {
        const matchingPortrait = STOCK_PORTRAITS.find(p => p.url === mediaUrlState)
        if (matchingPortrait) return matchingPortrait.id
        
        // Check if mediaUrl matches a stock video
        const matchingVideo = STOCK_VIDEOS.find(v => v.url === mediaUrlState)
        if (matchingVideo) return matchingVideo.id
        
        return null
    }, [mediaUrlState])

    // Load filter preset details when filter is clicked
    const applyFilterPreset = (filter: AIStyleFilter) => {
        setActiveFilterId(filter.id)
        setSmoothing(filter.intensity)
        setGlow(filter.glowIntensity)
        // setLipColor(filter.lipColor) // Disabled — lip overlay removed to prevent red mark in exports
        setEyeSize(filter.eyeSize)
        setSelectedFx(filter.overlayStyle)

        // Custom preset curves
        if (filter.id === 'filter-glamx') {
            // NovaGlow Signature
            setBrightness(60)
            setContrast(62)
            setSaturation(70)
            setSharpness(70)
            setWarmth(55)
        } else if (filter.id === 'filter-golden') {
            // Golden Hour
            setBrightness(58)
            setContrast(52)
            setSaturation(65)
            setSharpness(45)
            setWarmth(78)
        } else if (filter.id === 'filter-soft') {
            // Soft Beauty
            setBrightness(65)
            setContrast(48)
            setSaturation(52)
            setSharpness(10)
            setWarmth(52)
        } else if (filter.id === 'filter-luxury') {
            // Luxury Portrait
            setBrightness(48)
            setContrast(72)
            setSaturation(40)
            setSharpness(85)
            setWarmth(48)
        } else if (filter.id === 'filter-studio') {
            // Studio Light
            setBrightness(72)
            setContrast(55)
            setSaturation(50)
            setSharpness(60)
            setWarmth(50)
        } else if (filter.id === 'filter-natural') {
            // Natural Glow
            setBrightness(60)
            setContrast(52)
            setSaturation(54)
            setSharpness(30)
            setWarmth(55)
        } else if (filter.id === 'filter-model') {
            // Fashion Model
            setBrightness(52)
            setContrast(68)
            setSaturation(45)
            setSharpness(80)
            setWarmth(44)
        } else if (filter.id === 'filter-influencer') {
            // Influencer
            setBrightness(62)
            setContrast(54)
            setSaturation(60)
            setSharpness(50)
            setWarmth(58)
        } else {
            // Fallback
            setBrightness(60)
            setContrast(52)
            setSaturation(54)
            setSharpness(30)
            setWarmth(55)
        }
    }

    // Audio integration logic
    useEffect(() => {
        return () => {
            if (soundObject) {
                soundObject.unloadAsync()
            }
        }
    }, [soundObject])

    const toggleAudioTrack = async (audioId: string) => {
        if (activeAudioId === audioId) {
            setActiveAudioId('none')
            if (soundObject) {
                await soundObject.stopAsync()
            }
            return
        }

        setActiveAudioId(audioId)
        // Simulated audio trigger: in production, load local asset/url
        // e.g. Audio.Sound.createAsync(...)
    }

    const handleSmartErase = () => {
        if (eraserPoints.length === 0) return
        
        // MVP: Apply blur effect visualization
        // The eraser points are already collected from touch input
        // Setting isObjectErased flag tells export to bake the viewport
        // which includes the visual blur circles overlaid on the image
        
        setIsErasingSimulated(true)
        setHealingProgress(0)
        
        const timer = setInterval(() => {
            setHealingProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(timer)
                    setIsErasingSimulated(false)
                    setHealedPoints((prev) => [...prev, ...eraserPoints])
                    setIsObjectErased(true)
                    setEraserPoints([])
                    showToast('Object erased! Export to save.', 'success')
                    return 100
                }
                return prev + 12
            })
        }, 150)
    }

    const handleToggleBackgroundRemoval = async () => {
        if (isBgRemoved) {
            setIsBgRemoved(false)
            return
        }

        if (bgRemovedImageUrl) {
            setSelectedBackdrop(selectedBackdrop === 'none' ? 'beach' : selectedBackdrop)
            setIsBgRemoved(true)
            return
        }

        await handleRemoveBackground()
    }

    const handleSelectBackdrop = (backdropId: string) => {
        setSelectedBackdrop(backdropId)
        // MVP: Allow background selection without requiring actual bg removal
        // User can still change backdrop even if bgRemovedImageUrl is not set
        if (backdropId !== 'none') {
            // Enable background mode with selected backdrop
            setIsBgRemoved(true)
        } else {
            setIsBgRemoved(false)
        }
    }

    const handleRemoveBackground = async () => {
        Alert.alert('Coming Soon', 'AI Background Removal requires backend configuration. Use the Backdrop tab to swap backgrounds with local scenes instead.')
    }

    const handleSelectAvatarStyle = async (styleId: AvatarStyleId) => {
        Alert.alert('Coming Soon', 'AI Avatar Generator requires backend configuration. This feature will be available in a future update.')
    }

    const handleSelectStoryLayout = (layout: 'magazine' | 'retro' | 'neon' | 'influencer') => {
        setSelectedStoryLayout(layout)
        if (!storyTitleText.trim()) {
            setStoryTitleText('NOVAGLOW CREATIVE')
        }
    }

    // Direct routing to export flow
    const navigateToExport = async () => {
        setIsSaving(true)
        try {
            let finalUri = (activeTab === 'avatar' && avatarImageUrl) ? avatarImageUrl : mediaUrlState
            if (activeTab === 'background' && isBgRemoved && selectedBackdrop === 'none' && bgRemovedImageUrl) {
                finalUri = bgRemovedImageUrl
            }
            
            // If the user has made ANY changes, let's capture the view ref directly to bake all edits!
            if (
                smoothing > 0 || glow > 0 || lipColor || warmth !== 50 || 
                brightness !== 50 || contrast !== 50 || saturation !== 50 || sharpness > 0 || 
                (isBgRemoved && selectedBackdrop !== 'none') || isObjectErased || eraserPoints.length > 0 || activeTab === 'story' || activeTab === 'avatar' || activeTab === 'video'
            ) {
                // Wait briefly for UI layout to settle
                await new Promise((resolve) => setTimeout(resolve, 150))
                
                const captured = await captureRef(viewportRef, {
                    format: 'jpg',
                    quality: 0.95,
                    result: 'tmpfile'
                })
                
                if (captured) {
                    finalUri = captured
                }
            }
            
            if (media) {
                setMedia({
                    ...media,
                    uri: finalUri,
                })
            }
            
            let editsSummary = `Smooth: ${smoothing}%, Glow: ${glow}%, Tint: ${lipColor}, FX: ${selectedFx}`
            if (isBgRemoved) {
                editsSummary = 'Removed backdrop, swapped background'
            } else if (activeTab === 'eraser' && isObjectErased) {
                editsSummary = 'Erased object from image using AI Smart Healing'
            } else if (activeTab === 'avatar' && avatarImageUrl) {
                editsSummary = `Generated AI Avatar in ${selectedAvatarStyle} style`
            } else if (activeTab === 'story') {
                editsSummary = `Created AI Story with template ${selectedStoryLayout} layout`
            } else if (activeTab === 'video') {
                editsSummary = `Video Studio export with ${selectedFx} filter and text overlay`
            }

            router.push({
                pathname: '/export',
                params: {
                    editsSummary,
                    smoothing: smoothing.toString(),
                    glow: glow.toString(),
                    lipColor,
                    eyeSize: eyeSize.toString(),
                    selectedFx,
                    selectedBackdrop,
                    isBgRemoved: isBgRemoved.toString()
                }
            })
        } catch (err) {
            console.error('[Editor] Viewport capture failed, falling back:', err)
            const finalUri = (activeTab === 'avatar' && avatarImageUrl) ? avatarImageUrl : mediaUrlState
            if (media) {
                setMedia({ ...media, uri: finalUri })
            }
            router.push({
                pathname: '/export',
                params: { editsSummary: 'Custom adjustments applied' }
            })
        } finally {
            setIsSaving(false)
        }
    }

    const bottomNavItems = useMemo(() => {
        if (mediaType === 'video') {
            return [
                { key: 'video', label: 'Studio', icon: 'videocam' },
                { key: 'audio', label: 'Music', icon: 'musical-notes' },
                { key: 'filters', label: 'AI Presets', icon: 'color-palette' }
            ]
        } else {
            return [
                { key: 'retouch', label: 'Retouch', icon: 'sparkles' },
                { key: 'background', label: 'Backdrop', icon: 'image' },
                { key: 'eraser', label: 'Eraser', icon: 'color-wand' },
                { key: 'story', label: 'AI Story', icon: 'images' },
                { key: 'filters', label: 'AI Presets', icon: 'color-palette' }
            ]
        }
    }, [mediaType])

    return (
        <View style={{ flex: 1, backgroundColor: BG }}>
            {/* Header bar */}
            <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={s.navBtn}>
                    <Ionicons name="close" size={24} color="#fff" />
                </Pressable>
                
                {/* Visual Tool Name */}
                <Text style={s.headerTitle}>Studio Creator</Text>

                <Pressable
                    onPress={navigateToExport}
                    style={({ pressed }) => [s.exportBtn, pressed && { opacity: 0.85 }]}
                >
                    <Text style={s.exportBtnText}>EXPORT</Text>
                    <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: 2 }} />
                </Pressable>
            </View>

            {/* Main Creative Viewport Wrapper */}
            <View style={{ width: SW, height: VIEWPORT_H, position: 'relative' }}>
                <View 
                    ref={viewportRef}
                    style={s.viewportContainer}
                    onStartShouldSetResponder={() => activeTab === 'eraser'}
                    onResponderGrant={(evt) => {
                        if (activeTab !== 'eraser' || isErasingSimulated) return
                        const { locationX, locationY } = evt.nativeEvent
                        setEraserPoints([{ x: locationX, y: locationY, size: eraserBrushSize }])
                        setIsObjectErased(true)
                    }}
                    onResponderMove={(evt) => {
                        if (activeTab !== 'eraser' || isErasingSimulated) return
                        const { locationX, locationY } = evt.nativeEvent
                        setEraserPoints((prev) => [...prev, { x: locationX, y: locationY, size: eraserBrushSize }])
                        setIsObjectErased(true)
                    }}
                >
                    <View 
                        pointerEvents={activeTab === 'eraser' ? 'none' : 'auto'}
                        style={StyleSheet.absoluteFillObject}
                    >
                    {/* 1. Base Layer (Original Image / Video representation) */}
                    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    {mediaType === 'video' && Video ? (
                        <Video
                            source={{ uri: currentMediaUrl }}
                            style={s.viewportMedia}
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay={isVideoPlaying}
                            isLooping
                            isMuted={activeAudioId === 'none'}
                            volume={audioVolume / 100}
                        />
                    ) : (
                        <Image 
                            
                            source={{ uri: currentMediaUrl }} 
                            style={s.viewportMedia} 
                            resizeMode="contain"
                            
                            />
                    )}
                    {mediaType === 'video' && (
                        <Pressable 
                            onPress={() => setIsVideoPlaying(prev => !prev)} 
                            style={s.playOverlay}
                        >
                            <Ionicons name={isVideoPlaying ? 'pause' : 'play'} size={24} color="#fff" />
                        </Pressable>
                    )}
                </View>

                {/* 2. Swapped Background Backdrop Layer (If background is removed) */}
                {isBgRemoved && selectedBackdrop !== 'none' && (
                    <View 
                        pointerEvents="none" 
                        style={[
                            StyleSheet.absoluteFillObject,
                            { opacity: showCompare ? 0 : 1 }
                        ]}
                    >
                        <Image 
                            source={selectedBackgroundScene.image} 
                            style={{ width: '100%', height: '100%' }} 
                            resizeMode="cover" 
                        />
                    </View>
                )}

                {/* 3. AI Enhanced / Filtered Layer */}
                <View 
                    pointerEvents="none" 
                    style={[
                        StyleSheet.absoluteFillObject, 
                        { opacity: showCompare ? 0 : 1, overflow: 'hidden' }
                    ]}
                >
                    {/* Background Swapped Cutout Overlay — Subject as framed portrait on backdrop */}
                    {isBgRemoved ? (
                        <View style={{ width: SW, height: VIEWPORT_H, alignItems: 'center', justifyContent: 'center' }}>
                            {/* Subject photo — rendered as a framed portrait centered on the backdrop */}
                            <View style={{
                                width: SW * 0.72,
                                height: VIEWPORT_H * 0.82,
                                borderRadius: 18,
                                overflow: 'hidden',
                                borderWidth: 2.5,
                                borderColor: 'rgba(255,255,255,0.6)',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 8 },
                                shadowOpacity: 0.45,
                                shadowRadius: 16,
                                elevation: 12,
                            }}>
                                {mediaType === 'video' && Video ? (
                                    <Video
                                        source={{ uri: foregroundMediaUrl }}
                                        style={{ width: '100%', height: '100%' }}
                                        resizeMode={ResizeMode.CONTAIN}
                                        shouldPlay={isVideoPlaying}
                                        isLooping
                                        isMuted
                                    />
                                ) : (
                                    <>
                                        <Image 
                                            source={{ uri: foregroundMediaUrl }} 
                                            style={{ width: '100%', height: '100%' }} 
                                            resizeMode={bgRemovedImageUrl ? 'contain' : 'cover'}
                                        />
                                        {smoothing > 0 && (
                                            <Image 
                                                source={{ uri: foregroundMediaUrl }} 
                                                style={[StyleSheet.absoluteFillObject, { opacity: (smoothing / 100) * 0.55 }]} 
                                                blurRadius={Math.max(1, Math.round((smoothing / 100) * 12))}
                                                resizeMode={bgRemovedImageUrl ? 'contain' : 'cover'}
                                            />
                                        )}
                                        {warmth !== 50 && (
                                            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: warmth > 50 ? '#f59e0b' : '#3b82f6', opacity: Math.abs(warmth - 50) / 80 }]} />
                                        )}
                                        {saturation !== 50 && (
                                            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: saturation > 50 ? '#ec4899' : '#1a1a1a', opacity: Math.abs(saturation - 50) / 80 }]} />
                                        )}
                                        {contrast !== 50 && (
                                            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: contrast > 50 ? '#000' : '#888', opacity: Math.abs(contrast - 50) / 90 }]} />
                                        )}
                                        {brightness !== 50 && (
                                            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: brightness > 50 ? '#fff' : '#000', opacity: Math.abs(brightness - 50) / 90 }]} />
                                        )}
                                    </>
                                )}
                            </View>
                            {/* Subtle bottom gradient for depth */}
                            <LinearGradient
                                colors={['transparent', 'rgba(0,0,0,0.25)']}
                                style={[StyleSheet.absoluteFillObject, { top: VIEWPORT_H * 0.6 }]}
                            />
                        </View>
                    ) : (
                        <View style={{ width: SW, height: VIEWPORT_H }}>
                            {/* Standard original image displaying beauty filter tweaks (bilateral blur, lips red glow overlay) */}
                            {mediaType === 'video' && Video ? (
                                <Video
                                    source={{ uri: currentMediaUrl }}
                                    style={s.viewportMedia}
                                    resizeMode={ResizeMode.CONTAIN}
                                    shouldPlay={isVideoPlaying}
                                    isLooping
                                    isMuted
                                />
                            ) : (
                                <Image  source={{ uri: currentMediaUrl }} style={s.viewportMedia} resizeMode="contain"  />
                            )}

                            {/* Bilateral Blur / Smooth Skin duplicate overlay */}
                            {smoothing > 0 && (
                                <Image 
                                    source={{ uri: currentMediaUrl }} 
                                    style={[StyleSheet.absoluteFillObject, { opacity: (smoothing / 100) * 0.85 }]} 
                                    blurRadius={Math.max(1, Math.round((smoothing / 100) * 20))}
                                    resizeMode="contain"
                                />
                            )}

                            {/* Warmth Overlay (Orange/Amber for warm, Blue/Cyan for cool) */}
                            {warmth !== 50 && (
                                <View 
                                    style={[
                                        StyleSheet.absoluteFillObject, 
                                        { 
                                            backgroundColor: warmth > 50 ? '#f59e0b' : '#3b82f6', 
                                            opacity: Math.max(0, Math.abs(warmth - 50) / 65)
                                        }
                                    ]} 
                                />
                            )}

                            {/* Saturation Blending Overlay (Pink/Gray) */}
                            {saturation !== 50 && (
                                <View 
                                    style={[
                                        StyleSheet.absoluteFillObject, 
                                        { 
                                            backgroundColor: saturation > 50 ? '#ec4899' : '#1a1a1a', 
                                            opacity: Math.max(0, Math.abs(saturation - 50) / 55)
                                        }
                                    ]} 
                                />
                            )}

                            {/* Sharpness (Simulated Edge High-Contrast Overlay) */}
                            {sharpness > 0 && (
                                <View 
                                    style={[
                                        StyleSheet.absoluteFillObject, 
                                        { 
                                            backgroundColor: '#ffffff', 
                                            opacity: (sharpness / 100) * 0.22,
                                        }
                                    ]} 
                                />
                            )}
                            {sharpness > 0 && (
                                <View 
                                    style={[
                                        StyleSheet.absoluteFillObject, 
                                        { 
                                            backgroundColor: '#000000', 
                                            opacity: (sharpness / 100) * 0.16,
                                        }
                                    ]} 
                                />
                            )}

                            {/* High-fidelity Contrast Overlay */}
                            {contrast !== 50 && (
                                <View 
                                    style={[
                                        StyleSheet.absoluteFillObject, 
                                        { 
                                            backgroundColor: contrast > 50 ? '#000000' : '#888888', 
                                            opacity: contrast > 50 ? (contrast - 50) / 60 : (50 - contrast) / 60
                                        }
                                    ]} 
                                />
                            )}

                            {/* Brightness Overlay (White/Black) */}
                            {brightness !== 50 && (
                                <View 
                                    style={[
                                        StyleSheet.absoluteFillObject, 
                                        { 
                                            backgroundColor: brightness > 50 ? '#ffffff' : '#000000', 
                                            opacity: brightness > 50 ? (brightness - 50) / 55 : (50 - brightness) / 55 
                                        }
                                    ]} 
                                />
                            )}
                            
                            {/* Lip Tint removed — was causing red mark in exported images */}

                            {/* Retro Glitch/VHS FX Overlay */}
                            {selectedFx === 'glitch' && (
                                <LinearGradient
                                    colors={['rgba(255,0,127,0.15)', 'rgba(0,242,254,0.15)']}
                                    style={StyleSheet.absoluteFillObject}
                                />
                            )}
                            {selectedFx === 'grain' && (
                                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
                            )}
                            {selectedFx === 'light_leak' && (
                                <LinearGradient
                                    colors={['rgba(239,68,68,0.22)', 'rgba(245,158,11,0.18)', 'transparent']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={StyleSheet.absoluteFillObject}
                                />
                            )}
                            {mediaType === 'video' && !!videoOverlayText.trim() && (
                                <View style={s.videoTextOverlay}>
                                    <Text style={s.videoTextOverlayText}>{videoOverlayText.trim()}</Text>
                                </View>
                            )}

                            {/* Object Eraser blurred patches */}
                            {[...healedPoints, ...eraserPoints].map((pt: any, idx) => {
                                const size = pt.size || eraserBrushSize
                                const scaledBlur = Math.max(12, Math.round(size * 0.7))
                                return (
                                    <View
                                        key={idx}
                                        style={{
                                            position: 'absolute',
                                            left: pt.x - size / 2,
                                            top: pt.y - size / 2,
                                            width: size,
                                            height: size,
                                            borderRadius: size / 2,
                                            overflow: 'hidden',
                                            zIndex: 15
                                        }}
                                    >
                                        <Image
                                            source={{ uri: currentMediaUrl }}
                                            style={{
                                                position: 'absolute',
                                                left: -pt.x + size / 2,
                                                top: -pt.y + size / 2,
                                                width: SW,
                                                height: VIEWPORT_H,
                                            }}
                                            resizeMode="contain"
                                            blurRadius={scaledBlur}
                                        />
                                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
                                    </View>
                                )
                            })}
                        </View>
                    )}
                </View>

                {/* 4. Interactive Object Eraser Mask Overlay */}
                {activeTab === 'eraser' && (
                    <>
                        {/* Current eraser points being drawn */}
                        {eraserPoints.map((pt: any, idx) => {
                            const size = pt.size || eraserBrushSize
                            return (
                                <View
                                    key={idx}
                                    style={{
                                        position: 'absolute',
                                        left: pt.x - size / 2,
                                        top: pt.y - size / 2,
                                        width: size,
                                        height: size,
                                        borderRadius: size / 2,
                                        borderWidth: 1.5,
                                        borderColor: ACCENT,
                                        backgroundColor: `${ACCENT}11`,
                                        pointerEvents: 'none',
                                        zIndex: 25
                                    }}
                                />
                            )
                        })}
                        
                        {/* Healed points - show actual blur effect */}
                        {healedPoints.map((pt: any, idx) => {
                            const size = pt.size || eraserBrushSize
                            return (
                                <View
                                    key={`healed-${idx}`}
                                    style={{
                                        position: 'absolute',
                                        left: pt.x - size / 2,
                                        top: pt.y - size / 2,
                                        width: size,
                                        height: size,
                                        borderRadius: size / 2,
                                        overflow: 'hidden',
                                        pointerEvents: 'none',
                                        zIndex: 24,
                                        backgroundColor: 'rgba(0,0,0,0.3)'
                                    }}
                                >
                                    <Image 
                                        source={{ uri: currentMediaUrl }} 
                                        style={{
                                            position: 'absolute',
                                            left: -pt.x + size / 2,
                                            top: -pt.y + size / 2,
                                            width: SW,
                                            height: VIEWPORT_H,
                                        }}
                                        resizeMode="contain"
                                        blurRadius={20}
                                    />
                                </View>
                            )
                        })}
                    </>
                )}

                {/* 5. Object Eraser Smart Healing Progress Overlay */}
                {activeTab === 'eraser' && isErasingSimulated && (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', zIndex: 30 }]}>
                        <ActivityIndicator size="large" color={ACCENT} />
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 12 }}>AI Smart Healing...</Text>
                        <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '700', marginTop: 4 }}>{healingProgress}%</Text>
                    </View>
                )}

                {/* 7. AI Story Templates Overlay */}
                {activeTab === 'story' && (
                    <View style={[StyleSheet.absoluteFillObject, { zIndex: 20, pointerEvents: 'none' }]}>
                        {/* Magazine Cover template */}
                        {selectedStoryLayout === 'magazine' && (
                            <View style={[StyleSheet.absoluteFillObject, { padding: 24, justifyContent: 'space-between', borderWidth: 12, borderColor: '#fff' }]}>
                                {/* Top magazine title */}
                                <View style={{ alignItems: 'center', marginTop: 8 }}>
                                    <Text style={{ color: '#fff', fontSize: 44, fontWeight: '900', letterSpacing: 4, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 }}>NOVAGLOW</Text>
                                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 3, marginTop: -4, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>CREATIVE STUDIO</Text>
                                </View>
                                {/* Bottom subtitle & barcode */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 4 }}>{storyTitleText || 'NOVAGLOW CREATIVE'}</Text>
                                        <Text style={{ color: '#fff', fontSize: 8, fontWeight: '600', opacity: 0.8, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>EXCLUSIVE CREATION ISSUE · 2026</Text>
                                    </View>
                                    {/* Simulated Barcode */}
                                    <View style={{ backgroundColor: '#fff', padding: 4, borderRadius: 2, flexDirection: 'row', gap: 1.5, height: 28, alignItems: 'center' }}>
                                        {[1.5, 3, 1, 2, 4, 1.5, 2, 3, 1].map((w, i) => (
                                            <View key={i} style={{ width: w, height: 20, backgroundColor: '#000' }} />
                                        ))}
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Retro Filmstrip template */}
                        {selectedStoryLayout === 'retro' && (
                            <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'space-between' }]}>
                                {/* Top Film Bar */}
                                <View style={{ height: 32, backgroundColor: '#0c0c0c', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
                                    <Text style={{ color: '#f59e0b', fontSize: 9, fontWeight: '800' }}>KODAK PORTRA 400</Text>
                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <View key={i} style={{ width: 8, height: 8, borderRadius: 1.5, borderWidth: 1.5, borderColor: '#333', backgroundColor: '#111' }} />
                                        ))}
                                    </View>
                                </View>
                                {/* Center warm tone vignette filter */}
                                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(245,158,11,0.06)', pointerEvents: 'none' }]} />
                                {/* Bottom Film Bar */}
                                <View style={{ height: 32, backgroundColor: '#0c0c0c', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
                                    <Text style={{ color: '#f59e0b', fontSize: 9, fontWeight: '800' }}>{storyTitleText || 'RETRO ANALOGUE'}</Text>
                                    <Text style={{ color: '#f59e0b', fontSize: 8, fontWeight: '800' }}>24A · SAFETY FILM</Text>
                                </View>
                            </View>
                        )}

                        {/* Neon Splash template */}
                        {selectedStoryLayout === 'neon' && (
                            <View style={[StyleSheet.absoluteFillObject, { borderWidth: 3, borderColor: ACCENT, padding: 20, justifyContent: 'center', alignItems: 'center' }]}>
                                {/* Outer fuchsia neon border shadow */}
                                <View style={[StyleSheet.absoluteFillObject, { borderWidth: 1.5, borderColor: '#06b6d4', margin: 4 }]} />
                                <Text style={{ color: '#fff', fontSize: storyTextSize, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', textShadowColor: ACCENT, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }}>
                                    {storyTitleText || 'NEON DREAM'}
                                </Text>
                            </View>
                        )}

                        {/* Viral Splash / Influencer template */}
                        {selectedStoryLayout === 'influencer' && (
                            <View style={[StyleSheet.absoluteFillObject, { padding: 20, justifyContent: 'flex-end' }]}>
                                <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT }} />
                                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }}>VIRAL CREATOR</Text>
                                    </View>
                                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{storyTitleText || 'NovaGlow AI Story Headline'}</Text>
                                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 2, opacity: 0.8 }}>
                                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}><Ionicons name="heart" size={10} color={ACCENT} /> 1.2M Likes</Text>
                                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}><Ionicons name="chatbubble" size={10} color="#06b6d4" /> 4.2k Shares</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* 8. AI Avatar Stylization Overlay */}
                {activeTab === 'avatar' && !!avatarImageUrl && (
                    <View style={[StyleSheet.absoluteFillObject, { zIndex: 20, pointerEvents: 'none' }]}>
                        {selectedAvatarStyle === 'professional' && (
                            <View style={StyleSheet.absoluteFillObject}>
                                <LinearGradient
                                    colors={['rgba(15,23,42,0.08)', 'rgba(0,0,0,0.42)']}
                                    style={StyleSheet.absoluteFillObject}
                                />
                                <View style={[StyleSheet.absoluteFillObject, { borderWidth: 10, borderColor: '#111827' }]} />
                                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
                                <View style={{ position: 'absolute', bottom: 22, left: 24, right: 24, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.45)' }}>
                                    <Text style={{ color: '#e5e7eb', fontSize: 10, fontWeight: '900', letterSpacing: 2, textAlign: 'center' }}>PROFESSIONAL HEADSHOT</Text>
                                </View>
                            </View>
                        )}

                        {selectedAvatarStyle === 'anime' && (
                            <View style={StyleSheet.absoluteFillObject}>
                                <LinearGradient
                                    colors={['rgba(250,204,21,0.28)', 'rgba(56,189,248,0.20)', 'rgba(244,114,182,0.22)']}
                                    style={StyleSheet.absoluteFillObject}
                                />
                                <View style={[StyleSheet.absoluteFillObject, { borderWidth: 5, borderColor: '#facc15', margin: 8 }]} />
                                <View style={[StyleSheet.absoluteFillObject, { borderWidth: 2, borderColor: '#111827', margin: 14 }]} />
                                <View style={{
                                    position: 'absolute',
                                    top: VIEWPORT_H * 0.53,
                                    left: SW * 0.30,
                                    width: 32,
                                    height: 18,
                                    borderRadius: 999,
                                    backgroundColor: 'rgba(244,63,94,0.35)',
                                    shadowColor: '#f43f5e',
                                    shadowRadius: 10,
                                    shadowOpacity: 0.6
                                }} />
                                <View style={{
                                    position: 'absolute',
                                    top: VIEWPORT_H * 0.53,
                                    left: SW * 0.58,
                                    width: 32,
                                    height: 18,
                                    borderRadius: 999,
                                    backgroundColor: 'rgba(244,63,94,0.35)',
                                    shadowColor: '#f43f5e',
                                    shadowRadius: 10,
                                    shadowOpacity: 0.6
                                }} />
                                <View style={{ position: 'absolute', top: 60, left: 60 }}>
                                    <Ionicons name="sparkles" size={28} color="#fef08a" style={{ opacity: 0.95 }} />
                                </View>
                                <View style={{ position: 'absolute', bottom: 120, right: 60 }}>
                                    <Ionicons name="sparkles" size={22} color="#38bdf8" style={{ opacity: 0.95 }} />
                                </View>
                            </View>
                        )}

                        {selectedAvatarStyle === 'cyberpunk' && (
                            <View style={StyleSheet.absoluteFillObject}>
                                <LinearGradient
                                    colors={['rgba(217,70,239,0.35)', 'rgba(6,182,212,0.30)', 'rgba(0,0,0,0.1)']}
                                    style={StyleSheet.absoluteFillObject}
                                />
                                <View style={[StyleSheet.absoluteFillObject, { borderWidth: 4, borderColor: 'rgba(6,182,212,0.8)', margin: 10 }]} />
                                <View style={[StyleSheet.absoluteFillObject, { borderWidth: 2, borderColor: 'rgba(217,70,239,0.75)', margin: 18 }]} />
                                <View style={{ position: 'absolute', top: 20, right: 20, padding: 7, backgroundColor: 'rgba(0,0,0,0.68)', borderRadius: 6, borderWidth: 1, borderColor: '#06b6d4' }}>
                                    <Text style={{ color: '#67e8f9', fontSize: 8, fontFamily: 'monospace', fontWeight: '900' }}>NEON.SCAN // LIVE</Text>
                                </View>
                            </View>
                        )}

                        {selectedAvatarStyle === 'fashion' && (
                            <View style={StyleSheet.absoluteFillObject}>
                                <LinearGradient
                                    colors={['rgba(214,211,209,0.22)', 'rgba(68,64,60,0.36)']}
                                    style={StyleSheet.absoluteFillObject}
                                />
                                <View style={[StyleSheet.absoluteFillObject, { borderWidth: 16, borderColor: '#fafaf9' }]} />
                                <View style={{ position: 'absolute', top: 24, left: 0, right: 0, alignItems: 'center' }}>
                                    <Text style={{ color: '#fafaf9', fontSize: 34, fontWeight: '900', letterSpacing: 4, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 }}>FASHION</Text>
                                </View>
                            </View>
                        )}

                        {selectedAvatarStyle === 'influencer' && (
                            <View style={StyleSheet.absoluteFillObject}>
                                <LinearGradient
                                    colors={['rgba(251,113,133,0.34)', 'rgba(255,255,255,0.18)', 'rgba(236,72,153,0.18)']}
                                    style={StyleSheet.absoluteFillObject}
                                />
                                <Image
                                    source={{ uri: currentMediaUrl }}
                                    style={[StyleSheet.absoluteFillObject, { opacity: 0.28 }]}
                                    resizeMode="contain"
                                    blurRadius={10}
                                />
                                <View style={[StyleSheet.absoluteFillObject, { borderWidth: 8, borderColor: 'rgba(251,113,133,0.75)', margin: 10 }]} />
                                <View style={{ position: 'absolute', bottom: 24, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
                                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }}>INFLUENCER GLOW</Text>
                                </View>
                            </View>
                        )}
                    </View>
                )}
                
                </View>
                </View>
                
                {/* Aspect Ratio Badge Overlay */}
                <View style={s.aspectBadge}>
                    <Text style={s.aspectBadgeText}>{mediaType === 'image' ? 'PHOTO 9:16' : 'VIDEO 9:16'}</Text>
                </View>

                {/* Floating Compare press-and-hold button */}
                {activeTab !== 'story' && activeTab !== 'eraser' && (
                    <Pressable
                        onPressIn={() => {
                            setShowCompare(true)
                        }}
                        onPressOut={() => {
                            setShowCompare(false)
                        }}
                        style={({ pressed }) => [
                            s.floatingCompareBtn,
                            pressed && { opacity: 0.8 }
                        ]}
                    >
                        <Ionicons name="eye-outline" size={14} color="#fff" />
                        <Text style={s.floatingCompareText}>Compare</Text>
                    </Pressable>
                )}
            </View>

            {/* Quick Filter Info strip */}
            <View style={s.infoBar}>
                <Ionicons name="sparkles" size={12} color={ACCENT} />
                <Text style={s.infoBarText}>
                    {isBgRemoved ? 'AI Background swapper active' : `Skin Smooth: ${smoothing}% · Glow: ${glow}%`}
                </Text>
            </View>

            {/* Main Tools Settings & Parameters Drawer */}
            <View style={s.controlsContainer}>
                {/* 1. Retouch Slider Controls */}
                {activeTab === 'retouch' && (
                    <ScrollView contentContainerStyle={s.scrollControls}>
                        {/* Premium Media Uploader Bar */}
                        <Pressable
                            onPress={changeMediaAction}
                            style={({ pressed }) => [
                                {
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: SURFACE,
                                    borderWidth: 1.5,
                                    borderColor: ACCENT,
                                    borderRadius: 12,
                                    paddingVertical: 12,
                                    gap: 8,
                                    marginBottom: 6,
                                    opacity: pressed ? 0.85 : 1
                                }
                            ]}
                        >
                            <Ionicons name="camera-outline" size={18} color={ACCENT} />
                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Change/Upload Custom Photo</Text>
                        </Pressable>

                        <View style={s.sliderRow}>
                            <View style={s.sliderLabelRow}>
                                <Text style={s.sliderTitle}>Skin Smoothing</Text>
                                <Text style={s.sliderVal}>{smoothing}%</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 36 }}
                                minimumValue={0}
                                maximumValue={100}
                                step={1}
                                value={smoothing}
                                onValueChange={setSmoothing}
                                minimumTrackTintColor={ACCENT}
                                maximumTrackTintColor={BORDER}
                            />
                        </View>

                        <View style={s.sliderRow}>
                            <View style={s.sliderLabelRow}>
                                <Text style={s.sliderTitle}>NovaGlow Glow</Text>
                                <Text style={s.sliderVal}>{glow}%</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 36 }}
                                minimumValue={0}
                                maximumValue={100}
                                step={1}
                                value={glow}
                                onValueChange={setGlow}
                                minimumTrackTintColor={ACCENT}
                                maximumTrackTintColor={BORDER}
                            />
                        </View>

                        <View style={s.sliderRow}>
                            <View style={s.sliderLabelRow}>
                                <Text style={s.sliderTitle}>Brightness</Text>
                                <Text style={s.sliderVal}>{brightness}%</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 36 }}
                                minimumValue={0}
                                maximumValue={100}
                                step={1}
                                value={brightness}
                                onValueChange={setBrightness}
                                minimumTrackTintColor={ACCENT}
                                maximumTrackTintColor={BORDER}
                            />
                        </View>

                        <View style={s.sliderRow}>
                            <View style={s.sliderLabelRow}>
                                <Text style={s.sliderTitle}>Contrast</Text>
                                <Text style={s.sliderVal}>{contrast}%</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 36 }}
                                minimumValue={0}
                                maximumValue={100}
                                step={1}
                                value={contrast}
                                onValueChange={setContrast}
                                minimumTrackTintColor={ACCENT}
                                maximumTrackTintColor={BORDER}
                            />
                        </View>

                        <View style={s.sliderRow}>
                            <View style={s.sliderLabelRow}>
                                <Text style={s.sliderTitle}>Saturation</Text>
                                <Text style={s.sliderVal}>{saturation}%</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 36 }}
                                minimumValue={0}
                                maximumValue={100}
                                step={1}
                                value={saturation}
                                onValueChange={setSaturation}
                                minimumTrackTintColor={ACCENT}
                                maximumTrackTintColor={BORDER}
                            />
                        </View>

                        <View style={s.sliderRow}>
                            <View style={s.sliderLabelRow}>
                                <Text style={s.sliderTitle}>Sharpness</Text>
                                <Text style={s.sliderVal}>{sharpness}%</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 36 }}
                                minimumValue={0}
                                maximumValue={100}
                                step={1}
                                value={sharpness}
                                onValueChange={setSharpness}
                                minimumTrackTintColor={ACCENT}
                                maximumTrackTintColor={BORDER}
                            />
                        </View>

                        <View style={s.sliderRow}>
                            <View style={s.sliderLabelRow}>
                                <Text style={s.sliderTitle}>Warmth</Text>
                                <Text style={s.sliderVal}>{warmth}%</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 36 }}
                                minimumValue={0}
                                maximumValue={100}
                                step={1}
                                value={warmth}
                                onValueChange={setWarmth}
                                minimumTrackTintColor={ACCENT}
                                maximumTrackTintColor={BORDER}
                            />
                        </View>

                        {/* Lips Makeup Tint Colors */}
                        <Text style={s.subSectionTitle}>AI Lipstick Tone</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.colorRow}>
                            {[
                                { name: 'Fuchsia Pink', hex: '#d946ef' },
                                { name: 'Glam Magenta', hex: '#ff007f' },
                                { name: 'Sunset Coral', hex: '#f43f5e' },
                                { name: 'Deep Crimson', hex: '#b91c1c' },
                                { name: 'Nude Peach', hex: '#fdba74' },
                                { name: 'Classic Red', hex: '#dc2626' }
                            ].map((col) => (
                                <Pressable
                                    key={col.hex}
                                    onPress={() => setLipColor(col.hex)}
                                    style={[s.colorCircle, { backgroundColor: col.hex }, lipColor === col.hex && s.colorCircleActive]}
                                />
                            ))}
                        </ScrollView>
                    </ScrollView>
                )}

                {/* 2. Background Swapping Controls */}
                {activeTab === 'background' && (
                    <ScrollView contentContainerStyle={s.scrollControls}>
                        {/* Remove toggle */}
                        <View style={s.toggleRow}>
                            <Text style={s.sliderTitle}>Background Swap MVP</Text>
                            <Pressable
                                onPress={handleToggleBackgroundRemoval}
                                disabled={isRemovingBg}
                                style={[s.toggleSwitch, isBgRemoved && s.toggleSwitchActive, isRemovingBg && { opacity: 0.6 }]}
                            >
                                <View style={[s.toggleHandle, isBgRemoved && s.toggleHandleActive]} />
                            </Pressable>
                        </View>
                        <Pressable
                            onPress={handleRemoveBackground}
                            disabled={isRemovingBg}
                            style={({ pressed }) => [
                                s.aiActionBtn,
                                isRemovingBg && { opacity: 0.7 },
                                pressed && { opacity: 0.85 }
                            ]}
                        >
                            {isRemovingBg ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="cut-outline" size={16} color="#fff" />}
                            <Text style={s.aiActionBtnText}>
                                {bgRemovedImageUrl ? 'Re-run AI Background Removal' : 'Remove Background with AI'}
                            </Text>
                        </Pressable>
                        {isRemovingBg && (
                            <View style={s.progressWrap}>
                                <View style={[s.progressFill, { width: `${bgRemovalProgress}%` }]} />
                            </View>
                        )}
                        {!!bgRemovalError && (
                            <Pressable onPress={handleRemoveBackground} style={s.retryBox}>
                                <Ionicons name="warning-outline" size={14} color="#f87171" />
                                <Text style={s.retryText} numberOfLines={2}>{bgRemovalError}</Text>
                                <Text style={s.retryAction}>Retry</Text>
                            </Pressable>
                        )}

                        <View style={{ gap: 12, marginTop: 4 }}>
                            <Text style={s.subSectionTitle}>Select Replacement Backdrop</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.backdropRow}>
                                <Pressable
                                    onPress={() => handleSelectBackdrop('none')}
                                    style={[s.backdropCard, selectedBackdrop === 'none' && s.backdropCardActive]}
                                >
                                    <View style={[s.backdropThumb, { backgroundColor: SURFACE2, alignItems: 'center', justifyContent: 'center' }]}>
                                        <Ionicons name="ban-outline" size={20} color={TEXT_SECONDARY} />
                                    </View>
                                    <Text style={s.backdropName}>{bgRemovedImageUrl ? 'Transparent PNG' : 'Original'}</Text>
                                </Pressable>
                                {mvpBackdrops.map((bg) => (
                                    <Pressable
                                        key={bg.id}
                                        onPress={() => handleSelectBackdrop(bg.id)}
                                        style={[s.backdropCard, selectedBackdrop === bg.id && s.backdropCardActive]}
                                    >
                                        <Image source={bg.image} style={s.backdropThumb} resizeMode="cover" />
                                        <Text style={s.backdropName} numberOfLines={1}>{bg.name}</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    </ScrollView>
                )}

                {/* 3. Video Trimming Controls */}
                {activeTab === 'video' && (
                    <ScrollView contentContainerStyle={s.scrollControls}>
                        <View style={{
                            backgroundColor: `${ACCENT}22`,
                            borderWidth: 1.5,
                            borderColor: ACCENT,
                            borderRadius: 10,
                            paddingVertical: 12,
                            paddingHorizontal: 14,
                            marginBottom: 12,
                            alignItems: 'center',
                            gap: 4
                        }}>
                            <Ionicons name="information-circle" size={18} color={ACCENT} />
                            <Text style={{color: ACCENT, fontSize: 12, fontWeight: '700', textAlign: 'center'}}>VIDEO EDITING IS COMING SOON</Text>
                            <Text style={{color: TEXT_TERTIARY, fontSize: 11, textAlign: 'center', marginTop: 2}}>Playback, trim, and effects will be available in the next update.</Text>
                        </View>
                        
                        <Text style={s.sliderTitle}>Video Studio Trim (Preview)</Text>
                        {/* Custom Double-Thumb range bar simulation */}
                        <View style={s.trimTimelineWrap}>
                            <View style={s.trimHighlightMap} />
                            {/* Visual frames grid */}
                            <View style={s.timelineFramesRow}>
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <Image key={i} source={{ uri: mediaUrlState }} style={s.miniFrame} resizeMode="cover" />
                                ))}
                            </View>
                            {/* Trim crop frame overlays */}
                            <View style={[s.trimHandle, { left: 0 }]} />
                            <View style={[s.trimHandle, { right: 0 }]} />
                        </View>
                        <Text style={s.timelineInfoText}>MVP trim simulation: 15 second social loop</Text>

                        {/* Video filters & overlays */}
                        <Text style={[s.subSectionTitle, { marginTop: 10 }]}>Visible Video Filters</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fxRow}>
                            {[
                                { key: 'none', label: 'Original', icon: 'videocam-outline' },
                                { key: 'glitch', label: 'VHS Glitch', icon: 'flash' },
                                { key: 'grain', label: 'Retro Noise', icon: 'film' },
                                { key: 'light_leak', label: 'Light Leak', icon: 'sunny' }
                            ].map((fx) => (
                                <Pressable
                                    key={fx.key}
                                    onPress={() => setSelectedFx(fx.key)}
                                    style={[s.fxCard, selectedFx === fx.key && s.fxCardActive]}
                                >
                                    <Ionicons name={fx.icon as any} size={16} color={selectedFx === fx.key ? '#fff' : ACCENT} />
                                    <Text style={[s.fxCardText, selectedFx === fx.key && { color: '#fff' }]}>{fx.label}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                        <Text style={s.subSectionTitle}>Text Overlay</Text>
                        <TextInput
                            style={{
                                backgroundColor: SURFACE,
                                borderWidth: 1,
                                borderColor: BORDER,
                                borderRadius: 10,
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                color: '#fff',
                                fontSize: 13,
                            }}
                            placeholder="Add video title..."
                            placeholderTextColor={TEXT_TERTIARY}
                            value={videoOverlayText}
                            onChangeText={setVideoOverlayText}
                            maxLength={28}
                        />
                    </ScrollView>
                )}

                {/* 4. Filters & Presets Tab */}
                {activeTab === 'filters' && (
                    <ScrollView contentContainerStyle={s.scrollControls}>
                        <Text style={s.sliderTitle}>Preset Filter Collections</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterPresetRow}>
                            {AI_STYLE_FILTERS.map((f) => (
                                <Pressable
                                    key={f.id}
                                    onPress={() => applyFilterPreset(f)}
                                    style={[s.filterPresetCard, activeFilterId === f.id && s.filterPresetCardActive]}
                                >
                                    <Image source={{ uri: f.sampleAfter }} style={s.filterPresetThumb} resizeMode="cover" />
                                    <Text style={s.filterPresetName} numberOfLines={1}>{f.name}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </ScrollView>
                )}

                {/* 5. Audio Music Tracks Overlays */}
                {activeTab === 'audio' && (
                    <ScrollView contentContainerStyle={s.scrollControls}>
                        <View style={s.sliderRow}>
                            <View style={s.sliderLabelRow}>
                                <Text style={s.sliderTitle}>Background Music Volume</Text>
                                <Text style={s.sliderVal}>{audioVolume}%</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 36 }}
                                minimumValue={0}
                                maximumValue={100}
                                step={1}
                                value={audioVolume}
                                onValueChange={setAudioVolume}
                                minimumTrackTintColor={ACCENT}
                                maximumTrackTintColor={BORDER}
                            />
                        </View>

                        <Text style={s.subSectionTitle}>Trending Backing Loops</Text>
                        <View style={s.audioList}>
                            {AUDIO_TRACKS.map((track) => (
                                <Pressable
                                    key={track.id}
                                    onPress={() => toggleAudioTrack(track.id)}
                                    style={[s.audioRow, activeAudioId === track.id && s.audioRowActive]}
                                >
                                    <View style={[s.audioIconBg, activeAudioId === track.id && { backgroundColor: ACCENT }]}>
                                        <Ionicons 
                                            name={activeAudioId === track.id ? 'pause' : 'musical-notes'} 
                                            size={14} 
                                            color="#fff" 
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.audioTitle}>{track.title}</Text>
                                        <Text style={s.audioSub}>{track.artist} · {track.genre}</Text>
                                    </View>
                                    <Text style={s.audioTime}>{track.duration}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </ScrollView>
                )}

                {/* 6. Object Eraser Controls */}
                {activeTab === 'eraser' && (
                    <ScrollView contentContainerStyle={s.scrollControls} showsVerticalScrollIndicator={false}>
                        <View style={s.sliderRow}>
                            <View style={s.sliderLabelRow}>
                                <Text style={s.sliderTitle}>Brush Size</Text>
                                <Text style={s.sliderVal}>{eraserBrushSize}px</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 36 }}
                                minimumValue={10}
                                maximumValue={80}
                                step={2}
                                value={eraserBrushSize}
                                onValueChange={setEraserBrushSize}
                                minimumTrackTintColor={ACCENT}
                                maximumTrackTintColor={BORDER}
                            />
                        </View>

                        <Text style={s.subSectionTitle}>Eraser Actions</Text>
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                            <Pressable
                                onPress={handleSmartErase}
                                disabled={eraserPoints.length === 0 || isErasingSimulated}
                                style={({ pressed }) => [
                                    {
                                        flex: 1.5,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: eraserPoints.length === 0 ? SURFACE2 : ACCENT,
                                        paddingVertical: 12,
                                        borderRadius: 10,
                                        gap: 8,
                                        opacity: (eraserPoints.length === 0 || isErasingSimulated) ? 0.5 : (pressed ? 0.85 : 1)
                                    }
                                ]}
                            >
                                <Ionicons name="sparkles" size={16} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Smart Erase</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    setEraserPoints([])
                                    setIsObjectErased(false)
                                }}
                                style={({ pressed }) => [
                                    {
                                        flex: 1,
                                        backgroundColor: SURFACE,
                                        borderWidth: 1,
                                        borderColor: BORDER,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        paddingVertical: 12,
                                        borderRadius: 10,
                                        opacity: pressed ? 0.85 : 1
                                    }
                                ]}
                            >
                                <Text style={{ color: TEXT_SECONDARY, fontSize: 13, fontWeight: '700' }}>Reset</Text>
                            </Pressable>
                        </View>
                        <Text style={{ fontSize: 10.5, color: TEXT_TERTIARY, textAlign: 'center', marginTop: 4 }}>
                            Drag your finger across the photo to paint the object you want to heal, then tap Smart Erase.
                        </Text>
                    </ScrollView>
                )}

                {/* 7. AI Avatar Controls */}
                {activeTab === 'avatar' && (
                    <ScrollView contentContainerStyle={s.scrollControls} showsVerticalScrollIndicator={false}>
                        <Text style={s.sliderTitle}>Select Avatar Style</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.avatarStyleRow}>
                            {AVATAR_STYLE_OPTIONS.map((style) => (
                                <Pressable
                                    key={style.id}
                                    onPress={() => handleSelectAvatarStyle(style.id)}
                                    disabled={isGeneratingAvatar}
                                    style={[s.avatarStyleCard, selectedAvatarStyle === style.id && s.avatarStyleCardActive]}
                                >
                                    <View style={[s.avatarIconSwatch, { backgroundColor: `${style.tint}22`, borderColor: style.tint }]}>
                                        <Ionicons name={style.icon as any} size={20} color={style.tint} />
                                    </View>
                                    <Text style={[s.backdropName, selectedAvatarStyle === style.id && { color: ACCENT, fontWeight: '800' }]} numberOfLines={1}>{style.name}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                        {isGeneratingAvatar && (
                            <View style={{ gap: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <ActivityIndicator size="small" color={ACCENT} />
                                    <Text style={s.timelineInfoText}>Gemini is generating a new avatar image...</Text>
                                </View>
                                <View style={s.progressWrap}>
                                    <View style={[s.progressFill, { width: `${avatarProgress}%` }]} />
                                </View>
                            </View>
                        )}
                        {!!avatarError && (
                            <Pressable onPress={() => handleSelectAvatarStyle(selectedAvatarStyle)} style={s.retryBox}>
                                <Ionicons name="warning-outline" size={14} color="#f87171" />
                                <Text style={s.retryText} numberOfLines={2}>{avatarError}</Text>
                                <Text style={s.retryAction}>Retry</Text>
                            </Pressable>
                        )}
                    </ScrollView>
                )}

                {/* 8. AI Story Controls */}
                {activeTab === 'story' && (
                    <ScrollView contentContainerStyle={s.scrollControls} showsVerticalScrollIndicator={false}>
                        <Text style={s.sliderTitle}>Select Layout Theme</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fxRow}>
                            {AI_STORY_TEMPLATES.map((tmpl) => (
                                <Pressable
                                    key={tmpl.id}
                                    onPress={() => handleSelectStoryLayout(tmpl.layout)}
                                    style={[s.fxCard, selectedStoryLayout === tmpl.layout && s.fxCardActive]}
                                >
                                    <Ionicons 
                                        name={
                                            tmpl.layout === 'magazine' ? 'book-outline' :
                                            tmpl.layout === 'retro' ? 'film-outline' :
                                            tmpl.layout === 'neon' ? 'flash-outline' : 'images-outline'
                                        } 
                                        size={14} 
                                        color={selectedStoryLayout === tmpl.layout ? '#fff' : ACCENT} 
                                    />
                                    <Text style={[s.fxCardText, selectedStoryLayout === tmpl.layout && { color: '#fff' }]}>
                                        {tmpl.name.split(' ')[1] || tmpl.name}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        <Text style={s.subSectionTitle}>Custom Story Title</Text>
                        <TextInput
                            style={{
                                backgroundColor: SURFACE,
                                borderWidth: 1,
                                borderColor: BORDER,
                                borderRadius: 10,
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                color: '#fff',
                                fontSize: 13,
                                marginTop: 4
                            }}
                            placeholder="Enter story text overlay..."
                            placeholderTextColor={TEXT_TERTIARY}
                            value={storyTitleText}
                            onChangeText={setStoryTitleText}
                            maxLength={36}
                        />

                        {selectedStoryLayout === 'neon' && (
                            <View style={s.sliderRow}>
                                <View style={s.sliderLabelRow}>
                                    <Text style={s.sliderTitle}>Text Font Size</Text>
                                    <Text style={s.sliderVal}>{storyTextSize}px</Text>
                                </View>
                                <Slider
                                    style={{ width: '100%', height: 36 }}
                                    minimumValue={18}
                                    maximumValue={48}
                                    step={1}
                                    value={storyTextSize}
                                    onValueChange={setStoryTextSize}
                                    minimumTrackTintColor={ACCENT}
                                    maximumTrackTintColor={BORDER}
                                />
                            </View>
                        )}
                    </ScrollView>
                )}
            </View>

            {/* Bottom Sub-Navigation bar (Scrollable Horizontal Toolstrip) */}
            <View style={{ borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: SURFACE, paddingVertical: 8, paddingBottom: insets.bottom + 8 }}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 20 }}
                >
                    {bottomNavItems.map((item) => (
                        <Pressable
                            key={item.key}
                            onPress={() => setActiveTab(item.key as ActiveTab)}
                            style={{ alignItems: 'center', gap: 4, minWidth: 56 }}
                        >
                            <Ionicons 
                                name={activeTab === item.key ? (item.icon as any) : (`${item.icon}-outline` as any)} 
                                size={18} 
                                color={activeTab === item.key ? ACCENT : TEXT_SECONDARY} 
                            />
                            <Text style={[s.bottomNavText, activeTab === item.key && { color: ACCENT, fontWeight: '700' }]}>
                                {item.label}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>
        </View>
    )
}

const s = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: BORDER,
    },
    navBtn: { padding: 4 },
    headerTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center' },
    exportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: ACCENT,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    exportBtnText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
    
    // Viewport Container
    viewportContainer: {
        width: SW,
        height: VIEWPORT_H,
        backgroundColor: '#000',
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center'
    },
    viewportMedia: {
        width: SW,
        height: VIEWPORT_H
    },
    lipsOverlay: {
        position: 'absolute',
        top: VIEWPORT_H * 0.54,
        left: SW * 0.44,
        width: 32,
        height: 12,
        borderRadius: 999
    },
    playOverlay: {
        position: 'absolute',
        top: VIEWPORT_H * 0.45,
        alignSelf: 'center',
        width: 48,
        height: 48,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)'
    },
    aspectBadge: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4
    },
    aspectBadgeText: { fontSize: 8.5, color: '#fff', fontWeight: '800' },
    floatingCompareBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.2)',
        zIndex: 28,
    },
    floatingCompareText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },

    // Before/After Splitting slider
    compareSplitLine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 2,
        backgroundColor: ACCENT,
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
        zIndex: 10
    },
    compareSplitHandle: {
        position: 'absolute',
        top: VIEWPORT_H * 0.47,
        left: -17,
        width: 36,
        height: 36,
        borderRadius: 999,
        backgroundColor: ACCENT,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 6
    },
    comparisonSliderWrap: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: 'center',
        zIndex: 12
    },

    infoBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: SURFACE,
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: BORDER
    },
    infoBarText: { fontSize: 10.5, color: TEXT_SECONDARY, fontWeight: '600' },

    // Controls container
    controlsContainer: { flex: 1, backgroundColor: BG, paddingHorizontal: 20, paddingTop: 12 },
    scrollControls: { gap: 14, paddingBottom: 20 },
    subSectionTitle: { fontSize: 11, fontWeight: '800', color: TEXT_TERTIARY, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4 },
    sliderRow: { gap: 2 },
    sliderLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sliderTitle: { fontSize: 13, color: '#fff', fontWeight: '700' },
    sliderVal: { fontSize: 12, color: ACCENT, fontWeight: '700' },
    aiActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: ACCENT,
        borderRadius: 10,
        paddingVertical: 12
    },
    aiActionBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    progressWrap: {
        height: 5,
        borderRadius: 999,
        backgroundColor: SURFACE2,
        overflow: 'hidden'
    },
    progressFill: {
        height: '100%',
        borderRadius: 999,
        backgroundColor: ACCENT
    },
    retryBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(248,113,113,0.35)',
        backgroundColor: 'rgba(248,113,113,0.08)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 9
    },
    retryText: { flex: 1, color: '#fecaca', fontSize: 11, fontWeight: '600' },
    retryAction: { color: '#fff', fontSize: 11, fontWeight: '900' },

    // Colors Row tint selection
    colorRow: { gap: 10, paddingVertical: 4 },
    colorCircle: { width: 28, height: 28, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' },
    colorCircleActive: { borderColor: '#fff', transform: [{ scale: 1.12 }] },

    // Background replacement row
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
    toggleSwitch: { width: 44, height: 24, borderRadius: 999, backgroundColor: SURFACE2, padding: 2 },
    toggleSwitchActive: { backgroundColor: ACCENT },
    toggleHandle: { width: 20, height: 20, borderRadius: 999, backgroundColor: '#fff' },
    toggleHandleActive: { transform: [{ translateX: 20 }] },
    backdropRow: { gap: 10, paddingVertical: 4 },
    backdropCard: { width: 85, alignItems: 'center', gap: 4 },
    backdropThumb: { width: 80, height: 80, borderRadius: 12, borderWidth: 1, borderColor: BORDER },
    backdropCardActive: { opacity: 0.9 },
    backdropName: { fontSize: 10, color: TEXT_SECONDARY, textAlign: 'center' },
    avatarStyleRow: { gap: 10, paddingVertical: 4 },
    avatarStyleCard: { width: 92, alignItems: 'center', gap: 6 },
    avatarStyleCardActive: { opacity: 1, transform: [{ scale: 1.03 }] },
    avatarIconSwatch: { width: 82, height: 58, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

    // Video cropping timeline
    trimTimelineWrap: {
        height: 48,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: BORDER,
        marginVertical: 4
    },
    trimHighlightMap: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: `${ACCENT}12`,
        borderWidth: 1.5,
        borderColor: ACCENT,
        borderRadius: 8
    },
    timelineFramesRow: { flexDirection: 'row', justifyContent: 'space-between', opacity: 0.4 },
    miniFrame: { width: SW / 6, height: 48 },
    trimHandle: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 10,
        backgroundColor: ACCENT,
        borderRadius: 4
    },
    timelineInfoText: { fontSize: 10.5, color: TEXT_TERTIARY, textAlign: 'center' },
    videoTextOverlay: {
        position: 'absolute',
        left: 24,
        right: 24,
        bottom: 34,
        backgroundColor: 'rgba(0,0,0,0.58)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        alignItems: 'center'
    },
    videoTextOverlayText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' },
    fxRow: { gap: 10, paddingVertical: 4 },
    fxCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: BORDER,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10
    },
    fxCardActive: { backgroundColor: ACCENT, borderColor: ACCENT },
    fxCardText: { fontSize: 11, color: TEXT_SECONDARY, fontWeight: '700' },

    // Filters collection list
    filterPresetRow: { gap: 10, paddingVertical: 4 },
    filterPresetCard: { width: 85, alignItems: 'center', gap: 6 },
    filterPresetThumb: { width: 80, height: 80, borderRadius: 12, borderWidth: 1, borderColor: BORDER },
    filterPresetCardActive: { opacity: 0.9 },
    filterPresetName: { fontSize: 10, color: TEXT_SECONDARY, textAlign: 'center' },

    // Audio list items
    audioList: { gap: 8 },
    audioRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 12,
        padding: 10,
        gap: 10
    },
    audioRowActive: { borderColor: ACCENT },
    audioIconBg: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    audioTitle: { fontSize: 13, color: '#fff', fontWeight: '700' },
    audioSub: { fontSize: 10.5, color: TEXT_SECONDARY, marginTop: 1 },
    audioTime: { fontSize: 11, color: TEXT_TERTIARY },

    // Bottom Navigation Bar
    bottomNav: {
        flexDirection: 'row',
        backgroundColor: SURFACE,
        borderTopWidth: 1,
        borderTopColor: BORDER,
        paddingTop: 10,
    },
        bottomNavItem: { flex: 1, alignItems: 'center', gap: 4 },
    bottomNavText: { fontSize: 10, color: TEXT_SECONDARY, fontWeight: '600' }
})

// Custom reactive 60fps Slider to work cleanly on web & mobile without extra native binary linking dependencies
function Slider({ minimumValue = 0, maximumValue = 100, step = 1, value = 0, onValueChange, minimumTrackTintColor = ACCENT, maximumTrackTintColor = BORDER }: any) {
    const [sliderWidth, setSliderWidth] = useState(SW - 40)

    const handleTouch = (event: any) => {
        const { locationX } = event.nativeEvent
        const percentage = Math.max(0, Math.min(1, locationX / sliderWidth))
        const rawValue = minimumValue + percentage * (maximumValue - minimumValue)
        const steppedValue = Math.round(rawValue / step) * step
        onValueChange?.(steppedValue)
    }

    const percentage = ((value - minimumValue) / (maximumValue - minimumValue)) * 100

    return (
        <View
            onLayout={(e) => {
                const w = e.nativeEvent.layout.width
                if (w > 0) {
                    setSliderWidth(w)
                }
            }}
            onTouchStart={handleTouch}
            onTouchMove={handleTouch}
            style={{ height: 36, justifyContent: 'center', width: '100%', pointerEvents: 'auto' }}
        >
            <View style={{ height: 4, width: '100%', backgroundColor: maximumTrackTintColor, borderRadius: 2, position: 'relative', pointerEvents: 'none' }}>
                <View style={{ height: '100%', width: `${percentage}%`, backgroundColor: minimumTrackTintColor, borderRadius: 2, pointerEvents: 'none' }} />
                <View style={{ position: 'absolute', top: -6, left: `${percentage}%`, marginLeft: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', borderWidth: 2, borderColor: minimumTrackTintColor, pointerEvents: 'none' }} />
            </View>
        </View>
    )
}
