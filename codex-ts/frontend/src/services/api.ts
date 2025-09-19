const API_BASE_URL = 'http://localhost:3000';

class ApiClient {
  private async request(method: string, path: string, options: any = {}): Promise<any> {
    const url = `${API_BASE_URL}${path}`;
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    if (options.params) {
      const params = new URLSearchParams(options.params);
      path += `?${params.toString()}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, config);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  get(path: string, options?: any) {
    return this.request('GET', path, options);
  }

  post(path: string, data?: any, options?: any) {
    return this.request('POST', path, { ...options, body: data });
  }

  put(path: string, data?: any, options?: any) {
    return this.request('PUT', path, { ...options, body: data });
  }

  delete(path: string, options?: any) {
    return this.request('DELETE', path, options);
  }
}

export const apiClient = new ApiClient();