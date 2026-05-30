import { useState, useRef, useEffect, useMemo } from 'react'
import {
    View,
    StyleSheet,
    Pressable,
    Image,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    TextInput
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
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
    PRESET_BACKDROPS,
    AUDIO_TRACKS,
    STOCK_PORTRAITS,
    STOCK_VIDEOS,
    AI_AVATAR_STYLES,
    AI_STORY_TEMPLATES,
    type AIStyleFilter
} from '@/lib/mockData'
import { removeBackgroundAPI, smartHealingAPI, aiGenerateBackdropAPI } from '@/lib/api'

const { width: SW, height: SH } = Dimensions.get('window')
const VIEWPORT_H = SH * 0.46

type ActiveTab = 'retouch' | 'background' | 'video' | 'filters' | 'audio' | 'eraser' | 'avatar' | 'story'

export default function EditorScreen() {
    const insets = useSafeAreaInsets()
    
    // Router params
    const params = useLocalSearchParams<{
        mediaType: 'image' | 'video'
        mediaUrl: string
        filterId?: string
        projectId?: string
        initialTool?: string
    }>()

    const mediaType = params.mediaType || 'image'
    const mediaUrl = params.mediaUrl || STOCK_PORTRAITS[0].url
    const initialFilterId = params.filterId || ''
    
    // Map entry point parameters safely to ActiveTab keys
    const initialTool = useMemo<ActiveTab>(() => {
        const raw = params.initialTool || 'retouch'
        if (raw === 'beauty') return 'retouch'
        if (raw === 'bg_swap') return 'background'
        if (raw === 'trimmer') return 'video'
        return (raw as ActiveTab)
    }, [params.initialTool])

    // Editor State
    const [activeTab, setActiveTab] = useState<ActiveTab>(initialTool)
    const [isSaving, setIsSaving] = useState(false)
    
    // Before/After comparison slider (0 to 1)
    const [compareSplit, setCompareSplit] = useState(0.5)
    const [showCompare, setShowCompare] = useState(true)

    // A. Object Eraser Parameters
    const [eraserBrushSize, setEraserBrushSize] = useState(30)
    const [eraserPoints, setEraserPoints] = useState<{ x: number; y: number }[]>([])
    const [isErasingSimulated, setIsErasingSimulated] = useState(false)
    const [healingProgress, setHealingProgress] = useState(0)
    const [isObjectErased, setIsObjectErased] = useState(false)

    // B. AI Avatar Parameters
    const [selectedAvatarStyle, setSelectedAvatarStyle] = useState('avatar-cyber')
    const [selectedHairstyle, setSelectedHairstyle] = useState('Slicked Back')
    const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false)
    const [avatarProgress, setAvatarProgress] = useState(0)
    const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null)

    // C. AI Story Parameters
    const [selectedStoryLayout, setSelectedStoryLayout] = useState<'magazine' | 'retro' | 'neon' | 'influencer'>('magazine')
    const [storyTitleText, setStoryTitleText] = useState('LUMI CREATIVE')
    const [storyTextSize, setStoryTextSize] = useState(32)
    const [storyTextColor, setStoryTextColor] = useState('#ffffff')

    const currentMediaUrl = useMemo(() => {
        if (activeTab === 'avatar' && avatarImageUrl) return avatarImageUrl
        return mediaUrl
    }, [activeTab, avatarImageUrl, mediaUrl])

    // 1. AI Beauty Parameters
    const [smoothing, setSmoothing] = useState(60)
    const [glow, setGlow] = useState(40)
    const [lipColor, setLipColor] = useState('#ff007f') // Default magenta pink
    const [eyeSize, setEyeSize] = useState(1.05) // Widen scale factor (1.0 to 1.20)
    const [faceSlim, setFaceSlim] = useState(0) // face slimming intensity (0 to 100)

    // 2. Background Removal & Replacement
    const [isBgRemoved, setIsBgRemoved] = useState(false)
    const [isRemovingBg, setIsRemovingBg] = useState(false)
    const [selectedBackdrop, setSelectedBackdrop] = useState<string>('none')
    const [bgBlur, setBgBlur] = useState(0) // background blur intensity (0 to 100)

    // AI Backdrop Generator State
    const [aiBackdropPrompt, setAiBackdropPrompt] = useState('')
    const [isGeneratingBackdrop, setIsGeneratingBackdrop] = useState(false)
    const [aiBackdropProgress, setAiBackdropProgress] = useState(0)
    const [backdropStageIndex, setBackdropStageIndex] = useState(0)

    // 3. Video Trimming & FX
    const [trimStart, setTrimStart] = useState(0) // percentage
    const [trimEnd, setTrimEnd] = useState(100) // percentage
    const [selectedFx, setSelectedFx] = useState<string>('none') // none, glitch, grain, light_leak
    const [isVideoPlaying, setIsVideoPlaying] = useState(true)

    // 4. Filters & Presets
    const [activeFilterId, setActiveFilterId] = useState<string>(initialFilterId)

    // 5. Soundtrack Overlay
    const [activeAudioId, setActiveAudioId] = useState<string>('none')
    const [audioVolume, setAudioVolume] = useState(80)
    const [soundObject, setSoundObject] = useState<any | null>(null)

    // Detect if model is standard stock to render high-fidelity mask cutout
    const stockModel = useMemo(() => {
        const matchingPortrait = STOCK_PORTRAITS.find(p => p.url === mediaUrl)
        if (matchingPortrait) return matchingPortrait.id
        
        // Check if mediaUrl matches a stock video
        const matchingVideo = STOCK_VIDEOS.find(v => v.url === mediaUrl)
        if (matchingVideo) return matchingVideo.id
        
        return null
    }, [mediaUrl])

    // Load filter preset details when filter is clicked
    const applyFilterPreset = (filter: AIStyleFilter) => {
        setActiveFilterId(filter.id)
        setSmoothing(filter.intensity)
        setGlow(filter.glowIntensity)
        setLipColor(filter.lipColor)
        setEyeSize(filter.eyeSize)
        setSelectedFx(filter.overlayStyle)
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

    // Smart Healing Object Eraser Simulation
    // Smart Healing Object Eraser Simulation
    const handleSmartErase = async () => {
        if (eraserPoints.length === 0) return
        setIsErasingSimulated(true)
        setHealingProgress(0)
        
        let progress = 0
        const interval = setInterval(() => {
            progress += 10
            setHealingProgress(progress)
            if (progress >= 100) {
                clearInterval(interval)
            }
        }, 150)

        try {
            await smartHealingAPI(mediaUrl, eraserPoints)
            setIsObjectErased(true)
        } catch (err) {
            console.error('[API] smartHealingAPI error:', err)
        } finally {
            setIsErasingSimulated(false)
            setEraserPoints([])
        }
    }

    // Background Removal API Trigger
    const handleToggleBackgroundRemoval = async () => {
        if (!isBgRemoved) {
            setIsRemovingBg(true)
            try {
                await removeBackgroundAPI(mediaUrl)
                setIsBgRemoved(true)
            } catch (err) {
                console.error('[API] removeBackgroundAPI error:', err)
            } finally {
                setIsRemovingBg(false)
            }
        } else {
            setIsBgRemoved(false)
        }
    }

    const BACKDROP_STEPS = [
        'Analyzing prompt context...',
        'Dreaming scenery landscapes...',
        'Synthesizing high-res pixels...',
        'Blending light & shadows...'
    ]

    const handleGenerateBackdrop = async () => {
        if (!aiBackdropPrompt.trim() || isGeneratingBackdrop) return
        setIsGeneratingBackdrop(true)
        setAiBackdropProgress(0)
        setBackdropStageIndex(0)

        let progress = 0
        const interval = setInterval(() => {
            progress += 10
            setAiBackdropProgress(progress)
            
            const step = Math.min(
                Math.floor((progress / 100) * BACKDROP_STEPS.length),
                BACKDROP_STEPS.length - 1
            )
            setBackdropStageIndex(step)

            if (progress >= 100) {
                clearInterval(interval)
            }
        }, 150)

        try {
            const generatedUrl = await aiGenerateBackdropAPI(aiBackdropPrompt)
            setSelectedBackdrop(generatedUrl)
            setIsBgRemoved(true)
        } catch (err) {
            console.error('[API] aiGenerateBackdropAPI error:', err)
        } finally {
            setIsGeneratingBackdrop(false)
            setAiBackdropPrompt('')
        }
    }

    // AI Avatar Stylization Simulation
    const handleGenerateAvatar = () => {
        setIsGeneratingAvatar(true)
        setAvatarProgress(0)
        
        let progress = 0
        const interval = setInterval(() => {
            progress += 5
            setAvatarProgress(progress)
            if (progress >= 100) {
                clearInterval(interval)
                setIsGeneratingAvatar(false)
                
                // Map style selection to mock stylizations
                const styleObj = AI_AVATAR_STYLES.find(s => s.id === selectedAvatarStyle)
                if (styleObj) {
                    setAvatarImageUrl(styleObj.sampleUrl)
                }
            }
        }, 100)
    }

    // Direct routing to export flow
    const navigateToExport = () => {
        // Collect current edits summary
        let editsSummary = `Smooth: ${smoothing}%, Glow: ${glow}%, Tint: ${lipColor}, FX: ${selectedFx}`
        if (isBgRemoved) {
            editsSummary = 'Removed backdrop, swapped background'
        } else if (activeTab === 'eraser' && isObjectErased) {
            editsSummary = 'Erased object from image using AI Smart Healing'
        } else if (activeTab === 'avatar' && avatarImageUrl) {
            editsSummary = `Generated AI Avatar in ${selectedAvatarStyle} style`
        } else if (activeTab === 'story') {
            editsSummary = `Created AI Story with template ${selectedStoryLayout} layout`
        }

        router.push({
            pathname: '/export',
            params: {
                mediaType,
                mediaUrl: (activeTab === 'avatar' && avatarImageUrl) ? avatarImageUrl : mediaUrl,
                editsSummary,
                smoothing,
                glow,
                lipColor,
                eyeSize,
                selectedFx,
                selectedBackdrop,
                isBgRemoved: isBgRemoved.toString()
            }
        })
    }

    const bottomNavItems = useMemo(() => {
        if (mediaType === 'video') {
            return [
                { key: 'video', label: 'Trim & FX', icon: 'videocam' },
                { key: 'audio', label: 'Music', icon: 'musical-notes' },
                { key: 'filters', label: 'AI Presets', icon: 'color-palette' }
            ]
        } else {
            return [
                { key: 'retouch', label: 'Retouch', icon: 'sparkles' },
                { key: 'background', label: 'Backdrop', icon: 'image' },
                { key: 'eraser', label: 'Eraser', icon: 'color-wand' },
                { key: 'avatar', label: 'AI Avatar', icon: 'person-circle' },
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

            {/* Main Creative Viewport */}
            <View 
                style={s.viewportContainer}
                onStartShouldSetResponder={() => activeTab === 'eraser'}
                onResponderGrant={(evt) => {
                    if (activeTab !== 'eraser' || isErasingSimulated) return
                    const { locationX, locationY } = evt.nativeEvent
                    setEraserPoints([{ x: locationX, y: locationY }])
                }}
                onResponderMove={(evt) => {
                    if (activeTab !== 'eraser' || isErasingSimulated) return
                    const { locationX, locationY } = evt.nativeEvent
                    setEraserPoints((prev) => [...prev, { x: locationX, y: locationY }])
                }}
            >
                {/* 1. Base Layer (Original Image / Video representation) */}
                <View style={StyleSheet.absoluteFill}>
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
                        <Image source={{ uri: currentMediaUrl }} style={s.viewportMedia as any} resizeMode="contain" />
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
                    <View style={StyleSheet.absoluteFill}>
                        <Image 
                            source={{ uri: selectedBackdrop.startsWith('http') ? selectedBackdrop : PRESET_BACKDROPS.find(b => b.id === selectedBackdrop)?.image }} 
                            style={s.viewportMedia as any} 
                            resizeMode="contain" 
                        />
                    </View>
                )}

                {/* 3. AI Enhanced / Filtered Layer (Clipped to the slider split value) */}
                <View style={[StyleSheet.absoluteFill, { width: SW * compareSplit, overflow: 'hidden' }]}>
                    {/* Background Swapped Cutout Overlay */}
                    {isBgRemoved ? (
                        <View style={{ width: SW, height: VIEWPORT_H }}>
                            {stockModel ? (
                                // Flawless transparent stock mask overlay
                                mediaType === 'video' && Video ? (
                                    <Video
                                        source={{ uri: currentMediaUrl }}
                                        style={[s.viewportMedia, { tintColor: selectedFx === 'neon' ? ACCENT : undefined } as any]}
                                        resizeMode={ResizeMode.CONTAIN}
                                        shouldPlay={isVideoPlaying}
                                        isLooping
                                        isMuted
                                    />
                                ) : (
                                    <Image 
                                        source={{ uri: currentMediaUrl }} 
                                        style={[s.viewportMedia as any, { tintColor: selectedFx === 'neon' ? ACCENT : undefined }]} 
                                        resizeMode="contain" 
                                    />
                                )
                            ) : (
                                // Smart edge mask fallback
                                mediaType === 'video' && Video ? (
                                    <Video
                                        source={{ uri: currentMediaUrl }}
                                        style={s.viewportMedia}
                                        resizeMode={ResizeMode.CONTAIN}
                                        shouldPlay={isVideoPlaying}
                                        isLooping
                                        isMuted
                                    />
                                ) : (
                                    <Image source={{ uri: currentMediaUrl }} style={s.viewportMedia as any} resizeMode="contain" />
                                )
                            )}
                        </View>
                    ) : (
                        <View style={{ width: SW, height: VIEWPORT_H }}>
                            {/* Standard original image displaying beauty filter tweaks (bilateral blur, lips red glow overlay) */}
                            {mediaType === 'video' && Video ? (
                                <Video
                                    source={{ uri: mediaUrl }}
                                    style={s.viewportMedia}
                                    resizeMode={ResizeMode.CONTAIN}
                                    shouldPlay={isVideoPlaying}
                                    isLooping
                                    isMuted
                                />
                            ) : (
                                <Image source={{ uri: mediaUrl }} style={s.viewportMedia as any} resizeMode="contain" />
                            )}
                            
                            {/* Lip Tint Overlay (Dynamic SVG-like absolute layer) */}
                            {lipColor && (
                                <View style={[s.lipsOverlay, { backgroundColor: lipColor, opacity: 0.15 }]} />
                            )}

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
                        </View>
                    )}
                </View>

                {/* 4. Interactive Object Eraser Mask Overlay */}
                {activeTab === 'eraser' && eraserPoints.map((pt, idx) => (
                    <View
                        key={idx}
                        style={{
                            position: 'absolute',
                            left: pt.x - eraserBrushSize / 2,
                            top: pt.y - eraserBrushSize / 2,
                            width: eraserBrushSize,
                            height: eraserBrushSize,
                            borderRadius: eraserBrushSize / 2,
                            backgroundColor: 'rgba(239, 68, 68, 0.45)', // Red brush trail
                            pointerEvents: 'none',
                            zIndex: 25
                        }}
                    />
                ))}

                {/* 5. Object Eraser Smart Healing Progress Overlay */}
                {activeTab === 'eraser' && isErasingSimulated && (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', zIndex: 30 }]}>
                        <ActivityIndicator size="large" color={ACCENT} />
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 12 }}>AI Smart Healing...</Text>
                        <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '700', marginTop: 4 }}>{healingProgress}%</Text>
                    </View>
                )}

                {/* 6. AI Avatar Face Scanner Mesh Overlay */}
                {activeTab === 'avatar' && isGeneratingAvatar && (
                    <View style={[StyleSheet.absoluteFillObject, { zIndex: 30, overflow: 'hidden' }]}>
                        <LinearGradient
                            colors={['rgba(217,70,239,0.3)', 'transparent']}
                            style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: `${avatarProgress}%`,
                                height: 80,
                                borderBottomWidth: 2,
                                borderBottomColor: ACCENT,
                            }}
                        />
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }]}>
                            <ActivityIndicator size="large" color={ACCENT} />
                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', marginTop: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                {avatarProgress < 30 ? 'Scanning Facial Mesh...' : avatarProgress < 65 ? 'Stylizing Textures...' : 'Rendering 3D Portrait...'}
                            </Text>
                            <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '800', marginTop: 4 }}>{avatarProgress}%</Text>
                        </View>
                    </View>
                )}

                {/* AI Backdrop Generator Progress Overlay */}
                {activeTab === 'background' && isGeneratingBackdrop && (
                    <View style={[StyleSheet.absoluteFillObject, { zIndex: 30, overflow: 'hidden' }]}>
                        <LinearGradient
                            colors={['rgba(6,182,212,0.3)', 'transparent']}
                            style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: `${aiBackdropProgress}%`,
                                height: 80,
                                borderBottomWidth: 2,
                                borderBottomColor: '#06b6d4',
                            }}
                        />
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }]}>
                            <ActivityIndicator size="large" color="#06b6d4" />
                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', marginTop: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                {BACKDROP_STEPS[backdropStageIndex]}
                            </Text>
                            <Text style={{ color: '#06b6d4', fontSize: 14, fontWeight: '800', marginTop: 4 }}>{aiBackdropProgress}%</Text>
                        </View>
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
                                    <Text style={{ color: '#fff', fontSize: 44, fontWeight: '900', letterSpacing: 4 }}>LUMI</Text>
                                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 3, marginTop: -4 }}>CREATIVE STUDIO</Text>
                                </View>
                                {/* Bottom subtitle & barcode */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' }}>{storyTitleText || 'LUMI CREATIVE'}</Text>
                                        <Text style={{ color: '#fff', fontSize: 8, fontWeight: '600', opacity: 0.8 }}>EXCLUSIVE CREATION ISSUE · 2026</Text>
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
                                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{storyTitleText || 'Lumi AI Story Headline'}</Text>
                                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 2, opacity: 0.8 }}>
                                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}><Ionicons name="heart" size={10} color={ACCENT} /> 1.2M Likes</Text>
                                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}><Ionicons name="chatbubble" size={10} color="#06b6d4" /> 4.2k Shares</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* 8. Glowing Before/After Split Line Controller */}
                {showCompare && activeTab !== 'story' && (
                    <View style={[s.compareSplitLine, { left: SW * compareSplit }]}>
                        <View style={s.compareSplitHandle}>
                            <Ionicons name="swap-horizontal" size={16} color="#fff" />
                        </View>
                    </View>
                )}

                {/* Simulated interactive drag region for Before/After */}
                {activeTab !== 'story' && activeTab !== 'eraser' && (
                    <Pressable
                        onStartShouldSetResponder={() => true}
                        onMoveShouldSetResponder={() => true}
                        onResponderGrant={(evt) => {
                            const { locationX } = evt.nativeEvent
                            const percentage = Math.max(0, Math.min(1, locationX / SW))
                            setCompareSplit(percentage)
                        }}
                        onResponderMove={(evt) => {
                            const { locationX } = evt.nativeEvent
                            const percentage = Math.max(0, Math.min(1, locationX / SW))
                            setCompareSplit(percentage)
                        }}
                        style={[StyleSheet.absoluteFillObject, { zIndex: 12 }]}
                    />
                )}
                
                {/* Aspect Ratio Badge Overlay */}
                <View style={s.aspectBadge}>
                    <Text style={s.aspectBadgeText}>{mediaType === 'image' ? 'PHOTO 9:16' : 'VIDEO 9:16'}</Text>
                </View>
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
                                <Text style={s.sliderTitle}>Lumi Glow</Text>
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
                            <Text style={s.sliderTitle}>One-Tap Remove Background</Text>
                            <Pressable
                                onPress={handleToggleBackgroundRemoval}
                                disabled={isRemovingBg}
                                style={[s.toggleSwitch, isBgRemoved && s.toggleSwitchActive, isRemovingBg && { opacity: 0.7 }]}
                            >
                                {isRemovingBg ? (
                                    <ActivityIndicator size="small" color="#fff" style={{ alignSelf: 'center' }} />
                                ) : (
                                    <View style={[s.toggleHandle, isBgRemoved && s.toggleHandleActive]} />
                                )}
                            </Pressable>
                        </View>

                        {isBgRemoved && (
                            <View style={{ gap: 12, marginTop: 4 }}>
                                <Text style={s.subSectionTitle}>Select Replacement Backdrop</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.backdropRow}>
                                    <Pressable
                                        onPress={() => setSelectedBackdrop('none')}
                                        style={[s.backdropCard, selectedBackdrop === 'none' && s.backdropCardActive]}
                                    >
                                        <View style={[s.backdropThumb, { backgroundColor: SURFACE2, alignItems: 'center', justifyContent: 'center' }]}>
                                            <Ionicons name="ban-outline" size={20} color={TEXT_SECONDARY} />
                                        </View>
                                        <Text style={s.backdropName}>Transparent</Text>
                                    </Pressable>
                                    {PRESET_BACKDROPS.map((bg) => (
                                        <Pressable
                                            key={bg.id}
                                            onPress={() => setSelectedBackdrop(bg.id)}
                                            style={[s.backdropCard, selectedBackdrop === bg.id && s.backdropCardActive]}
                                        >
                                            <Image source={{ uri: bg.thumbnail }} style={s.backdropThumb} />
                                            <Text style={s.backdropName} numberOfLines={1}>{bg.name.split(' ')[0]}</Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Prompt-to-Backdrop scene generator */}
                        <View style={{ gap: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 14 }}>
                            <Text style={s.subSectionTitle}>AI Backdrop Scene Generator</Text>
                            <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>
                                Describe the backdrop you want to create and Lumi AI will generate it:
                            </Text>
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
                                    marginTop: 2
                                }}
                                placeholder="e.g., retro futuristic vaporwave neon beach at sunset..."
                                placeholderTextColor={TEXT_TERTIARY}
                                value={aiBackdropPrompt}
                                onChangeText={setAiBackdropPrompt}
                                maxLength={80}
                                editable={!isGeneratingBackdrop}
                            />
                            <Pressable
                                onPress={handleGenerateBackdrop}
                                disabled={!aiBackdropPrompt.trim() || isGeneratingBackdrop}
                                style={({ pressed }) => [
                                    {
                                        backgroundColor: aiBackdropPrompt.trim() ? ACCENT : SURFACE2,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        paddingVertical: 12,
                                        borderRadius: 10,
                                        gap: 8,
                                        opacity: (!aiBackdropPrompt.trim() || isGeneratingBackdrop) ? 0.5 : (pressed ? 0.85 : 1)
                                    }
                                ]}
                            >
                                <Ionicons name="color-wand" size={16} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
                                    {isGeneratingBackdrop ? 'Generating Backdrop...' : 'Generate Backdrop'}
                                </Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                )}

                {/* 3. Video Trimming Controls */}
                {activeTab === 'video' && (
                    <ScrollView contentContainerStyle={s.scrollControls}>
                        <Text style={s.sliderTitle}>Video Trim Duration</Text>
                        {/* Custom Double-Thumb range bar simulation */}
                        <View style={s.trimTimelineWrap}>
                            <View style={s.trimHighlightMap} />
                            {/* Visual frames grid */}
                            <View style={s.timelineFramesRow}>
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <Image key={i} source={{ uri: mediaUrl }} style={s.miniFrame} />
                                ))}
                            </View>
                            {/* Trim crop frame overlays */}
                            <View style={[s.trimHandle, { left: 0 }]} />
                            <View style={[s.trimHandle, { right: 0 }]} />
                        </View>
                        <Text style={s.timelineInfoText}>Selected: 15 seconds loop (TikTok Optimized)</Text>

                        {/* Video filters & overlays */}
                        <Text style={[s.subSectionTitle, { marginTop: 10 }]}>Glitch Overlay Layers</Text>
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
                                    <Image source={{ uri: f.sampleAfter }} style={s.filterPresetThumb} />
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
                        <Text style={s.sliderTitle}>Select Style Archetype</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.backdropRow}>
                            {AI_AVATAR_STYLES.map((style) => (
                                <Pressable
                                    key={style.id}
                                    onPress={() => setSelectedAvatarStyle(style.id)}
                                    style={[s.backdropCard, selectedAvatarStyle === style.id && s.backdropCardActive]}
                                >
                                    <Image source={{ uri: style.thumbnail }} style={[s.backdropThumb, selectedAvatarStyle === style.id && { borderColor: ACCENT, borderWidth: 2 }]} />
                                    <Text style={[s.backdropName, selectedAvatarStyle === style.id && { color: ACCENT, fontWeight: '700' }]} numberOfLines={1}>
                                        {style.name.split(' ')[0]}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        <Text style={s.subSectionTitle}>Select Hairstyle</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fxRow}>
                            {['Slicked Back', 'Neon Waves', 'Retro Curls', 'Cyber Fade'].map((hair) => (
                                <Pressable
                                    key={hair}
                                    onPress={() => setSelectedHairstyle(hair)}
                                    style={[s.fxCard, selectedHairstyle === hair && s.fxCardActive]}
                                >
                                    <Text style={[s.fxCardText, selectedHairstyle === hair && { color: '#fff' }]}>{hair}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        <Pressable
                            onPress={handleGenerateAvatar}
                            disabled={isGeneratingAvatar}
                            style={({ pressed }) => [
                                {
                                    backgroundColor: ACCENT,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: 14,
                                    borderRadius: 12,
                                    gap: 8,
                                    marginTop: 10,
                                    opacity: isGeneratingAvatar ? 0.6 : (pressed ? 0.85 : 1),
                                    shadowColor: ACCENT,
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 8,
                                    elevation: 6
                                }
                            ]}
                        >
                            <Ionicons name="flash" size={16} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                                {isGeneratingAvatar ? 'Stylizing Portrait...' : 'Generate AI Avatar'}
                            </Text>
                        </Pressable>
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
                                    onPress={() => setSelectedStoryLayout(tmpl.layout)}
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
    const [sliderLeft, setSliderLeft] = useState(20)
    const viewRef = useRef<View>(null)

    const updateValue = (pageX: number) => {
        const relativeX = pageX - sliderLeft
        const percentage = Math.max(0, Math.min(1, relativeX / sliderWidth))
        const rawValue = minimumValue + percentage * (maximumValue - minimumValue)
        const steppedValue = Math.round(rawValue / step) * step
        onValueChange?.(steppedValue)
    }

    const handleTouch = (event: any) => {
        const { pageX } = event.nativeEvent
        updateValue(pageX)
    }

    const percentage = ((value - minimumValue) / (maximumValue - minimumValue)) * 100

    return (
        <View
            ref={viewRef}
            onLayout={() => {
                viewRef.current?.measure((x, y, width, height, pageX, pageY) => {
                    if (width) setSliderWidth(width)
                    if (pageX) setSliderLeft(pageX)
                })
            }}
            onTouchStart={handleTouch}
            onTouchMove={handleTouch}
            style={{ height: 36, justifyContent: 'center', width: '100%', pointerEvents: 'auto' }}
        >
            <View style={{ height: 4, width: '100%', backgroundColor: maximumTrackTintColor, borderRadius: 2, position: 'relative' }}>
                <View style={{ height: '100%', width: `${percentage}%`, backgroundColor: minimumTrackTintColor, borderRadius: 2 }} />
                <View style={{ position: 'absolute', top: -6, left: `${percentage}%`, marginLeft: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', borderWidth: 2, borderColor: minimumTrackTintColor }} />
            </View>
        </View>
    )
}
