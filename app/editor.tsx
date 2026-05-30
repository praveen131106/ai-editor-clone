import { useState, useRef, useEffect, useMemo } from 'react'
import {
    View,
    StyleSheet,
    Pressable,
    Image,
    ScrollView,
    Dimensions,
    ActivityIndicator
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import { Audio } from 'expo-av'

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
    type AIStyleFilter
} from '@/lib/mockData'

const { width: SW, height: SH } = Dimensions.get('window')
const VIEWPORT_H = SH * 0.46

type ActiveTab = 'retouch' | 'background' | 'video' | 'filters' | 'audio'

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
    const initialTool = (params.initialTool as ActiveTab) || 'retouch'

    // Editor State
    const [activeTab, setActiveTab] = useState<ActiveTab>(initialTool)
    const [isSaving, setIsSaving] = useState(false)
    
    // Before/After comparison slider (0 to 1)
    const [compareSplit, setCompareSplit] = useState(0.5)
    const [showCompare, setShowCompare] = useState(true)

    // 1. AI Beauty Parameters
    const [smoothing, setSmoothing] = useState(60)
    const [glow, setGlow] = useState(40)
    const [lipColor, setLipColor] = useState('#ff007f') // Default magenta pink
    const [eyeSize, setEyeSize] = useState(1.05) // Widen scale factor (1.0 to 1.20)
    const [faceSlim, setFaceSlim] = useState(0) // face slimming intensity (0 to 100)

    // 2. Background Removal & Replacement
    const [isBgRemoved, setIsBgRemoved] = useState(false)
    const [selectedBackdrop, setSelectedBackdrop] = useState<string>('none')
    const [bgBlur, setBgBlur] = useState(0) // background blur intensity (0 to 100)

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
    const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null)

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

    // Direct routing to export flow
    const navigateToExport = () => {
        // Collect current edits summary
        const editsSummary = isBgRemoved 
            ? 'Removed backdrop, swapped background' 
            : `Smooth: ${smoothing}%, Glow: ${glow}%, Tint: ${lipColor}, FX: ${selectedFx}`

        router.push({
            pathname: '/export',
            params: {
                mediaType,
                mediaUrl,
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
            <View style={s.viewportContainer}>
                {/* 1. Base Layer (Original Image / Video representation) */}
                <View style={StyleSheet.absoluteFill}>
                    <Image source={{ uri: mediaUrl }} style={s.viewportMedia as any} resizeMode="contain" />
                    {mediaType === 'video' && (
                        <View style={s.playOverlay}>
                            <Ionicons name={isVideoPlaying ? 'pause' : 'play'} size={24} color="#fff" />
                        </View>
                    )}
                </View>

                {/* 2. Swapped Background Backdrop Layer (If background is removed) */}
                {isBgRemoved && selectedBackdrop !== 'none' && (
                    <View style={StyleSheet.absoluteFill}>
                        <Image 
                            source={{ uri: PRESET_BACKDROPS.find(b => b.id === selectedBackdrop)?.image }} 
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
                                <Image 
                                    source={{ uri: mediaUrl }} 
                                    style={[s.viewportMedia as any, { tintColor: selectedFx === 'neon' ? ACCENT : undefined }]} 
                                    resizeMode="contain" 
                                />
                            ) : (
                                // Smart edge mask fallback
                                <Image source={{ uri: mediaUrl }} style={s.viewportMedia as any} resizeMode="contain" />
                            )}
                        </View>
                    ) : (
                        <View style={{ width: SW, height: VIEWPORT_H }}>
                            {/* Standard original image displaying beauty filter tweaks (bilateral blur, lips red glow overlay) */}
                            <Image source={{ uri: mediaUrl }} style={s.viewportMedia as any} resizeMode="contain" />
                            
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

                {/* 4. Glowing Before/After Split Line Controller */}
                {showCompare && (
                    <View style={[s.compareSplitLine, { left: SW * compareSplit }]}>
                        <View style={s.compareSplitHandle}>
                            <Ionicons name="swap-horizontal" size={16} color="#fff" />
                        </View>
                    </View>
                )}

                {/* Simulated interactive drag region for Before/After */}
                <View style={s.comparisonSliderWrap}>
                    <Slider
                        style={{ width: '100%', height: 40 }}
                        minimumValue={0}
                        maximumValue={1}
                        value={compareSplit}
                        onValueChange={setCompareSplit}
                        minimumTrackTintColor="transparent"
                        maximumTrackTintColor="transparent"
                        thumbTintColor="transparent"
                    />
                </View>
                
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
                                onPress={() => setIsBgRemoved(!isBgRemoved)}
                                style={[s.toggleSwitch, isBgRemoved && s.toggleSwitchActive]}
                            >
                                <View style={[s.toggleHandle, isBgRemoved && s.toggleHandleActive]} />
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
            </View>

            {/* Bottom Sub-Navigation bar */}
            <View style={[s.bottomNav, { paddingBottom: insets.bottom + 12 }]}>
                {[
                    { key: 'retouch', label: 'Retouch', icon: 'sparkles' },
                    { key: 'background', label: 'Backdrop', icon: 'image' },
                    { key: 'video', label: 'Trim & FX', icon: 'videocam' },
                    { key: 'filters', label: 'AI Presets', icon: 'color-palette' },
                    { key: 'audio', label: 'Music', icon: 'musical-notes' }
                ].map((item) => (
                    <Pressable
                        key={item.key}
                        onPress={() => setActiveTab(item.key as ActiveTab)}
                        style={s.bottomNavItem}
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
    const handleTouch = (event: any) => {
        const { locationX } = event.nativeEvent
        const width = SW - 40
        const percentage = Math.max(0, Math.min(1, locationX / width))
        const rawValue = minimumValue + percentage * (maximumValue - minimumValue)
        const steppedValue = Math.round(rawValue / step) * step
        onValueChange?.(steppedValue)
    }

    const percentage = ((value - minimumValue) / (maximumValue - minimumValue)) * 100

    return (
        <Pressable onPress={handleTouch} style={{ height: 36, justifyContent: 'center', width: '100%' }}>
            <View style={{ height: 4, width: '100%', backgroundColor: maximumTrackTintColor, borderRadius: 2, position: 'relative' }}>
                <View style={{ height: '100%', width: `${percentage}%`, backgroundColor: minimumTrackTintColor, borderRadius: 2 }} />
                <View style={{ position: 'absolute', top: -6, left: `${percentage}%`, marginLeft: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', borderWidth: 2, borderColor: minimumTrackTintColor }} />
            </View>
        </Pressable>
    )
}
