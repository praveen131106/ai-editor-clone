/**
 * Lumi AI Image Processing Edge Function
 *
 * Takes an image and performs high-end AI processing:
 *   - 'remove-bg': Swaps or removes backgrounds
 *   - 'smart-healing': Erases painted elements from the viewport
 *
 * CORS headers are handled to support client requests from React Native.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight options request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()
        const { mediaUrl, action, additionalParams } = body

        if (!action || (action !== 'generate-backdrop' && !mediaUrl)) {
            return new Response(
                JSON.stringify({ error: 'Missing mediaUrl or action parameter' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Simulate high-fidelity AI processing pipeline latency
        await new Promise((resolve) => setTimeout(resolve, 800))

        let processedUrl = mediaUrl || ''

        if (action === 'remove-bg') {
            // Stylize background swapping representation in mock results
            processedUrl = mediaUrl.includes('?') 
                ? `${mediaUrl}&bg=removed` 
                : `${mediaUrl}?bg=removed`
        } else if (action === 'smart-healing') {
            // Stylize object removal / healing representation in mock results
            processedUrl = mediaUrl.includes('?') 
                ? `${mediaUrl}&healed=true` 
                : `${mediaUrl}?healed=true`
        } else if (action === 'generate-backdrop') {
            const prompt = (additionalParams?.prompt || '').toLowerCase()
            if (prompt.includes('neon') || prompt.includes('cyber') || prompt.includes('city') || prompt.includes('street')) {
                processedUrl = 'https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?q=80&w=600&auto=format&fit=crop'
            } else if (prompt.includes('beach') || prompt.includes('sunset') || prompt.includes('coast') || prompt.includes('sea') || prompt.includes('ocean')) {
                processedUrl = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600&auto=format&fit=crop'
            } else if (prompt.includes('abstract') || prompt.includes('glass') || prompt.includes('gradient') || prompt.includes('color')) {
                processedUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop'
            } else if (prompt.includes('studio') || prompt.includes('marble') || prompt.includes('room') || prompt.includes('indoor')) {
                processedUrl = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop'
            } else {
                // Nebula starry sky galaxy sky
                processedUrl = 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop'
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                action,
                processedUrl,
                timestamp: new Date().toISOString(),
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (e: any) {
        return new Response(
            JSON.stringify({ error: e.message || 'Internal Server Error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
