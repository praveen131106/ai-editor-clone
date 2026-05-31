import { useState, useEffect } from 'react'
import {
    View,
    StyleSheet,
    ScrollView,
    Image,
    Pressable,
    Dimensions,
    Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'

import { Text } from '@/components/ui/Text'
import { useMedia } from '@/contexts/MediaContext'
import { copyToAppStorage, validateFileUri } from '@/lib/mediaUtils'
import {
    ACCENT,
    BG,
    BORDER,
    SURFACE,
    SURFACE2,
    TEXT_PRIMARY,
    TEXT_SECONDARY,
    TEXT_TERTIARY,
} from '@/lib/theme'

const { width: SW } = Dimensions.get('window')

/**
 * Image Debug Screen
 * 
 * Shows raw URI, image dimensions, file existence,
 * and an actual image preview to diagnose rendering issues.
 */
export default function ImageDebugScreen() {
    const insets = useSafeAreaInsets()
    const { media, setMedia, debugLog } = useMedia()

    const [rawUri, setRawUri] = useState<string>('')
    const [copiedUri, setCopiedUri] = useState<string>('')
    const [fileInfo, setFileInfo] = useState<string>('Not checked')
    const [imageLoaded, setImageLoaded] = useState(false)
    const [imageError, setImageError] = useState<string>('')
    const [assetDetails, setAssetDetails] = useState<string>('None')
    const [rnImageLoaded, setRnImageLoaded] = useState(false)
    const [rnImageError, setRnImageError] = useState<string>('')

    // Pick an image and show ALL details
    const pickAndDebug = async () => {
        setImageLoaded(false)
        setImageError('')
        setRnImageLoaded(false)
        setRnImageError('')
        setFileInfo('Checking...')

        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!permission.granted) {
            Alert.alert('Permission Denied', 'Gallery access required.')
            return
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [9, 16],
            quality: 1,
        })

        console.log('[Debug] Full picker result:', JSON.stringify(result, null, 2))

        if (result.canceled) {
            setFileInfo('Cancelled')
            return
        }

        const asset = result.assets[0]
        const uri = asset.uri

        // Log everything
        console.log('[Debug] asset.uri:', uri)
        console.log('[Debug] asset.fileSize:', asset.fileSize)
        console.log('[Debug] asset.width:', asset.width)
        console.log('[Debug] asset.height:', asset.height)
        console.log('[Debug] asset.type:', asset.type)
        console.log('[Debug] asset.fileName:', asset.fileName)

        setRawUri(uri)
        setAssetDetails(JSON.stringify({
            uri: uri,
            width: asset.width,
            height: asset.height,
            fileSize: asset.fileSize,
            type: asset.type,
            fileName: asset.fileName,
        }, null, 2))

        // Validate original URI
        const originalValidation = await validateFileUri(uri)
        
        // Copy to app storage
        const stableUri = await copyToAppStorage(uri)
        setCopiedUri(stableUri)

        // Validate copied URI
        const copiedValidation = await validateFileUri(stableUri)

        setFileInfo(JSON.stringify({
            original: {
                exists: originalValidation.exists,
                size: originalValidation.size,
            },
            copied: {
                exists: copiedValidation.exists,
                size: copiedValidation.size,
                uri: stableUri,
            }
        }, null, 2))

        // Also set in MediaContext for editor testing
        setMedia({
            uri: stableUri,
            originalUri: uri,
            type: 'image',
            fileSize: asset.fileSize || copiedValidation.size || 0,
            width: asset.width || 0,
            height: asset.height || 0,
            initialTool: 'retouch',
            filterId: '',
            projectId: '',
        })
    }

    const goToEditor = () => {
        if (!media) {
            Alert.alert('No Image', 'Pick an image first.')
            return
        }
        router.push('/editor')
    }

    return (
        <View style={{ flex: 1, backgroundColor: BG }}>
            <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </Pressable>
                <Text style={s.headerTitle}>Image Debug</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
                {/* Pick Button */}
                <Pressable onPress={pickAndDebug} style={s.pickBtn}>
                    <Ionicons name="images-outline" size={20} color="#fff" />
                    <Text style={s.pickBtnText}>Pick Image & Debug</Text>
                </Pressable>

                {/* Raw URI */}
                <View style={s.section}>
                    <Text style={s.label}>Raw URI from ImagePicker:</Text>
                    <Text style={s.mono} selectable>{rawUri || 'None'}</Text>
                </View>

                {/* Copied URI */}
                <View style={s.section}>
                    <Text style={s.label}>Copied URI (app storage):</Text>
                    <Text style={s.mono} selectable>{copiedUri || 'None'}</Text>
                </View>

                {/* File Existence */}
                <View style={s.section}>
                    <Text style={s.label}>File Validation:</Text>
                    <Text style={s.mono}>{fileInfo}</Text>
                </View>

                {/* Asset Details */}
                <View style={s.section}>
                    <Text style={s.label}>Asset Details:</Text>
                    <Text style={s.mono}>{assetDetails}</Text>
                </View>

                {/* Preview with RN Image (from COPIED uri) */}
                {copiedUri ? (
                    <View style={s.section}>
                        <Text style={s.label}>React Native Image (copied URI):</Text>
                        <View style={s.previewBox}>
                            <Image
                                source={{ uri: copiedUri }}
                                style={s.previewImage}
                                resizeMode="contain"
                                onLoad={() => {
                                    console.log('[Debug] RN Image LOADED from copied URI')
                                    setRnImageLoaded(true)
                                }}
                                onError={(e) => {
                                    const err = e.nativeEvent.error || 'Unknown error'
                                    console.error('[Debug] RN Image ERROR from copied URI:', err)
                                    setRnImageError(String(err))
                                }}
                            />
                        </View>
                        <Text style={[s.status, { color: rnImageLoaded ? '#22c55e' : '#ef4444' }]}>
                            {rnImageLoaded ? '✅ IMAGE LOADED' : rnImageError ? `❌ ERROR: ${rnImageError}` : '⏳ Loading...'}
                        </Text>
                    </View>
                ) : null}

                {/* Preview with RN Image (from RAW uri) */}
                {rawUri ? (
                    <View style={s.section}>
                        <Text style={s.label}>React Native Image (raw URI):</Text>
                        <View style={s.previewBox}>
                            <Image
                                source={{ uri: rawUri }}
                                style={s.previewImage}
                                resizeMode="contain"
                                onLoad={() => {
                                    console.log('[Debug] RN Image LOADED from raw URI')
                                    setImageLoaded(true)
                                }}
                                onError={(e) => {
                                    const err = e.nativeEvent.error || 'Unknown error'
                                    console.error('[Debug] RN Image ERROR from raw URI:', err)
                                    setImageError(String(err))
                                }}
                            />
                        </View>
                        <Text style={[s.status, { color: imageLoaded ? '#22c55e' : '#ef4444' }]}>
                            {imageLoaded ? '✅ IMAGE LOADED' : imageError ? `❌ ERROR: ${imageError}` : '⏳ Loading...'}
                        </Text>
                    </View>
                ) : null}

                {/* Navigate to Editor */}
                <Pressable onPress={goToEditor} style={[s.pickBtn, { backgroundColor: '#22c55e', marginTop: 8 }]}>
                    <Ionicons name="create-outline" size={20} color="#fff" />
                    <Text style={s.pickBtnText}>Open Editor with This Image</Text>
                </Pressable>

                {/* Context Debug Log */}
                <View style={s.section}>
                    <Text style={s.label}>MediaContext Debug Log:</Text>
                    {debugLog.length === 0 ? (
                        <Text style={s.mono}>No entries yet</Text>
                    ) : (
                        debugLog.map((entry, i) => (
                            <Text key={i} style={s.mono}>{entry}</Text>
                        ))
                    )}
                </View>

                {/* Current Context State */}
                <View style={s.section}>
                    <Text style={s.label}>Current MediaContext State:</Text>
                    <Text style={s.mono}>
                        {media ? JSON.stringify(media, null, 2) : 'null (no media set)'}
                    </Text>
                </View>
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
    headerTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center' },
    body: { padding: 16, gap: 12, paddingBottom: 60 },
    pickBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    pickBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    section: {
        backgroundColor: SURFACE,
        borderRadius: 12,
        padding: 12,
        gap: 6,
        borderWidth: 1,
        borderColor: BORDER,
    },
    label: { fontSize: 12, fontWeight: '800', color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5 },
    mono: { fontSize: 11, fontFamily: 'monospace', color: TEXT_SECONDARY, lineHeight: 16 },
    status: { fontSize: 14, fontWeight: '900', textAlign: 'center', marginTop: 4 },
    previewBox: {
        width: '100%',
        height: 300,
        backgroundColor: '#000',
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: BORDER,
    },
    previewImage: { width: '100%', height: '100%' },
})
