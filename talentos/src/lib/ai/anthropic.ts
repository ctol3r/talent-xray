import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  GenerationFailedError,
  GenerationRefusedError,
  type ModelProvider,
  type StructuredRequest,
} from "./provider";

/**
 * Anthropic ModelProvider. Credentials resolve from the environment
 * (ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN); never hardcoded.
 * Structured outputs constrain the response to the task's zod schema;
 * one retry on a (rare) parse failure.
 */
export function createAnthropicProvider(model: string): ModelProvider {
  const client = new Anthropic();
  return {
    name: "anthropic",
    model,
    async generateStructured<T>(request: StructuredRequest<T>): Promise<T> {
      const call = () =>
        client.messages.parse({
          model,
          max_tokens: request.maxTokens ?? 16000,
          system: request.system,
          messages: [{ role: "user", content: request.user }],
          output_config: { format: zodOutputFormat(request.schema) },
        });

      let response;
      try {
        response = await call();
      } catch (error) {
        if (error instanceof Anthropic.AuthenticationError) {
          throw new GenerationFailedError(
            "Anthropic rejected the credential. Check ANTHROPIC_API_KEY.",
          );
        }
        if (error instanceof Anthropic.RateLimitError) {
          throw new GenerationFailedError(
            "Rate limited by the Anthropic API — try again shortly.",
          );
        }
        if (error instanceof Anthropic.APIError) {
          throw new GenerationFailedError(
            `Anthropic API error ${error.status ?? ""}: ${error.message}`,
          );
        }
        throw error;
      }

      if (response.stop_reason === "refusal") {
        const explanation =
          response.stop_details?.type === "refusal"
            ? response.stop_details.explanation
            : undefined;
        throw new GenerationRefusedError(
          explanation ??
            "The model declined this request. Adjust the input and retry.",
        );
      }
      if (response.parsed_output == null) {
        const retry = await call();
        if (retry.parsed_output == null) {
          throw new GenerationFailedError(
            `Model output did not match the ${request.schemaName} schema after a retry.`,
          );
        }
        return retry.parsed_output;
      }
      return response.parsed_output;
    },
  };
}
