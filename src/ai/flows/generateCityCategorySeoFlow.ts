
'use server';
/**
 * @fileOverview An AI flow to generate SEO content for a specific service category within a city.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { cleanSeoString, truncateSeoString } from '@/lib/seoAdvancedUtils';

const GenerateCityCategorySeoInputSchema = z.object({
  cityName: z.string().describe("The name of the city, e.g., 'Bangalore'."),
  categoryName: z.string().describe("The name of the service category, e.g., 'Carpentry'."),
});
export type GenerateCityCategorySeoInput = z.infer<typeof GenerateCityCategorySeoInputSchema>;

const GenerateCityCategorySeoOutputSchema = z.object({
  h1_title: z.string().describe("An H1 title optimized for the city-category page."),
  meta_title: z.string().describe("An SEO-optimized meta title, under 60 characters."),
  meta_description: z.string().describe("An SEO-optimized meta description, under 160 characters."),
  meta_keywords: z.string().describe("A comma-separated string of 10 highly relevant local SEO keywords."),
});
export type GenerateCityCategorySeoOutput = z.infer<typeof GenerateCityCategorySeoOutputSchema>;

export async function generateCityCategorySeo(input: GenerateCityCategorySeoInput): Promise<GenerateCityCategorySeoOutput> {
  return generateCityCategorySeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCityCategorySeoPrompt',
  input: { schema: GenerateCityCategorySeoInputSchema },
  output: { schema: GenerateCityCategorySeoOutputSchema },
  prompt: `You are an expert Local SEO copywriter for "FixBro", Bangalore's leading home services platform.
Your task is to generate advanced, high-intent SEO content for a specific service category within Bangalore.

City Name: {{cityName}}
Category Name: {{categoryName}}

**STRATEGIC GUIDELINES:**
1. **Avoid Keyword Stuffing**: Do NOT repeat {{categoryName}} or {{cityName}} more than twice in the title or description.
2. **Semantic Variety**: Use terms like "Specialists", "Experts", "Maintenance", or "FixBro Pros" instead of repeating "Services".
3. **Local Authority**: Integrate Bangalore neighborhoods like HSR Layout, Koramangala, and Indiranagar naturally.
4. **Intent-Driven**: Use "Best", "Top-Rated", "Verified Professionals", "Upfront Pricing", "Same-Day Service".

**OUTPUT FIELDS:**
1.  **h1_title**: A strong, localized H1. E.g., "Best Professional {{categoryName}} Experts in {{cityName}}".
2.  **meta_title**: A punchy title under 60 chars. E.g., "{{categoryName}} in {{cityName}} | Top-Rated Verified Pros | FixBro".
3.  **meta_description**: A compelling summary under 160 chars.
4.  **meta_keywords**: 10 high-intent, city-specific keywords.

Return the entire response as a single, valid JSON object.
`,
});

const generateCityCategorySeoFlow = ai.defineFlow(
  {
    name: 'generateCityCategorySeoFlow',
    inputSchema: GenerateCityCategorySeoInputSchema,
    outputSchema: GenerateCityCategorySeoOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("AI failed to generate a valid SEO response for the city-category.");
    }

    // Clean and strictly truncate
    return {
      h1_title: cleanSeoString(output.h1_title),
      meta_title: truncateSeoString(cleanSeoString(output.meta_title), 60),
      meta_description: truncateSeoString(cleanSeoString(output.meta_description), 160),
      meta_keywords: output.meta_keywords,
    };
  }
);
