import { useState, useEffect } from 'react'
import {
    View,
    StyleSheet,
    Pressable,
    Image,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    Alert
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'

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
import { itemSummaries as defaultProjects, type ItemSummary } from '@/lib/mockData'

const { width: SW } = Dimensions.get('window')

type AspectRatio = '9:16' | '1:1' | '4:5' | '16:9'

const RENDERING_STEPS = [
    'Mapping facial landmarks...',
    'Applying neural skin retouching...',
    'Synthesizing isolated backdrop layers...',
    'Blending filters and particles overlays...',
    'Encoding H.264 video loops at 60 FPS...',
    'Saving creative assets to local cache...'
]

export default function ExportScreen() {
    const insets = useSafeAreaInsets()
    
    // params from editor
    const params = useLocalSearchParams<{
        mediaType: 'image' | 'video'
        mediaUrl: string
        editsSummary: string
        selectedBackdrop?: string
        isBgRemoved?: string
    }>()

    const mediaType = params.mediaType || 'image'
    const mediaUrl = params.mediaUrl || ''
    const editsSummary = params.editsSummary || 'Custom AI enhancements applied'
    const isBgRemoved = params.isBgRemoved === 'true'

    const [selectedAspect, setSelectedAspect] = useState<AspectRatio>('9:16')
    const [exportQuality, setExportQuality] = useState<'HD' | '4K PRO'>('4K PRO')

    // Render engine states
    const [renderProgress, setRenderProgress] = useState(0) // 0 to 100
    const [renderStepIndex, setRenderStepIndex] = useState(0)
    const [isRendering, setIsRendering] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    // Run simulated neural render compiler
    const startRenderingAndSave = () => {
        setIsRendering(true)
        setIsSuccess(false)
        setRenderProgress(0)
        setRenderStepIndex(0)
    }

    useEffect(() => {
        if (!isRendering) return

        const stepDuration = 700 // ms per render stage step
        const timer = setInterval(() => {
            setRenderProgress((prev) => {
                const next = prev + 17
                if (next >= 100) {
                    clearInterval(timer)
                    saveProjectToHistory()
                    return 100
                }
                
                // Update text step based on progress
                const step = Math.min(
                    Math.floor((next / 100) * RENDERING_STEPS.length),
                    RENDERING_STEPS.length - 1
                )
                setRenderStepIndex(step)
                return next
            })
        }, stepDuration)

        return () => clearInterval(timer)
    }, [isRendering])

    // Save project metadata to AsyncStorage history
    const saveProjectToHistory = async () => {
        try {
            const stored = await AsyncStorage.getItem('lumi_projects')
            let projects: ItemSummary[] = stored ? JSON.parse(stored) : [...defaultProjects]
            
            // Construct a new completed item
            const newItem: ItemSummary = {
                id: `proj-${Date.now()}`,
                name: `Lumi ${mediaType === 'image' ? 'Photo' : 'Video'} #${projects.length + 1}`,
                owner: 'Praveen Nayak',
                status: 'active',
                completion: 100,
                health: Math.floor(Math.random() * 12) + 88, // 88 to 99 viral rating
                activeUsers: mediaType === 'video' ? 60 : 60,
                updatedAt: 'Just now',
                summary: editsSummary,
                thumbnail: mediaUrl,
                mediaType,
                mediaUrl
            }

            // Append to list and save
            const updated = [newItem, ...projects]
            await AsyncStorage.setItem('lumi_projects', JSON.stringify(updated))
            
            setIsRendering(false)
            setIsSuccess(true)
        } catch (e) {
            setIsRendering(false)
            setIsSuccess(true)
        }
    }

    const downloadToCameraRoll = () => {
        Alert.alert('Saved!', 'Media exported to your camera roll successfully.')
    }

    return (
        <View style={{ flex: 1, backgroundColor: BG }}>
            {/* Header bar */}
            <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={s.navBtn}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </Pressable>
                <Text style={s.headerTitle}>Export Studio</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 28 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Visual Media Preview */}
                <View style={s.previewCardOuter}>
                    <Image source={{ uri: mediaUrl }} style={s.mediaPreview as any} resizeMode="cover" />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.5)']}
                        style={StyleSheet.absoluteFillObject}
                    />
                    {/* Render badge overlay */}
                    <View style={s.aspectRatioBadge}>
                        <Text style={s.aspectText}>{selectedAspect}</Text>
                    </View>
                </View>

                {/* Exporter configurations panels */}
                {!isRendering && !isSuccess && (
                    <View style={{ gap: 14 }}>
                        {/* Size templates selector */}
                        <Text style={s.sectionTitle}>Select Crop Aspect Ratio</Text>
                        <View style={s.aspectRow}>
                            {[
                                { key: '9:16', label: 'Story / TikTok', icon: 'logo-tiktok' },
                                { key: '1:1', label: 'Square Post', icon: 'logo-instagram' },
                                { key: '4:5', label: 'Portrait Feed', icon: 'phone-portrait-outline' },
                                { key: '16:9', label: 'Cinema Post', icon: 'desktop-outline' }
                            ].map((asp) => (
                                <Pressable
                                    key={asp.key}
                                    onPress={() => setSelectedAspect(asp.key as AspectRatio)}
                                    style={[s.aspectChip, selectedAspect === asp.key && s.aspectChipActive]}
                                >
                                    <Ionicons name={asp.icon as any} size={14} color={selectedAspect === asp.key ? '#fff' : ACCENT} />
                                    <Text style={[s.aspectChipText, selectedAspect === asp.key && { color: '#fff' }]}>{asp.key}</Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* Export Quality Panel */}
                        <Text style={s.sectionTitle}>Output Quality Preset</Text>
                        <View style={s.qualityRow}>
                            <Pressable
                                onPress={() => setExportQuality('HD')}
                                style={[s.qualityCard, exportQuality === 'HD' && s.qualityCardActive]}
                            >
                                <Text style={[s.qualityTitle, exportQuality === 'HD' && { color: '#fff' }]}>Standard HD</Text>
                                <Text style={s.qualityDesc}>1080p · Fast render</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setExportQuality('4K PRO')}
                                style={[s.qualityCard, exportQuality === '4K PRO' && s.qualityCardActive]}
                            >
                                <LinearGradient colors={['rgba(217,70,239,0.15)', 'transparent']} style={StyleSheet.absoluteFillObject} />
                                <Text style={[s.qualityTitle, exportQuality === '4K PRO' && { color: '#fff' }]}>4K Pro UHD</Text>
                                <Text style={s.qualityDesc}>2160p · AI upscale · 60fps</Text>
                            </Pressable>
                        </View>

                        {/* Custom parameter log strip */}
                        <Card style={s.summaryCard}>
                            <Ionicons name="sparkles" size={16} color={ACCENT} />
                            <View style={{ flex: 1 }}>
                                <Text style={s.summaryTitle}>AI Modifications Applied</Text>
                                <Text style={s.summaryText} numberOfLines={2}>{editsSummary}</Text>
                            </View>
                        </Card>

                        {/* Action CTA triggers */}
                        <Pressable
                            onPress={startRenderingAndSave}
                            style={({ pressed }) => [s.compileBtn, pressed && { opacity: 0.85 }]}
                        >
                            <Ionicons name="color-wand" size={20} color="#fff" />
                            <Text style={s.compileBtnText}>Render & Compile Creative Asset</Text>
                        </Pressable>
                    </View>
                )}

                {/* Rendering overlay progress */}
                {isRendering && (
                    <View style={s.renderWrap}>
                        <View style={s.progressRingOuter}>
                            <ActivityIndicator size="large" color={ACCENT} />
                            <Text style={s.progressRingText}>{renderProgress}%</Text>
                        </View>
                        <Text style={s.renderStageTitle}>{RENDERING_STEPS[renderStepIndex]}</Text>
                        <Text style={s.renderStageSub}>Synthesizing bilateral frames on local neural sandbox...</Text>
                    </View>
                )}

                {/* Success Screen state */}
                {isSuccess && (
                    <View style={s.successWrap}>
                        <View style={s.successCircle}>
                            <Ionicons name="checkmark" size={40} color="#fff" />
                        </View>
                        <Text style={s.successTitle}>Creative Asset Exported!</Text>
                        <Text style={s.successSub}>Your edited {mediaType === 'image' ? 'photo' : 'video'} was compiled in {exportQuality} 60fps quality and saved to Creations Gallery.</Text>

                        {/* Action tools */}
                        <View style={s.sharingGrid}>
                            <Pressable
                                onPress={downloadToCameraRoll}
                                style={({ pressed }) => [s.actionItem, pressed && s.actionItemPressed]}
                            >
                                <Ionicons name="download-outline" size={20} color="#fff" />
                                <Text style={s.actionItemText}>Save to Device</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => router.push('/(tabs)')}
                                style={({ pressed }) => [s.actionItem, { backgroundColor: SURFACE }, pressed && s.actionItemPressed]}
                            >
                                <Ionicons name="home-outline" size={20} color="#fff" />
                                <Text style={s.actionItemText}>Home Studio</Text>
                            </Pressable>
                        </View>

                        {/* Social templates triggers */}
                        <Text style={[s.sectionTitle, { marginTop: 10, alignSelf: 'flex-start' }]}>Quick Share Templates</Text>
                        <View style={s.socialRow}>
                            <Pressable onPress={() => Alert.alert('Shared!', 'Asset uploaded to Reels template.')} style={s.socialBtn}>
                                <Ionicons name="logo-instagram" size={18} color="#fff" />
                                <Text style={s.socialBtnText}>Instagram Reels</Text>
                            </Pressable>
                            <Pressable onPress={() => Alert.alert('Shared!', 'Asset uploaded to TikTok template.')} style={s.socialBtn}>
                                <Ionicons name="logo-tiktok" size={18} color="#fff" />
                                <Text style={s.socialBtnText}>TikTok Story</Text>
                            </Pressable>
                        </View>
                    </View>
                )}
            </ScrollView>
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
    body: { padding: 20, gap: 12 },
    
    // Preview
    previewCardOuter: {
        width: '100%',
        height: SW * 1.1,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        position: 'relative'
    },
    mediaPreview: { width: '100%', height: '100%' },
    aspectRatioBadge: {
        position: 'absolute',
        top: 14,
        right: 14,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    aspectText: { fontSize: 10, fontWeight: '800', color: '#fff' },

    sectionTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: TEXT_TERTIARY,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginTop: 4,
    },

    // Crop options
    aspectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    aspectChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 6
    },
    aspectChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
    aspectChipText: { fontSize: 11, color: TEXT_SECONDARY, fontWeight: '700' },

    // Quality Row
    qualityRow: { flexDirection: 'row', gap: 12 },
    qualityCard: {
        flex: 1,
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 14,
        padding: 12,
        gap: 3,
        overflow: 'hidden'
    },
    qualityCardActive: { borderColor: ACCENT },
    qualityTitle: { fontSize: 13, color: TEXT_SECONDARY, fontWeight: '700' },
    qualityDesc: { fontSize: 10.5, color: TEXT_TERTIARY },

    // Summary parameters card
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: SURFACE2,
        padding: 12
    },
    summaryTitle: { fontSize: 13, color: '#fff', fontWeight: '700' },
    summaryText: { fontSize: 11.5, color: TEXT_SECONDARY, lineHeight: 16, marginTop: 1 },

    // Compile button
    compileBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        marginTop: 4
    },
    compileBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

    // Render Loader overlay
    renderWrap: { alignItems: 'center', gap: 14, paddingVertical: 24 },
    progressRingOuter: {
        width: 80,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
    },
    progressRingText: { position: 'absolute', color: '#fff', fontSize: 14, fontWeight: '800' },
    renderStageTitle: { fontSize: 14, fontWeight: '700', color: '#fff', textAlign: 'center' },
    renderStageSub: { fontSize: 11.5, color: TEXT_TERTIARY, textAlign: 'center' },

    // Success Screen State
    successWrap: { alignItems: 'center', gap: 14, paddingVertical: 10 },
    successCircle: {
        width: 64,
        height: 64,
        borderRadius: 999,
        backgroundColor: ACCENT,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8
    },
    successTitle: { fontSize: 20, fontWeight: '900', color: '#fff', textAlign: 'center' },
    successSub: { fontSize: 13, color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 19, paddingHorizontal: 12 },
    
    sharingGrid: { flexDirection: 'row', gap: 12, marginTop: 6 },
    actionItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT,
        paddingVertical: 12,
        borderRadius: 10,
        gap: 6
    },
    actionItemPressed: { opacity: 0.85 },
    actionItemText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    
    socialRow: { flexDirection: 'row', gap: 10, width: '100%' },
    socialBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: BORDER,
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6
    },
    socialBtnText: { color: '#fff', fontSize: 11.5, fontWeight: '700' }
})
