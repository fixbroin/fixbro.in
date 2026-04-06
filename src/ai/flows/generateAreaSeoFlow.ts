
'use server';
/**
 * @fileOverview An AI flow to generate SEO content for a specific service area within a city.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { cleanSeoString, truncateSeoString } from '@/lib/seoAdvancedUtils';

const GenerateAreaSeoInputSchema = z.object({
  areaName: z.string().describe("The name of the specific area or locality, e.g., 'Whitefield'."),
  cityName: z.string().describe("The name of the parent city, e.g., 'Bangalore'."),
});
export type GenerateAreaSeoInput = z.infer<typeof GenerateAreaSeoInputSchema>;

const GenerateAreaSeoOutputSchema = z.object({
  h1_title: z.string().describe("An H1 title optimized for the area page."),
  seo_title: z.string().describe("An SEO-optimized meta title, under 60 characters."),
  seo_description: z.string().describe("An SEO-optimized meta description, under 160 characters."),
  seo_keywords: z.string().describe("A comma-separated string of 10 highly relevant SEO keywords for the area."),
});
export type GenerateAreaSeoOutput = z.infer<typeof GenerateAreaSeoOutputSchema>;

export async function generateAreaSeo(input: GenerateAreaSeoInput): Promise<GenerateAreaSeoOutput> {
  return generateAreaSeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAreaSeoPrompt',
  input: { schema: GenerateAreaSeoInputSchema },
  output: { schema: GenerateAreaSeoOutputSchema },
  prompt: `You are an expert Local SEO copywriter for "FixBro", the leading home services platform in Bangalore, India.
Your task is to generate high-performance SEO content for a specific locality or neighborhood within Bangalore to rank #1 on Google for hyper-local searches.

Area Name: {{areaName}}
City Name: {{cityName}} (usually Bangalore)

**STRATEGIC GUIDELINES:**
1. **Hyper-Local Focus**: Emphasize {{areaName}} as the primary location. Use phrases like "Trusted by residents in {{areaName}}" or "Best professionals in {{areaName}}".
2. **Avoid Repetition**: Do not use "Bangalore" or "{{areaName}}" more than twice in the same field. If the area is already a well-known part of Bangalore (like Whitefield), use that.
3. **Intent Modifiers**: Use "Best", "Professional", "Verified Pros", "Same-Day".
4. **Natural Flow**: Titles and descriptions should feel like a human wrote them, not a template.

**OUTPUT FIELDS:**
1.  **h1_title**: A localized H1. E.g., "Top-Rated Home Services & Repairs in {{areaName}}".
2.  **seo_title**: A meta title that highlights locality and trust. E.g., "Best Handyman & Home Services in {{areaName}} | FixBro".
3.  **seo_description**: A compelling summary mentioning {{areaName}}, the parent city, and service reliability.
4.  **seo_keywords**: 10 hyper-local keywords.

Return the entire response as a single, valid JSON object.
`,
});

const generateAreaSeoFlow = ai.defineFlow(
  {
    name: 'generateAreaSeoFlow',
    inputSchema: GenerateAreaSeoInputSchema,
    outputSchema: GenerateAreaSeoOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("AI failed to generate a valid SEO response for the area.");
    }

    return {
      h1_title: cleanSeoString(output.h1_title),
      seo_title: truncateSeoString(cleanSeoString(output.seo_title), 60),
      seo_description: truncateSeoString(cleanSeoString(output.seo_description), 160),
      seo_keywords: output.seo_keywords,
    };
  }
);
