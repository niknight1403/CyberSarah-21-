import { describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleProvider } from "../src/modules/ai-orchestration/ai.js";

describe("OpenAiCompatibleProvider", () => {
  it("sends a compatible chat completion request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Eine echte Antwort" } }],
          usage: { prompt_tokens: 12, completion_tokens: 7 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiCompatibleProvider({
      apiKey: "test-secret",
      baseUrl: "https://example.test/v1/",
      model: "test-model",
      systemPrompt: "Sei hilfreich.",
    });
    const result = await provider.generate({
      messages: [{ author: "user", content: "Hallo" }],
      maxOutputTokens: 100,
    });

    expect(result).toEqual({
      content: "Eine echte Antwort",
      model: "test-model",
      usage: { inputTokens: 12, outputTokens: 7 },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-secret" }),
      }),
    );
    vi.unstubAllGlobals();
  });
});
