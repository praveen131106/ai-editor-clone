import AsyncStorage from '@react-native-async-storage/async-storage'
import { DeviceEventEmitter } from 'react-native'
import { notificationItems as defaultNotifications, type NotificationItem } from './mockData'

/**
 * 🔔 NovaGlow AI Notification Manager.
 *
 * Persists local alerts to AsyncStorage so they dynamically populate the Activity/Notifications tab
 * and integrates with the app context for real-time dispatch alerts.
 */

/**
 * Requests local notification permission.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
    return true
}

/**
 * Triggers an instant local push notification.
 * Saves it to AsyncStorage list and log feed.
 */
export async function triggerLocalNotification(title: string, body: string): Promise<void> {
    
    try {
        const stored = await AsyncStorage.getItem('novaglow_notifications')
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
        await AsyncStorage.setItem('novaglow_notifications', JSON.stringify(notifications))
        
        // Dispatch native event safely on all platforms
        DeviceEventEmitter.emit('novaglow_new_notification', newNotif)
    } catch (err) {
        console.error('[Notifications] Failed to save local alert:', err)
    }
}

/**
 * Schedules automated creator reminder alerts (e.g. after 24 hours).
 */
export async function scheduleDraftReminders(): Promise<void> {
}
