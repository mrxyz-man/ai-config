import { ConfigResolverPort } from "../core/ports";

export class AiConfigResolver implements ConfigResolverPort<never> {
  resolve(_projectRoot: string): never {
    throw new Error("Resolver is not implemented yet");
  }
}

