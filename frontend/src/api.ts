import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 30000,
});

export const TOKEN_KEY = "foodievault.token";

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type ContentType = "place" | "recipe" | "item";
export type SourcePlatform = "instagram" | "youtube" | "tiktok" | "other";

export interface User {
  id: string;
  email: string;
  name: string | null;
  onboarded: boolean;
  created_at: string;
}

export interface SavedItem {
  id: string;
  user_id: string;
  type: ContentType;
  name: string;
  description?: string | null;
  location?: string | null;
  cuisine?: string | null;
  ingredients: string[];
  dishes: string[];
  source_platform?: SourcePlatform;
  source_url?: string | null;
  thumbnail_url?: string | null;
  tags: string[];
  notes?: string | null;
  favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExtractedContent {
  suggested_type: ContentType;
  name: string;
  description: string;
  location: string | null;
  cuisine: string | null;
  ingredients: string[];
  dishes: string[];
  source_platform: SourcePlatform;
  source_url: string;
  thumbnail_url: string | null;
  tags: string[];
}

export interface Stats {
  place: number;
  recipe: number;
  item: number;
  total: number;
  favorites: number;
}

export const authApi = {
  requestOtp: (email: string) =>
    api.post<{ success: boolean; dev_otp?: string }>("/auth/request-otp", { email }),
  verifyOtp: (email: string, otp: string) =>
    api.post<{ success: boolean; token: string; user: User }>("/auth/verify-otp", { email, otp }),
  me: () => api.get<{ user: User }>("/auth/me"),
  updateProfile: (name: string) => api.post<{ user: User }>("/auth/update-profile", { name }),
};

export const itemsApi = {
  list: (type?: ContentType, favorite?: boolean) =>
    api.get<{ items: SavedItem[]; count: number }>("/items", { params: { type, favorite } }),
  get: (id: string) => api.get<SavedItem>(`/items/${id}`),
  stats: () => api.get<Stats>("/items/stats"),
  create: (data: Partial<SavedItem>) => api.post<SavedItem>("/items", data),
  update: (id: string, data: Partial<SavedItem>) => api.patch<SavedItem>(`/items/${id}`, data),
  delete: (id: string) => api.delete(`/items/${id}`),
};

export const extractApi = {
  fromUrl: (url: string) => api.post<ExtractedContent>("/extract", { url }),
};

export const swiggyApi = {
  order: (item_id: string, order_type: "food" | "ingredients") =>
    api.post<{
      order_id: string;
      status: string;
      item_name: string;
      eta_minutes: number;
      estimated_amount: number;
      currency: string;
      swiggy_url: string;
    }>("/swiggy/order", { item_id, order_type }),
};
