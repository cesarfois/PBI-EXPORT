export const controlService = {
    // --- Controls Management ---

    getControls: (username) => {
        try {
            const data = localStorage.getItem(`docuware_controls_${username}`);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error loading controls:', error);
            return [];
        }
    },

    saveControl: (username, control) => {
        try {
            const controls = controlService.getControls(username);
            const newControl = {
                ...control,
                id: control.id || Date.now().toString(),
                createdAt: control.createdAt || new Date().toISOString()
            };

            const updatedControls = control.id
                ? controls.map(c => c.id === control.id ? newControl : c)
                : [...controls, newControl];

            localStorage.setItem(`docuware_controls_${username}`, JSON.stringify(updatedControls));
            return newControl;
        } catch (error) {
            console.error('Error saving control:', error);
            throw error;
        }
    },

    deleteControl: (username, controlId) => {
        try {
            const controls = controlService.getControls(username);
            const updatedControls = controls.filter(c => c.id !== controlId);
            localStorage.setItem(`docuware_controls_${username}`, JSON.stringify(updatedControls));

            // Optional: Cleanup statuses associated with this control if we wanted to be strict
            // localStorage.removeItem(`docuware_statuses_${controlId}`); 
        } catch (error) {
            console.error('Error deleting control:', error);
            throw error;
        }
    },

    // --- Item Status Management (Semaphores) ---

    // Get all statuses for a specific control
    getControlStatuses: (controlId) => {
        try {
            const data = localStorage.getItem(`docuware_statuses_${controlId}`);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Error loading statuses:', error);
            return {};
        }
    },

    // Get status for a single document
    getItemStatus: (controlId, docId) => {
        const statuses = controlService.getControlStatuses(controlId);
        return statuses[docId] || null; // 'approved' | 'pending' | 'rejected' | null
    },

    // Set status for a single document
    setItemStatus: (controlId, docId, status) => {
        try {
            const statuses = controlService.getControlStatuses(controlId);

            if (status === null) {
                delete statuses[docId];
            } else {
                statuses[docId] = status;
            }

            localStorage.setItem(`docuware_statuses_${controlId}`, JSON.stringify(statuses));
            return statuses;
        } catch (error) {
            console.error('Error saving item status:', error);
            throw error;
        }
    }
};
