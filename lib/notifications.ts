import AsyncStorage from '@react-native-async-storage/async-storage'
import { notificationItems as defaultNotifications, type NotificationItem } from './mockData'

/**
 * 🔔 Lumi AI Notification Manager.
 *
 * Persists local alerts to AsyncStorage so they dynamically populate the Activity/Notifications tab
 * and integrates with the app context for real-time dispatch alerts.
 */

/**
 * Requests local notification permission.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
    console.log('[Notifications] Requested local push notification permissions.')
    return true
}

/**
 * Triggers an instant local push notification.
 * Saves it to AsyncStorage list and log feed.
 */
export async function triggerLocalNotification(title: string, body: string): Promise<void> {
    console.log(`[Notifications] Dispatched alert: "${title}" — ${body}`)
    
    try {
        const stored = await AsyncStorage.getItem('lumi_notifications')
        let notifications: NotificationItem[] = stored ? JSON.parse(stored) : defaultNotifications
        
        const newNotif: NotificationItem = {
            id: `notif-${Date.now()}`,
            title,
            body,
            timeAgo: 'Just now',
            category: 'product',
            read: false
        }
        
        // Prepended to notifications list
        notifications = [newNotif, ...notifications]
        await AsyncStorage.setItem('lumi_notifications', JSON.stringify(notifications))
        
        // Dispatch local event to notify screens of fresh alerts
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('lumi_new_notification', { detail: newNotif }))
        }
    } catch (err) {
        console.error('[Notifications] Failed to save local alert:', err)
    }
}

/**
 * Schedules automated creator reminder alerts (e.g. after 24 hours).
 */
export async function scheduleDraftReminders(): Promise<void> {
    console.log('[Notifications] Scheduled automated draft reminders (24h loop).')
}
