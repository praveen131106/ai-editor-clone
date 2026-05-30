import { useMemo, useState } from 'react'
import {
    View,
    ScrollView,
    StyleSheet,
    Pressable,
    Image,
    Dimensions
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import TextInputField from '@/components/ui/TextInputField'
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
import { AI_STYLE_FILTERS, type AIStyleFilter } from '@/lib/mockData'

const { width: SW } = Dimensions.get('window')

type CategoryType = 'All' | 'Glitch' | 'Glow' | 'Comic' | 'Retro' | 'Cyber'

const CATEGORIES: CategoryType[] = ['All', 'Glitch', 'Glow', 'Comic', 'Retro', 'Cyber']

export default function ExploreScreen() {
    const insets = useSafeAreaInsets()
    const [query, setQuery] = useState('')
    const [activeCategory, setActiveCategory] = useState<CategoryType>('All')

    const filteredFilters = useMemo(() => {
        const byCategory = activeCategory === 'All'
            ? AI_STYLE_FILTERS
            : AI_STYLE_FILTERS.filter((f) => f.category === activeCategory)

        if (!query.trim()) return byCategory

        const q = query.trim().toLowerCase()
        return byCategory.filter((f) => {
            return (
                f.name.toLowerCase().includes(q)
                || f.tagline.toLowerCase().includes(q)
                || f.category.toLowerCase().includes(q)
            )
        })
    }, [activeCategory, query])

    const startFilterEdit = (filter: AIStyleFilter) => {
        router.push({
            pathname: '/editor',
            params: {
                mediaType: 'image',
                mediaUrl: filter.sampleBefore,
                filterId: filter.id,
                initialTool: 'filters'
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
                <Text style={s.title}>AI Styles</Text>
                <Text style={s.subtitle}>Explore viral styles and trending effects.</Text>
            </View>

            {/* Search input with custom cyberpunk details */}
            <View style={s.searchWrap}>
                <Ionicons name="search" size={18} color={TEXT_TERTIARY} style={s.searchIcon} />
                <TextInputField
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search styles (e.g. glitch, comic...)"
                    style={s.searchInput}
                />
            </View>

            {/* Categories horizontal list */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
                {CATEGORIES.map((cat) => {
                    const active = cat === activeCategory
                    return (
                        <Pressable
                            key={cat}
                            onPress={() => setActiveCategory(cat)}
                            style={[s.catChip, active && s.catChipActive]}
                        >
                            <Text style={[s.catText, active && s.catTextActive]}>{cat}</Text>
                        </Pressable>
                    )
                })}
            </ScrollView>

            {/* Filters catalog grid */}
            {filteredFilters.length === 0 ? (
                <Card style={s.emptyCard}>
                    <Ionicons name="sparkles-outline" size={32} color={TEXT_TERTIARY} />
                    <Text style={s.emptyTitle}>No matching filters</Text>
                    <Text style={s.emptySub}>Try another search query or switch categories.</Text>
                </Card>
            ) : (
                <View style={s.gridContainer}>
                    {filteredFilters.map((filter) => (
                        <Pressable
                            key={filter.id}
                            onPress={() => startFilterEdit(filter)}
                            style={({ pressed }) => [s.filterCard, pressed && { opacity: 0.9 }]}
                        >
                            <Image source={{ uri: filter.sampleAfter }} style={s.filterImage} />
                            <View style={s.gradientOverlay} />
                            
                            <View style={s.cardBadge}>
                                <Text style={s.cardBadgeText}>{filter.category}</Text>
                            </View>

                            <View style={s.cardContent}>
                                <Text style={s.cardName}>{filter.name}</Text>
                                <Text style={s.cardTagline} numberOfLines={1}>{filter.tagline}</Text>
                            </View>

                            <View style={s.useBtn}>
                                <Ionicons name="play" size={14} color="#fff" />
                                <Text style={s.useBtnText}>USE</Text>
                            </View>
                        </Pressable>
                    ))}
                </View>
            )}
        </ScrollView>
    )
}

const s = StyleSheet.create({
    container: { paddingHorizontal: 20, gap: 14 },
    header: { gap: 4, marginBottom: 2 },
    title: { fontSize: 24, fontWeight: '900', color: TEXT_PRIMARY, letterSpacing: -0.5 },
    subtitle: { fontSize: 13, color: TEXT_SECONDARY },
    
    // Search wrap
    searchWrap: { position: 'relative', zIndex: 1 },
    searchIcon: { position: 'absolute', left: 14, top: 15, zIndex: 10 },
    searchInput: { paddingLeft: 40, height: 48, backgroundColor: SURFACE, borderRadius: 12, borderWidth: 1, borderColor: BORDER },

    // Category Tags
    categoryRow: { gap: 8, paddingVertical: 4 },
    catChip: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: SURFACE,
    },
    catChipActive: {
        backgroundColor: ACCENT,
        borderColor: ACCENT,
    },
    catText: { fontSize: 12.5, color: TEXT_SECONDARY, fontWeight: '700' },
    catTextActive: { color: '#fff' },

    // Filters Grid
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
    filterCard: {
        width: (SW - 52) / 2,
        height: SW * 0.65,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        backgroundColor: SURFACE,
        position: 'relative'
    },
    filterImage: { width: '100%', height: '100%' },
    gradientOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        // Simple dark bottom block simulation
    },
    cardBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.15)'
    },
    cardBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', textTransform: 'uppercase' },
    cardContent: {
        position: 'absolute',
        bottom: 46,
        left: 12,
        right: 12,
        gap: 2
    },
    cardName: { fontSize: 13.5, fontWeight: '800', color: '#fff' },
    cardTagline: { fontSize: 10, color: TEXT_SECONDARY },
    
    useBtn: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4
    },
    useBtnText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },

    emptyCard: { alignItems: 'center', paddingVertical: 32, gap: 6 },
    emptyTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
    emptySub: { fontSize: 12, color: TEXT_SECONDARY, textAlign: 'center' },
})
