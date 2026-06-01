const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ProcessImageBody = {
    action: 'remove-bg' | 'generate-avatar' | 'smart-healing' | 'generate-backdrop'
    mediaBase64?: string
    mediaUrl?: string
    mimeType?: string
    additionalParams?: Record<string, any>
}

function json(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

function env(name: string) {
    return Deno.env.get(name) || ''
}

function base64ToBytes(base64: string) {
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
    return bytes
}

function bytesToBase64(bytes: Uint8Array) {
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    return btoa(binary)
}

async function readImageBytes(body: ProcessImageBody) {
    if (body.mediaBase64) {
        return {
            bytes: base64ToBytes(body.mediaBase64),
            mimeType: body.mimeType || 'image/jpeg',
        }
    }

    if (body.mediaUrl?.startsWith('http')) {
        const res = await fetch(body.mediaUrl)
        if (!res.ok) throw new Error(`Could not fetch source image: ${res.status}`)
        return {
            bytes: new Uint8Array(await res.arrayBuffer()),
            mimeType: res.headers.get('content-type') || body.mimeType || 'image/jpeg',
        }
    }

    throw new Error('Upload an image before running this AI action.')
}

async function removeWithRemoveBg(imageBase64: string) {
    const key = env('REMOVE_BG_API_KEY')
    if (!key) throw new Error('REMOVE_BG_API_KEY is not configured.')

    const form = new FormData()
    form.append('image_file_b64', imageBase64)
    form.append('size', 'auto')
    form.append('format', 'png')

    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': key },
        body: form,
    })

    if (!res.ok) throw new Error(`Remove.bg failed: ${await res.text()}`)
    return {
        provider: 'remove.bg',
        bytes: new Uint8Array(await res.arrayBuffer()),
        mimeType: 'image/png',
    }
}

async function removeWithClipdrop(imageBytes: Uint8Array, mimeType: string) {
    const key = env('CLIPDROP_API_KEY')
    if (!key) throw new Error('CLIPDROP_API_KEY is not configured.')

    const form = new FormData()
    form.append('image_file', new Blob([imageBytes], { type: mimeType }), 'source.jpg')

    const res = await fetch('https://clipdrop-api.co/remove-background/v1', {
        method: 'POST',
        headers: { 'x-api-key': key },
        body: form,
    })

    if (!res.ok) throw new Error(`Clipdrop failed: ${await res.text()}`)
    return {
        provider: 'clipdrop',
        bytes: new Uint8Array(await res.arrayBuffer()),
        mimeType: 'image/png',
    }
}

async function removeWithHuggingFace(imageBytes: Uint8Array, mimeType: string) {
    const key = env('HUGGINGFACE_API_KEY')
    if (!key) throw new Error('HUGGINGFACE_API_KEY is not configured.')

    const model = env('HUGGINGFACE_SEGMENTATION_MODEL') || 'briaai/RMBG-1.4'
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': mimeType,
            Accept: 'image/png',
        },
        body: imageBytes,
    })

    if (!res.ok) throw new Error(`Hugging Face segmentation failed: ${await res.text()}`)
    return {
        provider: `huggingface:${model}`,
        bytes: new Uint8Array(await res.arrayBuffer()),
        mimeType: res.headers.get('content-type') || 'image/png',
    }
}

async function removeBackground(body: ProcessImageBody) {
    const source = await readImageBytes(body)
    const sourceBase64 = body.mediaBase64 || bytesToBase64(source.bytes)
    const errors: string[] = []

    for (const provider of [
        () => removeWithRemoveBg(sourceBase64),
        () => removeWithClipdrop(source.bytes, source.mimeType),
        () => removeWithHuggingFace(source.bytes, source.mimeType),
    ]) {
        try {
            return await provider()
        } catch (err: any) {
            errors.push(err.message || String(err))
        }
    }

    throw new Error(`No background removal provider succeeded. ${errors.join(' | ')}`)
}

function avatarPrompt(style: string) {
    const styleSpec: Record<string, string> = {
        professional: 'premium professional headshot, sharp contrast, neutral colors, clean executive portrait lighting',
        anime: 'anime avatar, bright saturated colors, clean outline effect, expressive polished character art',
        cyberpunk: 'cyberpunk avatar, purple and blue neon glow, futuristic city light, high-tech editorial portrait',
        influencer: 'social influencer avatar, pink glow, soft skin, glossy beauty lighting, friendly creator aesthetic',
        fashion: 'fashion magazine avatar, matte tones, editorial styling, luxury cover portrait, refined dramatic lighting',
    }

    return styleSpec[style] || styleSpec.professional
}

async function optimizeAvatarPrompt(style: string) {
    const key = env('GEMINI_API_KEY')
    if (!key) return `Create a ${avatarPrompt(style)} from the uploaded selfie while preserving identity.`

    const model = env('GEMINI_PROMPT_MODEL') || 'gemini-2.5-flash'
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: [
                        'Write one concise production prompt for an AI image model.',
                        'Goal: transform the uploaded selfie into an avatar while preserving facial identity, age, and pose.',
                        `Style: ${avatarPrompt(style)}.`,
                        'No watermark, no text, no extra people. Return only the prompt.',
                    ].join('\n'),
                }],
            }],
        }),
    })

    if (!res.ok) throw new Error(`Gemini prompt optimization failed: ${await res.text()}`)
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join(' ').trim()
        || `Create a ${avatarPrompt(style)} from the uploaded selfie while preserving identity.`
}

async function generateAvatar(body: ProcessImageBody) {
    const key = env('GEMINI_API_KEY')
    if (!key) throw new Error('GEMINI_API_KEY is not configured.')

    const source = await readImageBytes(body)
    const style = body.additionalParams?.style || 'professional'
    const optimizedPrompt = await optimizeAvatarPrompt(style)
    const model = env('GEMINI_IMAGE_MODEL') || 'gemini-2.0-flash-preview-image-generation'

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: optimizedPrompt },
                    { inlineData: { mimeType: source.mimeType, data: bytesToBase64(source.bytes) } },
                ],
            }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
    })

    if (!res.ok) throw new Error(`Gemini avatar generation failed: ${await res.text()}`)
    const data = await res.json()
    const parts = data?.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find((p: any) => p.inlineData?.data || p.inline_data?.data)
    const inlineData = imagePart?.inlineData || imagePart?.inline_data
    if (!inlineData?.data) throw new Error('Gemini did not return an avatar image.')

    return {
        provider: `gemini:${model}`,
        bytes: base64ToBytes(inlineData.data),
        mimeType: inlineData.mimeType || inlineData.mime_type || 'image/png',
        optimizedPrompt,
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const body = await req.json() as ProcessImageBody
        
        if (!body.action) return json({ success: false, error: 'Missing action.' }, 400)

        if (body.action === 'remove-bg') {
            const result = await removeBackground(body)
            return json({
                success: true,
                action: body.action,
                provider: result.provider,
                processedBase64: bytesToBase64(result.bytes),
                mimeType: result.mimeType,
                timestamp: new Date().toISOString(),
            })
        }

        if (body.action === 'generate-avatar') {
            const result = await generateAvatar(body)
            return json({
                success: true,
                action: body.action,
                provider: result.provider,
                processedBase64: bytesToBase64(result.bytes),
                mimeType: result.mimeType,
                optimizedPrompt: result.optimizedPrompt,
                timestamp: new Date().toISOString(),
            })
        }

        return json({ success: false, error: `${body.action} is not implemented as a live service yet.` }, 501)
    } catch (e: any) {
        console.error('[process-image] Error:', e.message, e.stack)
        return json({ success: false, error: e.message || 'Internal Server Error' }, 500)
    }
})
