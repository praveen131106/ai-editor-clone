import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import StatusBadge, { statusColor } from '@/components/ui/StatusBadge'
import SettingsRow from '@/components/ui/SettingsRow'
import { SUCCESS, WARNING, ERROR } from '@/lib/theme'

describe('statusColor', () => {
    it('returns SUCCESS color for active status', () => {
        expect(statusColor('active')).toBe(SUCCESS)
    })
    it('returns WARNING color for pending status', () => {
        expect(statusColor('pending')).toBe(WARNING)
    })
    it('returns ERROR color for archived status', () => {
        expect(statusColor('archived')).toBe(ERROR)
    })
})

describe('StatusBadge Component', () => {
    it('renders the label correctly', () => {
        const { getByText } = render(<StatusBadge status="active" label="Completed" />)
        expect(getByText('Completed')).toBeTruthy()
    })
})

describe('SettingsRow Component', () => {
    it('renders label and triggers onPress callback when pressed', () => {
        const handlePress = jest.fn()
        const { getByText } = render(
            <SettingsRow 
                icon="settings-sharp" 
                label="Preferences" 
                onPress={handlePress} 
            />
        )
        
        const labelElement = getByText('Preferences')
        expect(labelElement).toBeTruthy()
        
        fireEvent.press(labelElement)
        expect(handlePress).toHaveBeenCalledTimes(1)
    })
})
