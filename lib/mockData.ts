/**
 * 🎨 Mock / placeholder data for NovaGlow AI.
 *
 * Provides high-fidelity creative templates, portrait assets, background overlays,
 * audio tracks, and maps standard structures to represent editing projects history.
 */

// ─── Standard Types (Maintains Template Compatibility) ────────────────────────

export type ItemStatus = 'active' | 'pending' | 'archived'
export type TaskState = 'todo' | 'in-progress' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export type ItemSummary = {
    id: string
    name: string
    owner: string
    status: ItemStatus
    completion: number
    health: number // Used as Viral Score (0-100)
    activeUsers: number // Used as Render FPS
    updatedAt: string
    summary: string
    thumbnail: string
    mediaType: 'image' | 'video'
    mediaUrl: string
}

export type TaskItem = {
    id: string
    itemId: string
    title: string
    state: TaskState
    priority: TaskPriority
    dueDate: string
}

export type ActivityItem = {
    id: string
    itemId: string
    kind: 'milestone' | 'comment' | 'alert' | 'review'
    title: string
    detail: string
    timeAgo: string
}

export type NotificationItem = {
    id: string
    title: string
    body: string
    timeAgo: string
    category: 'billing' | 'system' | 'product' | 'team'
    read: boolean
}

export type FaqItem = {
    id: string
    question: string
    answer: string
}

// ─── Custom Creative Types (For NovaGlow Editor) ──────────────────────────────────

export type AIStyleFilter = {
    id: string
    name: string
    tagline: string
    category: 'Glitch' | 'Glow' | 'Comic' | 'Retro' | 'Cyber' | 'Retouch' | 'Studio' | 'Fashion' | 'Warm' | 'Social' | 'Signature'
    sampleBefore: string
    sampleAfter: string
    intensity: number
    glowIntensity: number
    lipColor: string
    eyeSize: number
    overlayStyle: string
}

export type PresetBackdrop = {
    id: string
    name: string
    thumbnail: string
    image: string
    category: 'neon' | 'beach' | 'gradient' | 'studio'
}

export type AudioTrack = {
    id: string
    title: string
    artist: string
    duration: string
    genre: string
}

export type AIAvatarStyle = {
    id: string
    name: string
    thumbnail: string
    sampleUrl: string
}

export type AIStoryTemplate = {
    id: string
    name: string
    tagline: string
    layout: 'magazine' | 'retro' | 'neon' | 'influencer'
}

// ─── Demo User ────────────────────────────────────────────────────────────────

export const demoUser = {
    fullName: 'Praveen Nayak',
    email: 'praveen@novaglow.ai',
    role: 'Creator Pro',
    teamName: 'Studio Team',
    initials: 'PN',
}

// ─── Preset Assets Collections ───────────────────────────────────────────────

export const STOCK_PORTRAITS = [
    {
        id: 'model-1',
        name: 'Sofia (Glow & Beauty)',
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop',
    },
    {
        id: 'model-2',
        name: 'Alex (Cyberpunk & Glitch)',
        url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop',
    },
    {
        id: 'model-3',
        name: 'Kiara (Retro Film)',
        url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop',
    }
]

export const STOCK_VIDEOS = [
    {
        id: 'video-1',
        name: 'Glam Fashion Loop',
        url: 'https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c054f4d8237e073f39d2243d4d3856eb&profile_id=139&oauth2_token_id=57447761',
        poster: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop'
    },
    {
        id: 'video-2',
        name: 'Neon Cyber Dance',
        url: 'https://player.vimeo.com/external/403848771.sd.mp4?s=d0a27318721c5bc79ab921a97d9f7836371cb0a6&profile_id=139&oauth2_token_id=57447761',
        poster: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop'
    }
]

export const AI_STYLE_FILTERS: AIStyleFilter[] = [
    {
        id: 'filter-natural',
        name: 'Natural Glow',
        tagline: 'Flawless skin smoothing with subtle ambient brightness',
        category: 'Retouch',
        sampleBefore: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop',
        sampleAfter: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop',
        intensity: 40,
        glowIntensity: 30,
        lipColor: '#f43f5e',
        eyeSize: 1.04,
        overlayStyle: 'natural'
    },
    {
        id: 'filter-soft',
        name: 'Soft Beauty',
        tagline: 'Deep facial softening, skin blur, and pastel tones',
        category: 'Retouch',
        sampleBefore: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop',
        sampleAfter: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop',
        intensity: 85,
        glowIntensity: 50,
        lipColor: '#fdba74',
        eyeSize: 1.06,
        overlayStyle: 'soft'
    },
    {
        id: 'filter-studio',
        name: 'Studio Light',
        tagline: 'Bright clear exposure, highlight glows, and pink lips',
        category: 'Studio',
        sampleBefore: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop',
        sampleAfter: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop',
        intensity: 50,
        glowIntensity: 65,
        lipColor: '#ff007f',
        eyeSize: 1.08,
        overlayStyle: 'studio'
    },
    {
        id: 'filter-model',
        name: 'Fashion Model',
        tagline: 'High sharpness, cool shadow tones, and deep red highlights',
        category: 'Fashion',
        sampleBefore: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop',
        sampleAfter: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop',
        intensity: 30,
        glowIntensity: 20,
        lipColor: '#b91c1c',
        eyeSize: 1.02,
        overlayStyle: 'model'
    },
    {
        id: 'filter-golden',
        name: 'Golden Hour',
        tagline: 'Stunning warm amber highlights and sun-kissed lighting',
        category: 'Warm',
        sampleBefore: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop',
        sampleAfter: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop',
        intensity: 60,
        glowIntensity: 55,
        lipColor: '#f43f5e',
        eyeSize: 1.08,
        overlayStyle: 'golden'
    },
    {
        id: 'filter-influencer',
        name: 'Influencer',
        tagline: 'High color saturation, pink overlays, and soft contrast',
        category: 'Social',
        sampleBefore: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop',
        sampleAfter: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop',
        intensity: 70,
        glowIntensity: 45,
        lipColor: '#d946ef',
        eyeSize: 1.1,
        overlayStyle: 'influencer'
    },
    {
        id: 'filter-luxury',
        name: 'Luxury Portrait',
        tagline: 'Desaturated, stylized luxury matte tones with high contrast',
        category: 'Fashion',
        sampleBefore: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop',
        sampleAfter: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop',
        intensity: 45,
        glowIntensity: 35,
        lipColor: '#dc2626',
        eyeSize: 1.0,
        overlayStyle: 'luxury'
    },
    {
        id: 'filter-novaglow',
        name: 'NovaGlow Signature',
        tagline: 'Exclusive deep pink satin skin, bright focus and contrast',
        category: 'Signature',
        sampleBefore: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop',
        sampleAfter: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop',
        intensity: 75,
        glowIntensity: 60,
        lipColor: '#ff007f',
        eyeSize: 1.12,
        overlayStyle: 'glamx'
    }
]

export const PRESET_BACKDROPS: PresetBackdrop[] = [
    {
        id: 'bg-beach',
        name: 'Beach',
        thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=150&auto=format&fit=crop',
        image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600&auto=format&fit=crop',
        category: 'beach'
    },
    {
        id: 'bg-office',
        name: 'Office',
        thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=150&auto=format&fit=crop',
        image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600&auto=format&fit=crop',
        category: 'studio'
    },
    {
        id: 'bg-studio',
        name: 'Studio',
        thumbnail: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=150&auto=format&fit=crop',
        image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop',
        category: 'studio'
    },
    {
        id: 'bg-gradient',
        name: 'Gradient',
        thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=150&auto=format&fit=crop',
        image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop',
        category: 'gradient'
    },
    {
        id: 'bg-sunset',
        name: 'Sunset',
        thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=150&auto=format&fit=crop',
        image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=600&auto=format&fit=crop',
        category: 'beach'
    }
]

export const AUDIO_TRACKS: AudioTrack[] = [
    { id: 'audio-1', title: 'Cyber Synthwave 2099', artist: 'Hyperion', duration: '0:15', genre: 'Synthwave' },
    { id: 'audio-2', title: 'Lofi Glow Dreams', artist: 'Acoustic Chill', duration: '0:30', genre: 'Lofi Beat' },
    { id: 'audio-3', title: 'Pop Glam Runway', artist: 'Stella Sound', duration: '0:20', genre: 'Electro Pop' },
    { id: 'audio-4', title: 'Epic Cinematic Rise', artist: 'Hype Orchestra', duration: '0:15', genre: 'Orchestral' }
]

export const AI_AVATAR_STYLES: AIAvatarStyle[] = [
    {
        id: 'avatar-cyber',
        name: 'Cyberpunk 2099',
        thumbnail: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=150&auto=format&fit=crop',
        sampleUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop'
    },
    {
        id: 'avatar-anime',
        name: 'Anime Chibi',
        thumbnail: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=150&auto=format&fit=crop',
        sampleUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop'
    },
    {
        id: 'avatar-corporate',
        name: 'Corporate CEO',
        thumbnail: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?q=80&w=150&auto=format&fit=crop',
        sampleUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?q=80&w=600&auto=format&fit=crop'
    },
    {
        id: 'avatar-painting',
        name: 'Oil Painting',
        thumbnail: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?q=80&w=150&auto=format&fit=crop',
        sampleUrl: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?q=80&w=600&auto=format&fit=crop'
    }
]

export const AI_STORY_TEMPLATES: AIStoryTemplate[] = [
    { id: 'story-magazine', name: 'NovaGlow Cover', tagline: 'Vogue-style high-end editorial layout', layout: 'magazine' },
    { id: 'story-retro', name: 'Retro Filmstrip', tagline: 'Classic 35mm warm analogue borders', layout: 'retro' },
    { id: 'story-neon', name: 'Neon Splash', tagline: 'Electric glowing borders & outline highlights', layout: 'neon' },
    { id: 'story-influencer', name: 'Viral Splash', tagline: 'Modern sleek card overlays and stats', layout: 'influencer' }
]

// ─── Projects History Data (ItemSummary Compatibility) ─────────────────────────

export const itemSummaries: ItemSummary[] = [
    {
        id: 'proj-1',
        name: 'Cyberpunk Glow Selfie',
        owner: 'Praveen Nayak',
        status: 'active',
        completion: 100,
        health: 98, // Used as Viral Rating
        activeUsers: 60, // Used as Render FPS
        updatedAt: '2h ago',
        summary: 'Enhanced skin texture, applied bilateral smoothing, isolated neon purple backdrop overlay.',
        thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop'
    },
    {
        id: 'proj-2',
        name: 'Viral Glitch Walk Loop',
        owner: 'Praveen Nayak',
        status: 'pending',
        completion: 78,
        health: 92,
        activeUsers: 30,
        updatedAt: '45m ago',
        summary: 'Applied dynamic VHS distortion effects, synchronized synthwave soundtrack overlay.',
        thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop',
        mediaType: 'video',
        mediaUrl: 'https://player.vimeo.com/external/403848771.sd.mp4?s=d0a27318721c5bc79ab921a97d9f7836371cb0a6&profile_id=139&oauth2_token_id=57447761'
    },
    {
        id: 'proj-3',
        name: 'Sunset Dunes Beauty',
        owner: 'Praveen Nayak',
        status: 'archived',
        completion: 100,
        health: 89,
        activeUsers: 60,
        updatedAt: '5h ago',
        summary: 'Skin softened to 90%, lips tinted in coral red, customized background replaced with desert sunset scene.',
        thumbnail: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop'
    }
]

export const insightCards = [
    { id: 'metric-1', label: 'Total Creations', value: '12', delta: '+3 this week' },
    { id: 'metric-2', label: 'Viral Rating', value: '94%', delta: '+4.2% trend' },
    { id: 'metric-3', label: 'Rendering Quality', value: '4K Pro', delta: '60 FPS' },
]

// ─── Project-Specific Subtasks (TaskItem Compatibility) ───────────────────────

export const taskItems: TaskItem[] = [
    { id: 'task-1', itemId: 'proj-1', title: 'Apply lip color tint', state: 'done', priority: 'high', dueDate: 'Done' },
    { id: 'task-2', itemId: 'proj-1', title: 'Bilateral skin smooth', state: 'done', priority: 'high', dueDate: 'Done' },
    { id: 'task-3', itemId: 'proj-1', title: 'Remove studio background', state: 'done', priority: 'medium', dueDate: 'Done' },
    { id: 'task-4', itemId: 'proj-2', title: 'Sync glitch layer loop', state: 'in-progress', priority: 'high', dueDate: 'Today' },
    { id: 'task-5', itemId: 'proj-2', title: 'Attach synthwave music', state: 'todo', priority: 'medium', dueDate: 'Tomorrow' },
]

// ─── Render Logs Feed (ActivityItem Compatibility) ───────────────────────────

export const activityItems: ActivityItem[] = [
    {
        id: 'act-1',
        itemId: 'proj-1',
        kind: 'milestone',
        title: 'Video Encoding Completed',
        detail: 'Glitch overlay frames synthesized into 60fps loop successfully.',
        timeAgo: '22m ago',
    },
    {
        id: 'act-2',
        itemId: 'proj-1',
        kind: 'review',
        title: 'AI Skin Retouch Applied',
        detail: 'Bilateral blurring maps and lip tint coordinates mapped.',
        timeAgo: '1h ago',
    },
    {
        id: 'act-3',
        itemId: 'proj-2',
        kind: 'alert',
        title: 'Timeline clip cropped',
        detail: 'Cropped 30 seconds of video to 15 seconds timeline loop.',
        timeAgo: '2h ago',
    },
]

// ─── Notifications Alerts ─────────────────────────────────────────────────────

export const notificationItems: NotificationItem[] = [
    {
        id: 'notif-1',
        title: 'New viral template unlocked!',
        body: 'Cyber Glitch 2099 filter is now available for video edits.',
        timeAgo: '12m ago',
        category: 'product',
        read: false,
    },
    {
        id: 'notif-2',
        title: 'Influencer spotlight',
        body: 'Taylor used your NovaGlow Golden Hour layout for Reels!',
        timeAgo: '58m ago',
        category: 'team',
        read: false,
    },
    {
        id: 'notif-3',
        title: 'Scheduled cloud engine update',
        body: 'Gemini 2.0 rendering engine undergoes maintenance Saturday 02:00 UTC.',
        timeAgo: '3h ago',
        category: 'system',
        read: true,
    },
]

// ─── Support FAQ ──────────────────────────────────────────────────────────────

export const supportFaq: FaqItem[] = [
    {
        id: 'faq-1',
        question: 'How does the AI skin retouching work?',
        answer: 'NovaGlow AI runs client-side bilateral surface blur and edge-preserving filters. This detects skin gradients and smooths blemishes while keeping features like eyes, lips, and hair sharp.',
    },
    {
        id: 'faq-2',
        question: 'Can I upload custom backdrops for swapping?',
        answer: 'Yes! Inside the Background Tab in the Editor, tap the "+" button to choose any image from your gallery to use as a custom background layer.',
    },
    {
        id: 'faq-3',
        question: 'How do I synchronize music tracks?',
        answer: 'Choose any track from the Music Tab. It automatically synchronizes with the video looping timeline. Trimming the video will realign the backing track start point.',
    },
]

// ─── Utility Methods ──────────────────────────────────────────────────────────

export function getItemById(itemId?: string | string[]) {
    if (!itemId || Array.isArray(itemId)) return null
    return itemSummaries.find((item) => item.id === itemId) ?? null
}

export function getItemTasks(itemId?: string | string[]) {
    if (!itemId || Array.isArray(itemId)) return []
    return taskItems.filter((task) => task.itemId === itemId)
}

export function statusLabel(status: ItemStatus) {
    switch (status) {
        case 'active':
            return 'Completed'
        case 'pending':
            return 'Drafting'
        case 'archived':
            return 'Archived'
        default:
            return status
    }
}
