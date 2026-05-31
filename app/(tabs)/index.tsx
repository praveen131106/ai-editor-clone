import { useMemo, useState, useEffect } from 'react'
import {
    View,
    ScrollView,
    StyleSheet,
    RefreshControl,
    Pressable,
    Image,
    Dimensions,
    ActivityIndicator,
    Modal,
    Alert
} from 'react-native'
import { router, useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'

import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import { useMedia } from '@/contexts/MediaContext'
import { copyToAppStorage, validateFileUri } from '@/lib/mediaUtils'
import {
    ACCENT,
    ACCENT_DIM,
    ACCENT_LIGHT,
    BG,
    SURFACE,
    SURFACE2,
    BORDER,
    TEXT_PRIMARY,
    TEXT_SECONDARY,
    TEXT_TERTIARY,
} from '@/lib/theme'
import { TAB_BAR_CLEARANCE } from '@/components/TabBar'
import {
    AI_STYLE_FILTERS,
    STOCK_PORTRAITS,
    STOCK_VIDEOS,
    itemSummaries as defaultProjects,
    type ItemSummary
} from '@/lib/mockData'

const { width: SW } = Dimensions.get('window')

export default function HomeScreen() {
    const insets = useSafeAreaInsets()
    const navigation = useNavigation()
    const { setMedia } = useMedia()
    const [refreshing, setRefreshing] = useState(false)
    const [projects, setProjects] = useState<ItemSummary[]>([])
    const [isLoadingProjects, setIsLoadingProjects] = useState(true)
    const [isProcessing, setIsProcessing] = useState(false)

    // Stock Media Picker State
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false)
    const [selectedMediaType, setSelectedMediaType] = useState<'image' | 'video'>('image')
    const [pickerTargetTool, setPickerTargetTool] = useState<string>('photo')

    // Greeting based on local time
    const greeting = useMemo(() => {
        const h = new Date().getHours()
        if (h < 12) return 'Good morning'
        if (h < 17) return 'Good afternoon'
        return 'Good evening'
    }, [])

    // Load recent projects from AsyncStorage or fallback to mockData
    const loadProjects = async () => {
        setIsLoadingProjects(true)
        try {
            const stored = await AsyncStorage.getItem('novaglow_projects')
            if (stored) {
                setProjects(JSON.parse(stored))
            } else {
                // Seed default mock projects if none exist
                await AsyncStorage.setItem('novaglow_projects', JSON.stringify(defaultProjects))
                setProjects(defaultProjects)
            }
        } catch (e) {
            setProjects(defaultProjects)
        } finally {
            setIsLoadingProjects(false)
        }
    }

    useEffect(() => {
        loadProjects()
        // Reload projects when home screen focuses
        const unsubscribe = navigation.addListener('focus', () => {
            loadProjects()
        })
        return unsubscribe
    }, [navigation])

    const onRefresh = async () => {
        setRefreshing(true)
        await loadProjects()
        setRefreshing(false)
    }

    /**
     * Process a picked asset: validate, copy to app storage, set in context, navigate.
     */
    const processAndNavigate = async (asset: ImagePicker.ImagePickerAsset, mediaType: 'image' | 'video', tool: string) => {
        const uri = asset.uri
        console.log('[Home] Raw picked URI:', uri)
        console.log('[Home] Asset:', JSON.stringify({ width: asset.width, height: asset.height, fileSize: asset.fileSize, type: asset.type }))

        // Validate the asset
        if (!uri || uri.length === 0) {
            Alert.alert('Error', 'Image picker returned an empty URI.')
            return
        }

        setIsProcessing(true)

        try {
            // Copy to stable app storage
            const stableUri = await copyToAppStorage(uri, mediaType === 'video')
            console.log('[Home] Stable URI:', stableUri)

            // Validate the copied file
            const validation = await validateFileUri(stableUri)
            console.log('[Home] Validation:', JSON.stringify(validation))

            if (!validation.exists) {
                Alert.alert('Error', 'Failed to save the selected image. The file could not be copied.')
                setIsProcessing(false)
                return
            }

            // Set in global context
            setMedia({
                uri: stableUri,
                originalUri: uri,
                type: mediaType,
                fileSize: asset.fileSize || validation.size || 0,
                width: asset.width || 0,
                height: asset.height || 0,
                initialTool: tool,
                filterId: '',
                projectId: '',
            })

            // Navigate WITHOUT passing URI in params
            router.push('/editor')
        } catch (error) {
            console.error('[Home] processAndNavigate error:', error)
            Alert.alert('Error', 'Something went wrong processing the image.')
        } finally {
            setIsProcessing(false)
        }
    }

    // Launch camera picker
    const launchCameraPicker = async () => {
        setIsMediaModalOpen(false)
        const permission = await ImagePicker.requestCameraPermissionsAsync()
        if (!permission.granted) {
            Alert.alert('Permission Denied', 'NovaGlow AI requires camera access to take new photos and videos.')
            return
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: selectedMediaType === 'image' ? ['images'] : ['videos'],
            allowsEditing: true,
            aspect: [9, 16],
            quality: 1,
        })

        if (!result.canceled && result.assets && result.assets.length > 0) {
            await processAndNavigate(result.assets[0], selectedMediaType, pickerTargetTool)
        }
    }

    // Launch gallery image/video picker
    const launchGalleryPicker = async () => {
        setIsMediaModalOpen(false)
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!permission.granted) {
            Alert.alert('Permission Denied', 'Gallery access is required.')
            return
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: selectedMediaType === 'image' ? ['images'] : ['videos'],
            allowsEditing: selectedMediaType === 'image',
            aspect: [9, 16],
            quality: 1,
        })

        if (!result.canceled && result.assets && result.assets.length > 0) {
            await processAndNavigate(result.assets[0], selectedMediaType, pickerTargetTool)
        }
    }

    // Select preloaded stock media to edit instantly (no copy needed for remote URLs)
    const selectStockMedia = (url: string) => {
        setIsMediaModalOpen(false)
        setMedia({
            uri: url,
            originalUri: url,
            type: selectedMediaType,
            fileSize: 0,
            width: 0,
            height: 0,
            initialTool: pickerTargetTool,
            filterId: '',
            projectId: '',
        })
        router.push('/editor')
    }

    // Trigger tool picker modal
    const openToolPicker = (type: 'image' | 'video', toolKey: string) => {
        setSelectedMediaType(type)
        setPickerTargetTool(toolKey)
        setIsMediaModalOpen(true)
    }

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: BG }}
            contentContainerStyle={[s.container, { paddingTop: insets.top + 16, paddingBottom: TAB_BAR_CLEARANCE + 16 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
            showsVerticalScrollIndicator={false}
        >
            {/* Header / Brand bar */}
            <View style={s.header}>
                <View>
                    <Text style={s.brandLogo}>NovaGlow <Text style={{ color: ACCENT }}>AI</Text></Text>
                    <Text style={s.subGreeting}>{greeting}, Creator</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <Pressable
                        onPress={() => router.push('/image-debug')}
                        style={({ pressed }) => [s.debugBadge, pressed && { opacity: 0.8 }]}
                    >
                        <Ionicons name="bug-outline" size={14} color="#fff" />
                    </Pressable>
                    <Pressable
                        onPress={() => router.push('/upgrade')}
                        style={({ pressed }) => [s.proBadge, pressed && { opacity: 0.8 }]}
                    >
                        <Ionicons name="sparkles" size={14} color="#fff" />
                        <Text style={s.proBadgeText}>PRO</Text>
                    </Pressable>
                </View>
            </View>

            {/* Trending Viral Filters Banner (Horizontal Scroll) */}
            <Text style={s.sectionTitle}>Trending AI Filters</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.bannerRow}
            >
                {AI_STYLE_FILTERS.map((filter) => (
                    <Pressable
                        key={filter.id}
                        onPress={() => {
                            setMedia({
                                uri: filter.sampleBefore,
                                originalUri: filter.sampleBefore,
                                type: 'image',
                                fileSize: 0,
                                width: 0,
                                height: 0,
                                initialTool: 'filters',
                                filterId: filter.id,
                                projectId: '',
                            })
                            router.push('/editor')
                        }}
                        style={({ pressed }) => [s.bannerCard, pressed && { opacity: 0.9 }]}
                    >
                        <Image source={{ uri: filter.sampleAfter }} style={s.bannerImage} />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.85)']}
                            style={StyleSheet.absoluteFillObject}
                        />
                        <View style={s.bannerBadge}>
                            <Text style={s.bannerBadgeText}>{filter.category}</Text>
                        </View>
                        <View style={s.bannerContent}>
                            <Text style={s.bannerName}>{filter.name}</Text>
                            <Text style={s.bannerTagline} numberOfLines={1}>{filter.tagline}</Text>
                        </View>
                    </Pressable>
                ))}
            </ScrollView>

            {/* Quick Action Grid */}
            <Text style={s.sectionTitle}>Creative Studios</Text>
            <View style={s.gridRow}>
                <Pressable
                    onPress={() => openToolPicker('image', 'beauty')}
                    style={({ pressed }) => [s.gridItem, pressed && s.gridItemPressed]}
                >
                    <LinearGradient colors={['rgba(217,70,239,0.15)', 'transparent']} style={s.gridGrad} />
                    <View style={s.iconBg}>
                        <Ionicons name="sparkles-outline" size={24} color={ACCENT} />
                    </View>
                    <Text style={s.gridTitle}>AI Beauty</Text>
                    <Text style={s.gridDesc}>Retouch & Hair</Text>
                </Pressable>

                <View
                    style={[s.gridItem, { opacity: 0.4 }]}
                >
                    <LinearGradient colors={['rgba(6,182,212,0.15)', 'transparent']} style={s.gridGrad} />
                    <View style={[s.iconBg, { backgroundColor: 'rgba(6,182,212,0.1)' }]}>
                        <Ionicons name="videocam-outline" size={24} color="#06b6d4" />
                    </View>
                    <Text style={s.gridTitle}>AI Video</Text>
                    <Text style={[s.gridDesc, { color: '#fbbf24' }]}>Coming Soon</Text>
                </View>
            </View>

            <View style={s.gridRow}>
                <Pressable
                    onPress={() => openToolPicker('image', 'bg_swap')}
                    style={({ pressed }) => [s.gridItem, pressed && s.gridItemPressed]}
                >
                    <LinearGradient colors={['rgba(59,130,246,0.15)', 'transparent']} style={s.gridGrad} />
                    <View style={[s.iconBg, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                        <Ionicons name="color-wand-outline" size={24} color="#3b82f6" />
                    </View>
                    <Text style={s.gridTitle}>BG Swap</Text>
                    <Text style={s.gridDesc}>Portrait Cutout</Text>
                </Pressable>

                <Pressable
                    onPress={() => openToolPicker('image', 'eraser')}
                    style={({ pressed }) => [s.gridItem, pressed && s.gridItemPressed]}
                >
                    <LinearGradient colors={['rgba(244,63,94,0.15)', 'transparent']} style={s.gridGrad} />
                    <View style={[s.iconBg, { backgroundColor: 'rgba(244,63,94,0.1)' }]}>
                        <Ionicons name="trash-bin-outline" size={24} color="#f43f5e" />
                    </View>
                    <Text style={s.gridTitle}>Object Eraser</Text>
                    <Text style={s.gridDesc}>Smart Healing</Text>
                </Pressable>
            </View>

            <View style={s.gridRow}>
                <Pressable
                    onPress={() => openToolPicker('image', 'avatar')}
                    style={({ pressed }) => [s.gridItem, pressed && s.gridItemPressed]}
                >
                    <LinearGradient colors={['rgba(168,85,247,0.15)', 'transparent']} style={s.gridGrad} />
                    <View style={[s.iconBg, { backgroundColor: 'rgba(168,85,247,0.1)' }]}>
                        <Ionicons name="person-circle-outline" size={24} color="#a855f7" />
                    </View>
                    <Text style={s.gridTitle}>AI Avatar</Text>
                    <Text style={s.gridDesc}>Hairstyles & Styles</Text>
                </Pressable>

                <Pressable
                    onPress={() => openToolPicker('image', 'story')}
                    style={({ pressed }) => [s.gridItem, pressed && s.gridItemPressed]}
                >
                    <LinearGradient colors={['rgba(16,185,129,0.15)', 'transparent']} style={s.gridGrad} />
                    <View style={[s.iconBg, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                        <Ionicons name="images-outline" size={24} color="#10b981" />
                    </View>
                    <Text style={s.gridTitle}>AI Story</Text>
                    <Text style={s.gridDesc}>Carousel Creator</Text>
                </Pressable>
            </View>

            {/* Recent Drafts Section */}
            <View style={[s.recentHeader, { marginTop: 8 }]}>
                <Text style={s.sectionTitle}>Recent Creations</Text>
                <Pressable onPress={() => router.push('/activity')} hitSlop={12}>
                    <Text style={s.viewAllText}>View All</Text>
                </Pressable>
            </View>

            {isLoadingProjects ? (
                <View style={s.loaderWrap}>
                    <ActivityIndicator color={ACCENT} />
                </View>
            ) : projects.length === 0 ? (
                <Card style={s.emptyCard}>
                    <Ionicons name="folder-open-outline" size={32} color={TEXT_TERTIARY} />
                    <Text style={s.emptyTitle}>No projects yet</Text>
                    <Text style={s.emptySub}>Select a tool above to start your first edit.</Text>
                </Card>
            ) : (
                <View style={s.projectsList}>
                    {projects.slice(0, 3).map((proj) => (
                        <Pressable
                            key={proj.id}
                            onPress={() => {
                                setMedia({
                                    uri: proj.mediaUrl,
                                    originalUri: proj.mediaUrl,
                                    type: proj.mediaType,
                                    fileSize: 0,
                                    width: 0,
                                    height: 0,
                                    initialTool: 'retouch',
                                    filterId: '',
                                    projectId: proj.id,
                                })
                                router.push('/editor')
                            }}
                            style={({ pressed }) => [s.projectCard, pressed && { opacity: 0.85 }]}
                        >
                            <Image source={{ uri: proj.thumbnail }} style={s.projectThumb} />
                            <View style={s.projectInfo}>
                                <Text style={s.projectName}>{proj.name}</Text>
                                <Text style={s.projectSummary} numberOfLines={1}>{proj.summary}</Text>
                                <View style={s.projectStats}>
                                    <View style={s.statBadge}>
                                        <Ionicons name="flash-outline" size={11} color={ACCENT} />
                                        <Text style={s.statText}>Viral {proj.health}%</Text>
                                    </View>
                                    <Text style={s.projectTime}>{proj.updatedAt}</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={TEXT_TERTIARY} style={{ alignSelf: 'center' }} />
                        </Pressable>
                    ))}
                </View>
            )}

            {/* Media Selector Bottom Sheet / Dialog Modal */}
            <Modal
                visible={isMediaModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsMediaModalOpen(false)}
            >
                <View style={s.modalContainer}>
                    <Pressable style={s.modalBackdrop} onPress={() => setIsMediaModalOpen(false)} />
                    <View style={s.modalContent}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>{`Select a ${selectedMediaType === 'image' ? 'Photo' : 'Video'}`}</Text>
                            <Pressable onPress={() => setIsMediaModalOpen(false)} hitSlop={12}>
                                <Ionicons name="close" size={20} color={TEXT_SECONDARY} />
                            </Pressable>
                        </View>
                        <View style={s.modalBody}>
                            <Text style={s.modalSubtitle}>Choose a pre-loaded stock model to test NovaGlow AI features instantly, or upload from your device:</Text>

                            {/* Stock models row */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.stockRow}>
                                {selectedMediaType === 'image' ? (
                                    STOCK_PORTRAITS.map((model) => (
                                        <Pressable
                                            key={model.id}
                                            onPress={() => selectStockMedia(model.url)}
                                            style={s.stockCard}
                                        >
                                            <Image source={{ uri: model.url }} style={s.stockImage} />
                                            <Text style={s.stockName} numberOfLines={1}>{model.name.split(' ')[0]}</Text>
                                        </Pressable>
                                    ))
                                ) : (
                                    STOCK_VIDEOS.map((video) => (
                                        <Pressable
                                            key={video.id}
                                            onPress={() => selectStockMedia(video.url)}
                                            style={s.stockCard}
                                        >
                                            <Image source={{ uri: video.poster }} style={s.stockImage} />
                                            <View style={s.playOverlay}>
                                                <Ionicons name="play" size={18} color="#fff" />
                                            </View>
                                            <Text style={s.stockName} numberOfLines={1}>{video.name.split(' ')[0]}</Text>
                                        </Pressable>
                                    ))
                                )}
                            </ScrollView>

                            {/* Upload buttons stacked beautifully */}
                            <View style={{ gap: 10, marginTop: 6 }}>
                                <Pressable
                                    onPress={launchCameraPicker}
                                    style={({ pressed }) => [s.uploadBtn, { backgroundColor: SURFACE2, borderWidth: 1, borderColor: BORDER }, pressed && { opacity: 0.85 }]}
                                >
                                    <Ionicons name="camera-outline" size={20} color={ACCENT} />
                                    <Text style={[s.uploadBtnText, { color: '#fff' }]}>Take a New Photo/Video</Text>
                                </Pressable>

                                <Pressable
                                    onPress={launchGalleryPicker}
                                    style={({ pressed }) => [s.uploadBtn, pressed && { opacity: 0.85 }]}
                                >
                                    <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                                    <Text style={s.uploadBtnText}>Upload from Camera Roll</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    )
}

const s = StyleSheet.create({
    container: { paddingHorizontal: 20, gap: 14 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    brandLogo: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
    subGreeting: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 },
    proBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: ACCENT,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 4,
    },
    debugBadge: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: SURFACE,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: BORDER,
    },
    proBadgeText: { fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: TEXT_TERTIARY,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginTop: 6,
    },

    // Trending Banners
    bannerRow: { gap: 12, paddingVertical: 4 },
    bannerCard: {
        width: SW * 0.45,
        height: SW * 0.6,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)'
    },
    bannerImage: { width: '100%', height: '100%' },
    bannerBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)'
    },
    bannerBadgeText: { fontSize: 9, fontWeight: '800', color: ACCENT_LIGHT, textTransform: 'uppercase' },
    bannerContent: { position: 'absolute', bottom: 12, left: 12, right: 12, gap: 2 },
    bannerName: { fontSize: 14, fontWeight: '800', color: '#fff' },
    bannerTagline: { fontSize: 10, color: TEXT_SECONDARY },

    // Creative grid rows
    gridRow: { flexDirection: 'row', gap: 12 },
    gridItem: {
        flex: 1,
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: 14,
        gap: 8,
        overflow: 'hidden'
    },
    gridGrad: { ...StyleSheet.absoluteFillObject },
    gridItemPressed: {
        opacity: 0.85,
        borderColor: 'rgba(255,255,255,0.15)'
    },
    iconBg: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(217,70,239,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridTitle: { fontSize: 14, fontWeight: '800', color: '#fff' },
    gridDesc: { fontSize: 11, color: TEXT_SECONDARY },

    // Recent drafts
    recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    viewAllText: { fontSize: 12, color: ACCENT, fontWeight: '700' },
    projectsList: { gap: 10 },
    projectCard: {
        flexDirection: 'row',
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: 10,
        gap: 12
    },
    projectThumb: { width: 56, height: 56, borderRadius: 10 },
    projectInfo: { flex: 1, justifyContent: 'center', gap: 3 },
    projectName: { fontSize: 14, fontWeight: '700', color: '#fff' },
    projectSummary: { fontSize: 11.5, color: TEXT_SECONDARY },
    projectStats: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(217,70,239,0.08)',
        borderWidth: 0.5,
        borderColor: 'rgba(217,70,239,0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4
    },
    statText: { fontSize: 9.5, fontWeight: '700', color: ACCENT_LIGHT },
    projectTime: { fontSize: 11, color: TEXT_TERTIARY },
    loaderWrap: { paddingVertical: 20 },
    emptyCard: { alignItems: 'center', gap: 6, paddingVertical: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.1)' },
    emptyTitle: { fontSize: 14, color: '#fff', fontWeight: '700' },
    emptySub: { fontSize: 12, color: TEXT_SECONDARY, textAlign: 'center' },

    // Modal Selection Body
    modalBody: { gap: 16, paddingBottom: 10 },
    modalSubtitle: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 18 },
    stockRow: { gap: 10, paddingVertical: 6 },
    stockCard: { width: 85, gap: 6, alignItems: 'center' },
    stockImage: { width: 80, height: 110, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    stockName: { fontSize: 11, color: TEXT_SECONDARY, fontWeight: '600' },
    playOverlay: {
        position: 'absolute',
        top: 40,
        width: 28,
        height: 28,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)'
    },
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT,
        paddingVertical: 13,
        borderRadius: 12,
        gap: 8,
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        marginTop: 6
    },
    uploadBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    
    // Custom Modal styling
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject },
    modalContent: {
        backgroundColor: SURFACE,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 20,
        gap: 16
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 16, fontWeight: '800', color: '#fff' }
})
