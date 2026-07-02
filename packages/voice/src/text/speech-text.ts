const URL_PATTERN = /https?:\/\/\S+/giu;
const CONTROL_PATTERN = /\p{Control}/gu;
const WHITESPACE_PATTERN = /\s+/g;

export function cleanTextForSpeech(input: string, maxChars = 240): string {
  return input
    .replace(URL_PATTERN, "link")
    .replace(CONTROL_PATTERN, " ")
    .replace(WHITESPACE_PATTERN, " ")
    .trim()
    .slice(0, maxChars);
}
