import { Injectable } from '@nestjs/common';
import { BusinessCategory } from '@prisma/client';

@Injectable()
export class CategoriesService {
  listPlatformCategories(): { categories: BusinessCategory[]; labels: Record<string, string> } {
    return {
      categories: [BusinessCategory.FOOD_DINING, BusinessCategory.BEAUTY_GROOMING],
      labels: {
        FOOD_DINING: 'Food & dining',
        BEAUTY_GROOMING: 'Beauty & grooming',
      },
    };
  }
}
