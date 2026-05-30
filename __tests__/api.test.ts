import { removeBackgroundAPI, smartHealingAPI, aiGenerateBackdropAPI } from '@/lib/api'

// Mock Supabase to ensure we test fallback sandboxes securely and isolate unit tests
jest.mock('@/lib/supabase', () => ({
    supabase: {
        functions: {
            invoke: jest.fn().mockResolvedValue({ data: { processedUrl: 'https://mocked-supabase-url.com/asset.jpg' }, error: null })
        }
    },
    isSupabaseEnabled: false // Force local offline sandbox to cover mock generators cleanly
}))

describe('Lumi AI API Facade Middleware', () => {
    
    describe('removeBackgroundAPI', () => {
        it('resolves processed image URL with bg tag', async () => {
            const result = await removeBackgroundAPI('https://example.com/photo.jpg')
            expect(result).toBe('https://example.com/photo.jpg?bg=removed')
        })
        
        it('appends correct URL search param if query already exists', async () => {
            const result = await removeBackgroundAPI('https://example.com/photo.jpg?size=large')
            expect(result).toBe('https://example.com/photo.jpg?size=large&bg=removed')
        })
    })

    describe('smartHealingAPI', () => {
        it('resolves healed representation with true tag', async () => {
            const points = [{ x: 10, y: 20 }, { x: 30, y: 40 }]
            const result = await smartHealingAPI('https://example.com/photo.jpg', points)
            expect(result).toBe('https://example.com/photo.jpg?healed=true')
        })
    })

    describe('aiGenerateBackdropAPI Prompts Keywords Resolution', () => {
        it('resolves cyberpunk backdrop image for neon prompts', async () => {
            const result = await aiGenerateBackdropAPI('a neon cyberpunk street at night')
            expect(result).toBe('https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?q=80&w=600&auto=format&fit=crop')
        })

        it('resolves beach sunset backdrop image for ocean prompts', async () => {
            const result = await aiGenerateBackdropAPI('sunny beach at sunset and tropical ocean waves')
            expect(result).toBe('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600&auto=format&fit=crop')
        })

        it('resolves abstract glassmorphic backdrop for gradient prompts', async () => {
            const result = await aiGenerateBackdropAPI('frosted glass gradient color background')
            expect(result).toBe('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop')
        })

        it('resolves luxury studio backdrop for marble room prompts', async () => {
            const result = await aiGenerateBackdropAPI('modern indoor luxury studio room with marble floors')
            expect(result).toBe('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop')
        })

        it('resolves nebula galaxy background for unmatched query prompts', async () => {
            const result = await aiGenerateBackdropAPI('something completely random like mountains or forests')
            expect(result).toBe('https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop')
        })
    })
})
