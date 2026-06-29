import { createRuntimeOrchestrator } from "@dybot/core";

const runtime = createRuntimeOrchestrator();
const events: string[] = [];
const unsubscribe = runtime.onEvent((event) => {
  events.push(event.type);
});

runtime.start();
runtime.stop();
unsubscribe();

const health = runtime.getHealth();
if (health.status !== "stopped") {
  throw new Error(`Unexpected runtime status: ${health.status}`);
}

if (events.length < 2) {
  throw new Error("Expected runtime events, got " + String(events.length));
}

console.log(
  JSON.stringify({
    ok: true,
    status: health.status,
    events,
  }),
);
