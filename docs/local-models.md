# Local models

An internal agent can run on a model served on your own hardware. The instance sends the
requests to the server you name and nothing else, so it works on a network with no internet
access.

Every server below exposes the OpenAI Chat Completions API. Add it in the team's
Integrations as a credential, then pick that credential and type the model id in the agent's
settings.

The api sends the requests, so the base URL must be reachable from the api process. When
the api runs in Docker, `localhost` is the container itself: use `http://host.docker.internal:<port>/v1`
(Docker Desktop, or `extra_hosts: ["host.docker.internal:host-gateway"]` on Linux), or the
model server's address on the network.

A base URL on a loopback, private, or link-local address is refused when the credential is
saved, unless its `host:port` is listed in the api's `LLM_ALLOWED_PRIVATE_HOSTS` environment
variable, a comma-separated list such as `localhost:11434,ollama:11434,host.docker.internal:1234`.
Matching is on the exact host and port as written in the base URL. A URL with no port
matches the bare host. The list is empty by default. In local development (`NODE_ENV` other
than `production` or `test`) private addresses are accepted without it.

## Ollama

1. Install Ollama and pull a model: `ollama pull llama3.1`.
2. In Integrations, add **Ollama (local)**. Base URL: `http://localhost:11434/v1`. Leave the
   API key empty.
3. In the agent, set the model to the name Ollama lists in `ollama list`, for example
   `llama3.1`.

The agent uses tools, so pick a model that supports tool calling.

## LM Studio

1. Load a model and start the server in the Developer tab. It listens on port 1234.
2. In Integrations, add **OpenAI-compatible (custom)** with the base URL
   `http://localhost:1234/v1` and any value as the API key.
3. Set the model to the id LM Studio shows for the loaded model.

The **LMStudio** entry in the provider list also works and needs no base URL, but it only
reaches `http://127.0.0.1:1234/v1`.

## vLLM

1. Start the server: `vllm serve <model> --enable-auto-tool-choice --tool-call-parser <parser>`.
   It listens on port 8000. Pass `--api-key <key>` to require a key.
2. In Integrations, add **OpenAI-compatible (custom)** with the base URL
   `http://<host>:8000/v1` and the key, or any value if the server has none.
3. Set the model to the name passed to `vllm serve`.

## Air-gapped instances

- An agent run needs no outbound call other than to the model server.
- The model picker loads its suggestions from `models.dev`. Without internet access the list
  is empty; type the model id by hand.
- The cost table has no price for a local model, so the dashboards show its tokens with no
  amount. To count a cost, for example the hardware cost per token, set a price for the
  model from the agent dashboard with Set prices. The price applies to the whole workspace.

## Sources

- Ollama OpenAI compatibility: https://docs.ollama.com/api/openai-compatibility
- LM Studio OpenAI compatibility: https://lmstudio.ai/docs/app/api/endpoints/openai
- vLLM OpenAI-compatible server: https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html
