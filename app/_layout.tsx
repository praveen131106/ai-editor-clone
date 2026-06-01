import React, { useEffect, useState } from 'react'
import { View, StyleSheet, Platform, DeviceEventEmitter, Linking, useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Stack, useNavigationContainerRef, usePathname, router } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import * as Sentry from '@sentry/react-native'

const routingInstrumentation = Sentry.reactNavigationIntegration()

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  environment: __DEV__ ? 'development' : 'production',
  enabled: !__DEV__ && !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  integrations: [routingInstrumentation],
  tracesSampleRate: 0,
})

import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter'
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native'
import { PostHogProvider } from 'posthog-react-native'
import { I18nextProvider } from 'react-i18next'

import { supabase, isSupabaseEnabled } from '@/lib/supabase'
import { posthog, isPostHogEnabled, identify, resetIdentity, track } from '@/lib/analytics'
import { configureRevenueCat, loginRevenueCat, logoutRevenueCat } from '@/lib/purchases'
import { SubscriptionProvider } from '@/contexts/SubscriptionContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { MediaProvider } from '@/contexts/MediaContext'
import i18n, { initI18n } from '@/lib/i18n'
import OfflineBanner from '@/components/OfflineBanner'
import OfflineOverlay from '@/components/OfflineOverlay'
import { Text } from '@/components/ui/Text'
import { BG } from '@/lib/theme'
import { triggerLocalNotification } from '@/lib/notifications'

// ─── Error boundary ───────────────────────────────────────────────────────────
// React requires a class component to catch render errors — hooks cannot do this.

function ErrorFallback() {
  return (
    <View style={eb.container}>
      <Text style={eb.title}>Something went wrong</Text>
      <Text style={eb.subtitle}>Please close and reopen the app.</Text>
    </View>
  )
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info)
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
  }

  render() {
    if (this.state.hasError) return <ErrorFallback />
    return this.props.children
  }
}

const eb = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', lineHeight: 22 },
})

// ─── Theme ────────────────────────────────────────────────────────────────────

const customDarkTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: BG },
}

const customLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#ffffff',
    card: '#f4f4f5',
    text: '#09090b',
    border: 'rgba(9,9,11,0.08)',
  },
}

// ─── Conditional PostHog provider ─────────────────────────────────────────────
// PostHogProvider requires a valid client instance. When the API key is missing
// we skip the provider entirely so no errors are thrown.

function MaybePostHogProvider({ children }: { children: React.ReactNode }) {
  if (isPostHogEnabled && posthog) {
    return <PostHogProvider client={posthog}>{children}</PostHogProvider>
  }
  return <>{children}</>
}

// ─── Screen tracking ─────────────────────────────────────────────────────────
// Rendered inside the navigator so usePathname has routing context.

function ScreenTracker() {
  const pathname = usePathname()
  useEffect(() => {
    track('screen_viewed', { screen: pathname })
  }, [pathname])
  return null
}

import { useToast } from '@/contexts/ToastContext'

function NovaGlowBootstrap({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast()

  useEffect(() => {
    // 1. Listen to reactive notification alerts
    const notifSub = DeviceEventEmitter.addListener('novaglow_new_notification', (notif: any) => {
      if (notif) {
        showToast(notif.title, 'success')
      }
    })

    // 2. Deep-linking incoming link listener
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url
      if (!url) return
      
      
      if (url.includes('promo')) {
        showToast('Premium Filter Unlocked! 🚀', 'success')
        triggerLocalNotification('Promo Unlocked!', 'Welcome back to NovaGlow AI! Premium features have been unlocked via link.')
      } else if (url.includes('tool=')) {
        const match = url.match(/tool=([^&]+)/)
        const tool = match ? match[1] : 'beauty'
        showToast(`Launching ${tool.toUpperCase()} studio...`, 'info')
        router.push({
          pathname: '/editor',
          params: { initialTool: tool }
        })
      }
    }

    const sub = Linking.addEventListener('url', handleDeepLink)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url })
    })

    return () => {
      sub.remove()
      notifSub.remove()
    }
  }, [showToast])

  return <>{children}</>
}

// ─── Root layout ──────────────────────────────────────────────────────────────

function RootLayout() {
  const navigationRef = useNavigationContainerRef()
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  })

  // null = still checking; true/false = auth state known
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null)
  // null = loading; false = not completed; true = completed
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null)
  const [i18nReady, setI18nReady] = useState(false)
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('dark')
  const systemScheme = useColorScheme()

  useEffect(() => {
    AsyncStorage.getItem('novaglow_theme').then((val) => {
      if (val === 'light' || val === 'dark' || val === 'system') {
        setThemeMode(val as any)
      }
    })

    const themeSub = DeviceEventEmitter.addListener('novaglow_theme_changed', (newTheme) => {
      setThemeMode(newTheme)
    })
    return () => themeSub.remove()
  }, [])

  const activeTheme = themeMode === 'system' 
    ? (systemScheme === 'light' ? customLightTheme : customDarkTheme)
    : (themeMode === 'light' ? customLightTheme : customDarkTheme)

  useEffect(() => {
    initI18n().then(() => setI18nReady(true))
  }, [])

  useEffect(() => {
    if (navigationRef.current) {
      routingInstrumentation.registerNavigationContainer(navigationRef)
    }
  }, [navigationRef])

  useEffect(() => {
    // Configure RevenueCat once at startup, before any user is known
    configureRevenueCat()

    // Clear local guest session on fresh startup to always display landing/splash page first
    AsyncStorage.removeItem('novaglow_local_session').then(() => {
        if (!isSupabaseEnabled) {
          // No credentials — stay on landing page, no errors thrown
          setIsAuthed(false)
          return
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
          setIsAuthed(!!session)
          if (session?.user) {
            setOnboardingCompleted(session.user.user_metadata?.onboarding_completed === true)
            loginRevenueCat(session.user.id)
            identify(
              session.user.id,
              session.user.email ? { email: session.user.email } : undefined
            )
          } else {
            setOnboardingCompleted(null)
          }
        }).catch(() => {
          console.warn('[Auth] Could not reach Supabase — defaulting to signed-out state.')
          setIsAuthed(false)
        })
    }).catch(() => {
      setIsAuthed(false)
    })

    // 2. Listen to Supabase auth state changes if enabled
    let subscription: any = null
    if (isSupabaseEnabled) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setIsAuthed(true)
          setOnboardingCompleted(session.user.user_metadata?.onboarding_completed === true)
          loginRevenueCat(session.user.id)
          identify(
            session.user.id,
            session.user.email ? { email: session.user.email } : undefined
          )
        }
        if (event === 'SIGNED_OUT') {
          setIsAuthed(false)
          setOnboardingCompleted(null)
          logoutRevenueCat()
          resetIdentity()
        }
        if (event === 'USER_UPDATED' && session?.user) {
          setOnboardingCompleted(session.user.user_metadata?.onboarding_completed === true)
        }
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setOnboardingCompleted(session.user.user_metadata?.onboarding_completed === true)
        }
      })
      subscription = data?.subscription
    }

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const handleLocalSignIn = async () => {
      await AsyncStorage.setItem('novaglow_local_session', 'true')
      setIsAuthed(true)
      setOnboardingCompleted(true)
    }

    const handleLocalSignOut = async () => {
      await AsyncStorage.removeItem('novaglow_local_session')
      setIsAuthed(false)
      setOnboardingCompleted(null)
    }

    const sub1 = DeviceEventEmitter.addListener('__local_sign_in__', handleLocalSignIn)
    const sub2 = DeviceEventEmitter.addListener('__dev_skip_auth__', handleLocalSignIn)
    const sub3 = DeviceEventEmitter.addListener('__local_sign_out__', handleLocalSignOut)
    
    return () => {
      sub1.remove()
      sub2.remove()
      sub3.remove()
    }
  }, [])

  // Show blank dark screen while session + i18n checks complete.
  // This prevents a flash of wrong content on launch.
  if (!fontsLoaded || isAuthed === null || !i18nReady || (isAuthed === true && onboardingCompleted === null)) {
    return <View style={{ flex: 1, backgroundColor: BG }} />
  }

  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <MaybePostHogProvider>
          <QueryClientProvider client={queryClient}>
          <SubscriptionProvider>
            <ToastProvider>
            <MediaProvider>
            <NovaGlowBootstrap>
            <SafeAreaProvider>
              <GestureHandlerRootView style={{ flex: 1, backgroundColor: BG }}>
                <BottomSheetModalProvider>
                  <StatusBar
                    style="light"
                    translucent={Platform.OS === 'android'}
                    backgroundColor={Platform.OS === 'android' ? BG : undefined}
                  />
                  <ThemeProvider value={activeTheme}>
                    <View style={{ flex: 1, backgroundColor: BG }}>
                      <Stack ref={navigationRef} screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: BG } }}>

                        <Stack.Protected guard={!isAuthed}>
                          <Stack.Screen name="index" />
                          <Stack.Screen name="(auth)" />
                        </Stack.Protected>

                        {/* ── Authenticated screens ────────────────────────────────────
                        Accessible only when signed in + onboarding done. */}
                        <Stack.Protected guard={!!isAuthed && onboardingCompleted === true}>
                          <Stack.Screen name="(tabs)" />
                          <Stack.Screen name="editor" />
                          <Stack.Screen name="export" />
                          <Stack.Screen name="settings" />
                          <Stack.Screen name="support" />
                        </Stack.Protected>

                        {/* ── Always-public screens — declared LAST so they don't become
                        the default redirect target when a protected group flips. ── */}
                        <Stack.Screen name="upgrade" />
                        <Stack.Screen name="privacy" />
                        <Stack.Screen name="terms" />
                      </Stack>
                      <ScreenTracker />
                      <OfflineBanner />
                      <OfflineOverlay />
                    </View>
                  </ThemeProvider>
                </BottomSheetModalProvider>
              </GestureHandlerRootView>
            </SafeAreaProvider>
            </NovaGlowBootstrap>
            </MediaProvider>
            </ToastProvider>
          </SubscriptionProvider>
          </QueryClientProvider>
        </MaybePostHogProvider>
      </I18nextProvider>
    </ErrorBoundary>
  )
}

export default Sentry.wrap(RootLayout)
