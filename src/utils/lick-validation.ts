import type { Lick } from "../types/lick";
import { checkLick, describeIssues } from "../../functions/_shared/validate";
import { LickRequestError } from "./lick-errors";

/** Validate API data before it reaches the notation, piano and audio hooks. */
export function parseLick(value: unknown): Lick {
  const bars = value && typeof value === "object" && "bars" in value && typeof value.bars === "number" ? value.bars : 4;
  const issues = checkLick(value, bars);
  if (issues.fatal.length > 0 || issues.strict.length > 0) {
    throw new LickRequestError("api", "the lick came back malformed", { detail: describeIssues(issues) });
  }
  if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string" || !value.id.trim()) {
    throw new LickRequestError("api", "the lick came back malformed", { detail: "Invalid lick id" });
  }
  return value as Lick;
}
