import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GuessRow from "../app/components/GuessRow";

describe("smoke", () => {
  it("renders a guess row", () => {
    render(
      <GuessRow
        guess={{
          player: "Test Player",
          team: "KC",
          position: "QB",
          jersey: 15,
          conference: "AFC",
          division: "West",
          result: {
            team: "correct",
            position: "incorrect",
            jersey: "higher",
            conference: "correct",
            division: "incorrect",
          },
        }}
      />,
    );

    expect(screen.getByText("Test Player")).toBeInTheDocument();
  });
});
