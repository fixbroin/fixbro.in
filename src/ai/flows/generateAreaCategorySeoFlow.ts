
'use server';
/**
 * @fileOverview An AI flow to generate SEO content for a specific service category within a specific area of a city.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { cleanSeoString, truncateSeoString } from '@/lib/seoAdvancedUtils';

const GenerateAreaCategorySeoInputSchema = z.object({
  areaName: z.string().describe("The name of the specific area or locality, e.g., 'Whitefield'."),
  cityName: z.string().describe("The name of the parent city, e.g., 'Bangalore'."),
  categoryName: z.string().describe("The name of the service category, e.g., 'Carpentry'."),
});
export type GenerateAreaCategorySeoInput = z.infer<typeof GenerateAreaCategorySeoInputSchema>;

const GenerateAreaCategorySeoOutputSchema = z.object({
  h1_title: z.string().describe("An H1 title optimized for the area-category page."),
  meta_title: z.string().describe("An SEO-optimized meta title, under 60 characters."),
  meta_description: z.string().describe("An SEO-optimized meta description, under 160 characters."),
  meta_keywords: z.string().describe("A comma-separated string of 10 highly relevant hyper-local SEO keywords."),
});
export type GenerateAreaCategorySeoOutput = z.infer<typeof GenerateAreaCategorySeoOutputSchema>;

export async function generateAreaCategorySeo(input: GenerateAreaCategorySeoInput): Promise<GenerateAreaCategorySeoOutput> {
  return generateAreaCategorySeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAreaCategorySeoPrompt',
  input: { schema: GenerateAreaCategorySeoInputSchema },
  output: { schema: GenerateAreaCategorySeoOutputSchema },
  prompt: `You are an expert Local SEO copywriter for "FixBro", Bangalore's top home services platform.
Your task is to generate advanced, hyper-local SEO content for a specific service category within a Bangalore neighborhood.

Area Name: {{areaName}}
City Name: {{cityName}} (usually Bangalore)
Category Name: {{categoryName}}

**STRATEGIC GUIDELINES:**
1. **Avoid Keyword Stuffing**: Do NOT repeat {{categoryName}}, {{areaName}}, or {{cityName}} more than twice in the title or description.
2. **Natural Combinations**: Instead of "Best Carpentry in Whitefield Bangalore Carpentry", use "Expert Carpenter Services in Whitefield | Trusted by Bangalore Homeowners".
3. **Intent & Benefit**: Focus on "Verified Professionals", "Fast Response", "Upfront Pricing".
4. **Local Relevance**: Mention nearby landmarks if natural, or focus on the specific neighborhood's needs.

**OUTPUT FIELDS:**
1.  **h1_title**: A punchy, localized H1. E.g., "Top-Rated {{categoryName}} Experts in {{areaName}}".
2.  **meta_title**: A meta title that balances the service and location. Max 60 chars.
3.  **meta_description**: A compelling description under 160 chars.
4.  **meta_keywords**: 10 high-intent, hyper-local keywords.

Return the entire response as a single, valid JSON object.
`,
});

const generateAreaCategorySeoFlow = ai.defineFlow(
  {
    name: 'generateAreaCategorySeoFlow',
    inputSchema: GenerateAreaCategorySeoInputSchema,
    outputSchema: GenerateAreaCategorySeoOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("AI failed to generate a valid SEO response for the area-category.");
    }

    return {
      h1_title: cleanSeoString(output.h1_title),
      meta_title: truncateSeoString(cleanSeoString(output.meta_title), 60),
      meta_description: truncateSeoString(cleanSeoString(output.meta_description), 160),
      meta_keywords: output.meta_keywords,
    };
  }
);
