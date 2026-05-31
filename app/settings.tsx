import { useState, useEffect } from 'react'
import { View, ScrollView, StyleSheet, Pressable, Switch, DeviceEventEmitter, Alert } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import SettingsRow from '@/components/ui/SettingsRow'
import { BG, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY, ACCENT, SURFACE, SURFACE2 } from '@/lib/theme'

const SETTINGS_KEY = 'app_settings'

async function loadSettings() {
    try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

async function saveSettings(settings: { pushEnabled: boolean; weeklyDigest: boolean; compactMode: boolean }) {
    try {
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch { /* non-critical */ }
}

export default function SettingsScreen() {
    const insets = useSafeAreaInsets()

    const [pushEnabled, setPushEnabled] = useState(true)
    const [weeklyDigest, setWeeklyDigest] = useState(true)
    const [compactMode, setCompactMode] = useState(false)
    const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('dark')

    useEffect(() => {
        AsyncStorage.getItem('novaglow_theme').then((val) => {
            if (val === 'light' || val === 'dark' || val === 'system') {
                setThemeMode(val as any)
            }
        })
    }, [])

    const handleThemeChange = async (mode: 'light' | 'dark' | 'system') => {
        setThemeMode(mode)
        await AsyncStorage.setItem('novaglow_theme', mode)
        DeviceEventEmitter.emit('novaglow_theme_changed', mode)
    }

    const handleClearCache = async () => {
        const { clearAllMediaCache } = require('@/lib/mediaUtils')
        const count = await clearAllMediaCache()
        Alert.alert('Cache Cleared', `Successfully wiped out all local media cache. ${count} cached files removed.`)
    }

    const handleLogout = () => {
        Alert.alert(
            'Log out',
            'Are you sure you want to sign out of your account?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log out',
                    style: 'destructive',
                    onPress: async () => {
                        console.log('[Settings] Log out session triggered.')
                        DeviceEventEmitter.emit('__local_sign_out__')
                        router.replace('/(auth)/login')
                    }
                }
            ]
        )
    }

    useEffect(() => {
        loadSettings().then((saved) => {
            if (!saved) return
            if (saved.pushEnabled !== undefined) setPushEnabled(saved.pushEnabled)
            if (saved.weeklyDigest !== undefined) setWeeklyDigest(saved.weeklyDigest)
            if (saved.compactMode !== undefined) setCompactMode(saved.compactMode)
        })
    }, [])

    function handleToggle(key: 'pushEnabled' | 'weeklyDigest' | 'compactMode', value: boolean) {
        const next = { pushEnabled, weeklyDigest, compactMode, [key]: value }
        if (key === 'pushEnabled') setPushEnabled(value)
        if (key === 'weeklyDigest') setWeeklyDigest(value)
        if (key === 'compactMode') setCompactMode(value)
        saveSettings(next)
    }

    return (
        <View style={{ flex: 1, backgroundColor: BG }}>
            <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.6)" />
                </Pressable>
                <Text style={s.headerTitle}>Settings</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 28 }]}
                showsVerticalScrollIndicator={false}
            >
                <Text style={s.sectionTitle}>Preferences</Text>
                <Card compact style={s.groupCard}>
                    <SwitchRow
                        label="Push notifications"
                        subtitle="Alerts for system and team events"
                        value={pushEnabled}
                        onValueChange={(v) => handleToggle('pushEnabled', v)}
                    />
                    <SwitchRow
                        label="Weekly digest"
                        subtitle="Receive a Monday summary email"
                        value={weeklyDigest}
                        onValueChange={(v) => handleToggle('weeklyDigest', v)}
                    />
                    <SwitchRow
                        label="Compact mode"
                        subtitle="Denser list rows for productivity"
                        value={compactMode}
                        onValueChange={(v) => handleToggle('compactMode', v)}
                        last
                    />
                </Card>

                <Text style={s.sectionTitle}>Appearance</Text>
                <Card compact style={s.groupCard}>
                    <View style={s.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.rowLabel}>Theme Selection</Text>
                            <Text style={s.rowSub}>Select application visual theme archetype</Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 14 }}>
                        {['light', 'dark', 'system'].map((t) => (
                            <Pressable
                                key={t}
                                onPress={() => handleThemeChange(t as any)}
                                style={[
                                    s.themeButton,
                                    themeMode === t && { backgroundColor: ACCENT, borderColor: ACCENT }
                                ]}
                            >
                                <Text style={[s.themeButtonText, themeMode === t && { color: '#fff', fontWeight: '800' }]}>
                                    {t.toUpperCase()}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </Card>

                <Text style={s.sectionTitle}>System Operations</Text>
                <Card compact style={s.groupCard}>
                    <SettingsRow
                        label="Clear Application Cache"
                        icon="trash-outline"
                        onPress={handleClearCache}
                    />
                    <SettingsRow
                        label="Log Out Session"
                        icon="log-out-outline"
                        onPress={handleLogout}
                        last
                    />
                </Card>

                <Text style={s.sectionTitle}>Legal</Text>
                <Card compact style={s.groupCard}>
                    <SettingsRow label="Privacy Policy" icon="document-text-outline" onPress={() => router.push('/privacy')} />
                    <SettingsRow label="Terms of Service" icon="shield-checkmark-outline" onPress={() => router.push('/terms')} last={true} />
                </Card>

                <View style={{ alignItems: 'center', marginTop: 24, gap: 4 }}>
                    <Text style={{ fontSize: 11, color: TEXT_TERTIARY }}>NovaGlow AI Studio · v1.0.0 (Contest Build)</Text>
                    <Text style={{ fontSize: 9.5, color: TEXT_TERTIARY }}>Offline guest-ready verified sandboxed environment</Text>
                </View>
            </ScrollView>
        </View>
    )
}

function SwitchRow({
    label,
    subtitle,
    value,
    onValueChange,
    last,
}: {
    label: string
    subtitle: string
    value: boolean
    onValueChange: (next: boolean) => void
    last?: boolean
}) {
    return (
        <View style={[s.row, !last && s.rowDivider]}>
            <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{label}</Text>
                <Text style={s.rowSub}>{subtitle}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: `${ACCENT}66` }}
                thumbColor={value ? ACCENT : '#f4f4f5'}
            />
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
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    headerTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
    body: { padding: 20, gap: 10 },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: TEXT_TERTIARY,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginTop: 6,
    },
    groupCard: { padding: 0, overflow: 'hidden' },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    rowDivider: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: BORDER,
    },
    rowLabel: { color: TEXT_PRIMARY, fontSize: 14.5, fontWeight: '600' },
    rowSub: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
    themeButton: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: SURFACE,
    },
    themeButtonText: {
        fontSize: 11.5,
        color: TEXT_SECONDARY,
        fontWeight: '600',
    },
})
