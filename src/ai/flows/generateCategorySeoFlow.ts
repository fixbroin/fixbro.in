'use server';
/**
 * @fileOverview An AI flow to generate SEO content for a service category.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { cleanSeoString, truncateSeoString } from '@/lib/seoAdvancedUtils';

const GenerateCategorySeoInputSchema = z.object({
  categoryName: z.string().describe("The name of the service category, e.g., 'Carpentry' or 'Appliance Repair'."),
});
export type GenerateCategorySeoInput = z.infer<typeof GenerateCategorySeoInputSchema>;

const GenerateCategorySeoOutputSchema = z.object({
  h1_title: z.string().describe("An H1 title optimized for the category page."),
  seo_title: z.string().describe("An SEO-optimized meta title, under 60 characters."),
  seo_description: z.string().describe("An SEO-optimized meta description, under 160 characters."),
  seo_keywords: z.string().describe("A comma-separated string of 10 highly relevant local SEO keywords."),
  imageHint: z.string().describe("One or two keywords for an AI image search."),
});
export type GenerateCategorySeoOutput = z.infer<typeof GenerateCategorySeoOutputSchema>;

export async function generateCategorySeo(input: GenerateCategorySeoInput): Promise<GenerateCategorySeoOutput> {
  return generateCategorySeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCategorySeoPrompt',
  input: { schema: GenerateCategorySeoInputSchema },
  output: { schema: GenerateCategorySeoOutputSchema },
  prompt: `You are an expert Local SEO copywriter for "FixBro", the leading home services platform in Bangalore, India.
Your goal is to generate advanced, high-intent SEO content for a service category page to dominate Bangalore search results.

Category Name: {{categoryName}}

**STRATEGIC GUIDELINES:**
1. **Avoid Repetition**: Do NOT repeat the category name more than twice in the title or description. If the category name is "{{categoryName}}", do not use "Professional {{categoryName}} Services" if "{{categoryName}}" already includes "Services".
2. **Local Dominance**: Mention Bangalore naturally. Use high-intent modifiers like "Top-Rated", "Expert", "Verified", or "Same-Day".
3. **Semantic Variety**: Use synonyms for home services like "repairs", "maintenance", "solutions", or "experts".
4. **Formatting**: Ensure meta titles are under 60 characters and descriptions under 160.

**OUTPUT FIELDS:**
1.  **h1_title**: A compelling H1. Avoid just "Best {{categoryName}}". Try "Top-Rated {{categoryName}} Experts in Bangalore" or "{{categoryName}} Services: Trusted Professionals in Bangalore".
2.  **seo_title**: A punchy meta title. Combine the service name with a strong benefit or location.
3.  **seo_description**: A click-worthy description mentioning Bangalore and key neighborhoods like Indiranagar, Koramangala, or Whitefield. Focus on benefits like "Verified Pros", "Upfront Pricing", or "Same-Day Service".
4.  **seo_keywords**: 10 high-volume, localized keywords. Vary the phrasing.
5.  **imageHint**: Keywords for finding a relevant high-quality image.

Return the entire response as a single, valid JSON object.
`,
});

const generateCategorySeoFlow = ai.defineFlow(
  {
    name: 'generateCategorySeoFlow',
    inputSchema: GenerateCategorySeoInputSchema,
    outputSchema: GenerateCategorySeoOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("AI failed to generate a valid SEO response for the category.");
    }
    
    // Clean and strictly truncate
    return {
      h1_title: cleanSeoString(output.h1_title),
      seo_title: truncateSeoString(cleanSeoString(output.seo_title), 60),
      seo_description: truncateSeoString(cleanSeoString(output.seo_description), 160),
      seo_keywords: output.seo_keywords,
      imageHint: output.imageHint,
    };
  }
);
