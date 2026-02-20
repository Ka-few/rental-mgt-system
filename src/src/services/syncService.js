import api from './api';

const syncService = {
    // Get local device sync info
    getSyncInfo: async () => {
        const response = await api.get('/settings');
        const settings = response.data;
        return {
            device_id: settings.device_id,
            owner_url: settings.owner_url,
            last_sync_timestamp: settings.last_sync_timestamp,
            is_registered: !!settings.sync_api_token
        };
    },

    // Register with an owner server
    register: async (ownerUrl, deviceName) => {
        const response = await api.post('/sync/client/register', {
            owner_url: ownerUrl,
            device_name: deviceName
        });
        return response.data;
    },

    // Trigger manual sync
    syncNow: async () => {
        const response = await api.post('/sync/client/sync');
        return response.data;
    }
};

export default syncService;
