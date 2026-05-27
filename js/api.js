const API = {
    async fetch(url, options = {}) {
        const headers = { ...options.headers };
        if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        const res = await fetch(url, { ...options, headers });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Server Error');
        }
        return res.json();
    },

    auth: {
        async requestCode(contact) {
            return API.fetch('/api/auth/request-code', {
                method: 'POST',
                body: JSON.stringify({ contact })
            });
        },
        async verifyCode(contact, code, name) {
            return API.fetch('/api/auth/verify-code', {
                method: 'POST',
                body: JSON.stringify({ contact, code, name })
            });
        },
        async logout() {
            return API.fetch('/api/auth/logout', { method: 'POST' });
        },
        async me() {
            try { return await API.fetch('/api/auth/me'); } catch (e) { return null; }
        },
        async updateProfile(data) {
            return API.fetch('/api/users/me', {
                method: 'PUT',
                body: JSON.stringify(data) // Теперь можно передавать {name} или {email}
            });
        },
         async updatePhone(phone, code) {
            return API.fetch('/api/users/me/phone', {
                method: 'PUT',
                body: JSON.stringify({ phone, code })
            });
        }
        
    },

    categories: {
        async getAll() { return API.fetch('/api/categories'); }
    },

    products: {
        async getAll() { return API.fetch('/api/products'); },
        async add(formData) {
            const isFormData = formData instanceof FormData;
            return API.fetch('/api/products', {
                method: 'POST',
                headers: isFormData ? {} : { 'Content-Type': 'application/json' },
                body: isFormData ? formData : JSON.stringify(formData)
            });
        },
        async update(id, formData) {
            const isFormData = formData instanceof FormData;
            return API.fetch(`/api/products/${id}`, {
                method: 'PUT',
                headers: isFormData ? {} : { 'Content-Type': 'application/json' },
                body: isFormData ? formData : JSON.stringify(formData)
            });
        },
        async delete(id) { return API.fetch(`/api/products/${id}`, { method: 'DELETE' }); }
    },

    orders: {
        async getAll() { return API.fetch('/api/orders'); },
        async getItems(orderId) { return API.fetch(`/api/orders/${orderId}/items`); },
        async updateStatus(orderId, status) {
            return API.fetch(`/api/orders/${orderId}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
        },
        async getMine() { return API.fetch('/api/orders'); },
        async create(orderData) {
            return API.fetch('/api/orders', { method: 'POST', body: JSON.stringify(orderData) });
        }
    }
};

export default API;