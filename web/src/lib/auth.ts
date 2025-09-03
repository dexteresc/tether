import { apiClient } from "@/api/client";
import type { LoginCredentials, AuthResponse } from "@/types/api";
import type { User } from "@/types/models";

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>(
      "/auth/login",
      credentials
    );
    if (response.token) {
      localStorage.setItem("authToken", response.token);
    }
    return response;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post<void>("/auth/logout");
    } finally {
      localStorage.removeItem("authToken");
    }
  },

  validate: async (): Promise<User> => {
    return apiClient.get<User>("/auth/me");
  },

  refresh: async (): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>("/auth/refresh");
    if (response.token) {
      localStorage.setItem("authToken", response.token);
    }
    return response;
  },
};
