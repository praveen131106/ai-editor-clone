import { useMemo, useState, useEffect } from 'react'
import {
    View,
    ScrollView,
    StyleSheet,
    Pressable,
    Image,
    Alert,
    ActivityIndicator,
    DeviceEventEmitter
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import {
    ACCENT,
    BG,
    BORDER,
    SURFACE,
    TEXT_PRIMARY,
    TEXT_SECONDARY,
    TEXT_TERTIARY,
} from '@/lib/theme'
import { TAB_BAR_CLEARANCE } from '@/components/TabBar'
import { itemSummaries as defaultProjects, type ItemSummary, type NotificationItem, notificationItems as defaultNotifications } from '@/lib/mockData'

type FilterMediaType = 'all' | 'image' | 'video'

export default function ActivityScreen() {
    const insets = useSafeAreaInsets()
    const navigation = useNavigation()
    const [viewMode, setViewMode] = useState<'creations' | 'notifications'>('creations')
    const [activeTab, setActiveTab] = useState<FilterMediaType>('all')
    const [creations, setCreations] = useState<ItemSummary[]>([])
    const [notifications, setNotifications] = useState<NotificationItem[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Load creations history from AsyncStorage
    const loadCreations = async () => {
        setIsLoading(true)
        try {
            const stored = await AsyncStorage.getItem('lumi_projects')
            if (stored) {
                setCreations(JSON.parse(stored))
            } else {
                await AsyncStorage.setItem('lumi_projects', JSON.stringify(defaultProjects))
                setCreations(defaultProjects)
            }
        } catch (e) {
            setCreations(defaultProjects)
        } finally {
            setIsLoading(false)
        }
    }

    // Load notifications from AsyncStorage
    const loadNotifications = async () => {
        try {
            const stored = await AsyncStorage.getItem('lumi_notifications')
            if (stored) {
                setNotifications(JSON.parse(stored))
            } else {
                await AsyncStorage.setItem('lumi_notifications', JSON.stringify(defaultNotifications))
                setNotifications(defaultNotifications)
            }
        } catch (e) {
            setNotifications(defaultNotifications)
        }
    }

    useEffect(() => {
        loadCreations()
        loadNotifications()
        const unsubscribe = navigation.addListener('focus', () => {
            loadCreations()
            loadNotifications()
        })
        return unsubscribe
    }, [navigation])

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('lumi_new_notification', () => {
            loadNotifications()
        })
        return () => sub.remove()
    }, [])

    const filteredCreations = useMemo(() => {
        if (activeTab === 'all') return creations
        return creations.filter((item) => item.mediaType === activeTab)
    }, [activeTab, creations])

    // Delete a creation
    const deleteCreation = async (id: string) => {
        Alert.alert(
            'Delete Project',
            'Are you sure you want to remove this project from your creations?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const updated = creations.filter((item) => item.id !== id)
                        setCreations(updated)
                        await AsyncStorage.setItem('lumi_projects', JSON.stringify(updated))
                    }
                }
            ]
        )
    }

    // Open item in editor
    const resumeEdit = (item: ItemSummary) => {
        router.push({
            pathname: '/editor',
            params: {
                mediaType: item.mediaType,
                mediaUrl: item.mediaUrl,
                projectId: item.id
            }
        })
    }

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: BG }}
            contentContainerStyle={[s.container, { paddingTop: insets.top + 16, paddingBottom: TAB_BAR_CLEARANCE + 16 }]}
            showsVerticalScrollIndicator={false}
        >
            {/* Header */}
            <View style={s.header}>
                <View>
                    <Text style={s.title}>Creative Activity</Text>
                    <Text style={s.subtitle}>Your creations history and local notifications feed.</Text>
                </View>
            </View>

            {/* Creations vs Notifications Mode Tab Switcher */}
            <View style={s.segmentRow}>
                <Pressable
                    onPress={() => setViewMode('creations')}
                    style={[s.segmentItem, viewMode === 'creations' && s.segmentItemActive]}
                >
                    <Text style={[s.segmentText, viewMode === 'creations' && s.segmentTextActive]}>Creations ({creations.length})</Text>
                </Pressable>
                <Pressable
                    onPress={() => setViewMode('notifications')}
                    style={[s.segmentItem, viewMode === 'notifications' && s.segmentItemActive]}
                >
                    <Text style={[s.segmentText, viewMode === 'notifications' && s.segmentTextActive]}>Notifications ({notifications.filter(n => !n.read).length} Unread)</Text>
                </Pressable>
            </View>

            {viewMode === 'creations' ? (
                <>
                    {/* Media type segment row */}
                    <View style={[s.segmentRow, { marginTop: 0 }]}>
                        <Pressable
                            onPress={() => setActiveTab('all')}
                            style={[s.segmentItem, activeTab === 'all' && s.segmentItemActive]}
                        >
                            <Text style={[s.segmentText, activeTab === 'all' && s.segmentTextActive]}>All ({creations.length})</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setActiveTab('image')}
                            style={[s.segmentItem, activeTab === 'image' && s.segmentItemActive]}
                        >
                            <Text style={[s.segmentText, activeTab === 'image' && s.segmentTextActive]}>Photos ({creations.filter(c => c.mediaType === 'image').length})</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setActiveTab('video')}
                            style={[s.segmentItem, activeTab === 'video' && s.segmentItemActive]}
                        >
                            <Text style={[s.segmentText, activeTab === 'video' && s.segmentTextActive]}>Videos ({creations.filter(c => c.mediaType === 'video').length})</Text>
                        </Pressable>
                    </View>

                    {/* Creations List area */}
                    {isLoading ? (
                        <View style={s.center}>
                            <ActivityIndicator color={ACCENT} />
                        </View>
                    ) : filteredCreations.length === 0 ? (
                        <Card style={s.emptyCard}>
                            <Ionicons name="folder-open-outline" size={36} color={TEXT_TERTIARY} />
                            <Text style={s.emptyTitle}>Empty gallery</Text>
                            <Text style={s.emptySub}>No saved projects matching this filter.</Text>
                        </Card>
                    ) : (
                        <View style={s.listWrap}>
                            {filteredCreations.map((item) => (
                                <Pressable
                                    key={item.id}
                                    onPress={() => resumeEdit(item)}
                                    style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}
                                >
                                    <Image source={{ uri: item.thumbnail }} style={s.thumbnail} />
                                    
                                    {item.mediaType === 'video' && (
                                        <View style={s.playBadge}>
                                            <Ionicons name="play" size={10} color="#fff" />
                                        </View>
                                    )}

                                    <View style={s.rowBody}>
                                        <Text style={s.rowTitle}>{item.name}</Text>
                                        <Text style={s.rowSummary} numberOfLines={1}>{item.summary}</Text>
                                        <Text style={s.rowTime}>{item.updatedAt} · {item.mediaType === 'image' ? 'Photo' : 'Video'}</Text>
                                    </View>

                                    <Pressable
                                        onPress={() => deleteCreation(item.id)}
                                        hitSlop={12}
                                        style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.7 }]}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={TEXT_TERTIARY} />
                                    </Pressable>
                                </Pressable>
                            ))}
                        </View>
                    )}
                </>
            ) : (
                <>
                    {/* Notifications List area */}
                    {notifications.length === 0 ? (
                        <Card style={s.emptyCard}>
                            <Ionicons name="notifications-off-outline" size={36} color={TEXT_TERTIARY} />
                            <Text style={s.emptyTitle}>No Alerts</Text>
                            <Text style={s.emptySub}>You have no notification alerts yet.</Text>
                        </Card>
                    ) : (
                        <View style={s.listWrap}>
                            {notifications.map((notif) => (
                                <View key={notif.id} style={[s.row, !notif.read && { borderColor: `${ACCENT}55`, borderWidth: 1 }]}>
                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(217,70,239,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="notifications-outline" size={16} color={ACCENT} />
                                    </View>
                                    <View style={s.rowBody}>
                                        <Text style={[s.rowTitle, !notif.read && { fontWeight: '800' }]}>{notif.title}</Text>
                                        <Text style={s.rowSummary} numberOfLines={2}>{notif.body}</Text>
                                        <Text style={s.rowTime}>{notif.timeAgo}</Text>
                                    </View>
                                    {!notif.read && (
                                        <Pressable
                                            onPress={async () => {
                                                const updated = notifications.map(n => n.id === notif.id ? { ...n, read: true } : n)
                                                setNotifications(updated)
                                                await AsyncStorage.setItem('lumi_notifications', JSON.stringify(updated))
                                            }}
                                            style={{ backgroundColor: `${ACCENT}15`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                                        >
                                            <Text style={{ fontSize: 9.5, color: ACCENT, fontWeight: '700' }}>Mark Read</Text>
                                        </Pressable>
                                    )}
                                </View>
                            ))}
                        </View>
                    )}
                </>
            )}
        </ScrollView>
    )
}

const s = StyleSheet.create({
    container: { paddingHorizontal: 20, gap: 12 },
    header: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
    title: { fontSize: 24, fontWeight: '900', color: TEXT_PRIMARY, letterSpacing: -0.5 },
    subtitle: { marginTop: 3, fontSize: 13, color: TEXT_SECONDARY },
    
    // Segmented tab bar
    segmentRow: {
        flexDirection: 'row',
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 11,
        padding: 3,
        marginTop: 4
    },
    segmentItem: {
        flex: 1,
        borderRadius: 8,
        alignItems: 'center',
        paddingVertical: 8,
    },
    segmentItemActive: {
        backgroundColor: ACCENT,
    },
    segmentText: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '700' },
    segmentTextActive: { color: '#fff' },
    
    // List row items
    listWrap: { gap: 10 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 14,
        padding: 10,
        gap: 12,
        position: 'relative'
    },
    thumbnail: {
        width: 56,
        height: 56,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)'
    },
    playBadge: {
        position: 'absolute',
        top: 24,
        left: 24,
        width: 18,
        height: 18,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: '#fff'
    },
    rowBody: { flex: 1, justifyContent: 'center', gap: 3 },
    rowTitle: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '700' },
    rowSummary: { fontSize: 11.5, color: TEXT_SECONDARY },
    rowTime: { fontSize: 10.5, color: TEXT_TERTIARY },
    deleteBtn: { padding: 8, alignSelf: 'center' },

    center: { paddingVertical: 40 },
    emptyCard: { alignItems: 'center', gap: 6, paddingVertical: 32 },
    emptyTitle: { fontSize: 14, color: '#fff', fontWeight: '700' },
    emptySub: { fontSize: 12, color: TEXT_SECONDARY }
})
