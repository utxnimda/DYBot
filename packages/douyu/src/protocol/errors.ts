export class DouyuProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DouyuProtocolError";
  }
}
