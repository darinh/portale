export default async function* report(source) {
  for await (const event of source) {
    if (event.type !== "test:pass" && event.type !== "test:fail") continue;

    const { name, nesting, file, skip, todo } = event.data;
    const status =
      event.type === "test:fail" ? "FAILED" : skip || todo ? "SKIPPED" : "PASSED";

    yield `${JSON.stringify({ status, name, nesting, file })}\n`;
  }
}
