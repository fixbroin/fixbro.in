
'use server';
/**
 * @fileOverview An AI flow to generate SEO content for a city page.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { cleanSeoString, truncateSeoString } from '@/lib/seoAdvancedUtils';

const GenerateCitySeoInputSchema = z.object({
  cityName: z.string().describe("The name of the city, e.g., 'Bangalore' or 'Whitefield'."),
});
export type GenerateCitySeoInput = z.infer<typeof GenerateCitySeoInputSchema>;

const GenerateCitySeoOutputSchema = z.object({
  h1_title: z.string().describe("An H1 title optimized for the city page."),
  seo_title: z.string().describe("An SEO-optimized meta title, under 60 characters."),
  seo_description: z.string().describe("An SEO-optimized meta description, under 160 characters."),
  seo_keywords: z.string().describe("A comma-separated string of 10 relevant SEO keywords for the city."),
});
export type GenerateCitySeoOutput = z.infer<typeof GenerateCitySeoOutputSchema>;

export async function generateCitySeo(input: GenerateCitySeoInput): Promise<GenerateCitySeoOutput> {
  return generateCitySeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCitySeoPrompt',
  input: { schema: GenerateCitySeoInputSchema },
  output: { schema: GenerateCitySeoOutputSchema },
  prompt: `You are an expert Local SEO copywriter for "FixBro", a premium home services platform.
Your task is to generate high-performance SEO content for a city-level landing page.

City Name: {{cityName}}

**STRATEGIC GUIDELINES:**
1. **Avoid Repetition**: Do not over-use "{{cityName}}" or "Home Services". Use variations like "Handyman", "Repairs", "Maintenance", or "FixBro Experts".
2. **Local Focus**: Mention specific local traits or neighborhoods if it's Bangalore (e.g., HSR, Koramangala).
3. **Intent-Driven**: Use "Best", "Top-Rated", "Professional", "Trusted".
4. **Length**: Meta title < 60 chars, Meta description < 160 chars.

**OUTPUT FIELDS:**
1.  **h1_title**: A strong H1 title. E.g., "Professional Home Maintenance & Repair Services in {{cityName}}".
2.  **seo_title**: A meta title that grabs attention. E.g., "Best Home Services in {{cityName}} | Reliable & Trusted Experts".
3.  **seo_description**: A compelling summary that encourages clicks, mentioning key services like carpentry, plumbing, and electrical.
4.  **seo_keywords**: 10 high-intent keywords.

Return the entire response as a single, valid JSON object.
`,
});

const generateCitySeoFlow = ai.defineFlow(
  {
    name: 'generateCitySeoFlow',
    inputSchema: GenerateCitySeoInputSchema,
    outputSchema: GenerateCitySeoOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("AI failed to generate a valid SEO response for the city.");
    }

    return {
      h1_title: cleanSeoString(output.h1_title),
      seo_title: truncateSeoString(cleanSeoString(output.seo_title), 60),
      seo_description: truncateSeoString(cleanSeoString(output.seo_description), 160),
      seo_keywords: output.seo_keywords,
    };
  }
);
