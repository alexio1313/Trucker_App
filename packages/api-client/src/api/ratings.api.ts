import { apiClient } from '../axios.instance';
import { ApiResponse, Rating, PaginatedResponse } from '@truck-platform/shared';
import { ENDPOINTS } from '@truck-platform/shared';

export interface SubmitRatingInput {
  loadId: string;
  toUserId: string;
  score: number;
  comment?: string;
  tags?: string[];
}

export const ratingsApi = {
  submitRating(input: SubmitRatingInput): Promise<ApiResponse<Rating>> {
    return apiClient.post(ENDPOINTS.RATINGS.SUBMIT, input).then((r) => r.data);
  },

  getUserRatings(
    userId: string,
    params?: { page?: number; pageSize?: number },
  ): Promise<ApiResponse<PaginatedResponse<Rating>>> {
    return apiClient.get(ENDPOINTS.RATINGS.BY_USER(userId), { params }).then((r) => r.data);
  },
};
