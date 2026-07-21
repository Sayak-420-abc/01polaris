import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { auth } from "@clerk/nextjs/server";

const suggestionSchema = z.object({
  suggestion: z
    .string()
    .describe(
      "the code to insert at cursor , or empty string of no completion needed",
    ),
});

const SUGGESTION_PROMPT = `You are a code suggestion assistant.

<context>
<file_name>{fileName}</file_name>
<previous_lines>
{previousLines}
</previous_lines>
<current_line number="{lineNumber}">{currentLine}</current_line>
<before_cursor>{textBeforeCursor}</before_cursor>
<after_cursor>{textAfterCursor}</after_cursor>
<next_lines>
{nextLines}
</next_lines>
<full_code>
{code}
</full_code>
</context>

<instructions>
Follow these steps IN ORDER:

1. First, look at next_lines. If next_lines contains ANY code, check if it continues from where the cursor is. If it does, return empty string immediately - the code is already written.

2. Check if before_cursor ends with a complete statement (;, }, )). If yes, return empty string.

3. Only if steps 1 and 2 don't apply: suggest what should be typed at the cursor position, using context from full_code.

Your suggestion is inserted immediately after the cursor, so never suggest code that's already in the file.
</instructions>`;

type SuggestionRequestBody = {
  fileName: string;
  code: string;
  currentLine: string;
  previousLines?: string;
  textBeforeCursor: string;
  textAfterCursor: string;
  nextLines?: string;
  lineNumber: number;
};


export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // ✅ SAFELY READ BODY
    const bodyText = await request.text();

    if (!bodyText) {
      return NextResponse.json(
        { error: "Empty request body" },
        { status: 400 },
      );
    }

    let body: SuggestionRequestBody;

    try {
     body = JSON.parse(bodyText) as SuggestionRequestBody;

    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      fileName,
      code,
      currentLine,
      previousLines,
      textBeforeCursor,
      textAfterCursor,
      nextLines,
      lineNumber,
    } = body;

    if (!code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const prompt = SUGGESTION_PROMPT.replace("{fileName}", fileName)
      .replace("{code}", code)
      .replace("{currentLine}", currentLine)
      .replace("{previousLines}", previousLines || "")
      .replace("{textBeforeCursor}", textBeforeCursor || "")
      .replace("{textAfterCursor}", textAfterCursor || "")
      .replace("{nextLines}", nextLines || "")
      .replace("{lineNumber}", String(lineNumber));

    // Load and pool available Gemini API keys
    const rawKeys = [
      process.env.SUGGESTION_GEMINI_API_KEYS,
      process.env.GEMINI_API_KEYS,
      process.env.GEMINI_API_KEY,
      process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    ];
    
    // Split, trim, filter out empty values, and keep unique keys
    const keys: string[] = [];
    for (const rawVal of rawKeys) {
      if (!rawVal) continue;
      const parts = rawVal.split(",").map((k) => k.trim()).filter(Boolean);
      for (const part of parts) {
        if (!keys.includes(part)) {
          keys.push(part);
        }
      }
    }

    // Shuffle the key pool to load-balance across all configured keys
    const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

    let outputSuggestion: string | null = null;
    let lastError: any = null;

    if (shuffledKeys.length > 0) {
      // Loop over keys to attempt failover/retry
      for (const key of shuffledKeys) {
        try {
          const googleProvider = createGoogleGenerativeAI({ apiKey: key });
          const { output } = await generateText({
            model: googleProvider("gemini-2.5-flash"),
            output: Output.object({ schema: suggestionSchema }),
            prompt,
          });
          outputSuggestion = output.suggestion;
          break; // Successfully got suggestion, break retry loop
        } catch (err) {
          console.warn("Gemini suggestion failed for key:", key.substring(0, 8) + "...", err);
          lastError = err;
        }
      }
    } else {
      // Fallback: If no keys are explicitly found in env (use default SDK credentials path)
      const googleProvider = createGoogleGenerativeAI({});
      const { output } = await generateText({
        model: googleProvider("gemini-2.5-flash"),
        output: Output.object({ schema: suggestionSchema }),
        prompt,
      });
      outputSuggestion = output.suggestion;
    }

    if (outputSuggestion === null) {
      if (lastError) {
        throw lastError;
      }
      throw new Error("Failed to generate suggestion with any available key");
    }

    return NextResponse.json({ suggestion: outputSuggestion });
  } catch (error) {
    console.error("Suggestion error:", error);
    return NextResponse.json(
      { error: "failed to generate suggestion" },
      { status: 500 },
    );
  }
}

