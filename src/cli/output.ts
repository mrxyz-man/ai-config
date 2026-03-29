type OutputFormat = "human" | "json";

type CliEnvelope<TData = unknown> = {
  ok: boolean;
  command: string;
  timestamp: string;
  data: TData;
  warnings: unknown[];
  errors: unknown[];
};

export const emitEnvelope = <TData>(envelope: CliEnvelope<TData>, format: OutputFormat): void => {
  if (format === "json") {
    console.log(JSON.stringify(envelope, null, 2));
    return;
  }
};

export const createEnvelope = <TData>(input: {
  ok: boolean;
  command: string;
  data: TData;
  warnings?: unknown[];
  errors?: unknown[];
}): CliEnvelope<TData> => ({
  ok: input.ok,
  command: input.command,
  timestamp: new Date().toISOString(),
  data: input.data,
  warnings: input.warnings ?? [],
  errors: input.errors ?? []
});

